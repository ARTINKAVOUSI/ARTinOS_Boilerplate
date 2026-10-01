'use client';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { RollingValue } from '../system/RollingValue';
import { useControllable } from '../system/hooks';
import { clamp, cx, joinFormatted, pxToken, runFormat, scopeAttrs, snapshotTokens } from '../system/utils';
import type { Format, Formatter, Mapping, ScopeProps } from '../system/utils';
import { applyDetent, extraDigits, makeScale, modifierRatio, nextDetent, parseTyped, SEAM_GRAB, snapKey, zoneRatio } from './engine';
import type { PrecisionLevels } from './engine';
import { Hud, HUD_TOKENS, ValueEditor } from './parts';
import type { HudState } from './parts';
import './Slider.css';

/* ARTINOS RangeSlider — the same capsule holding an interval.
 *   seam press      → grabs that end, no jump
 *   press inside    → moves the whole interval, span preserved
 *   press outside   → nearest end jumps there
 *   value press     → precision scrub of the active end
 *   double-click the value (or Enter / F2) → type "lo – hi", or one number for the active end
 * Only the active end gets strong feedback. Each end is its own focusable slider.
 */

export type RangeValue = [number, number];
type End = 'lo' | 'hi';
type Mode = 'scrub' | 'seam' | 'jump' | 'span';

export interface RangeSliderProps extends ScopeProps {
  label?: string;
  value?: RangeValue;
  defaultValue?: RangeValue;
  onChange?: (value: RangeValue) => void;
  onCommit?: (value: RangeValue) => void;
  min?: number;
  max?: number;
  step?: number;
  steps?: number;
  detents?: number[];
  mapping?: Mapping;
  /** Smallest allowed distance between the ends. */
  minSpan?: number;
  format?: Format;
  decimals?: number;
  unit?: string;
  formatter?: Formatter;
  layout?: 'integrated' | 'paired';
  labelWidth?: number | string;
  enabled?: boolean;
  defaultEnabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /** Double-click the body switches the range off and back on. Default: true; pass false to opt out. */
  toggleable?: boolean;
  /** Show the enable dot. Default: on when toggleable is passed explicitly. */
  indicator?: boolean;
  precision?: PrecisionLevels;
  className?: string;
  style?: CSSProperties;
  id?: string;
  'aria-label'?: string;
}

interface Drag {
  m: Mode;
  end: End;
  id: number;
  v0: RangeValue;
  lx: number;
  vx: number;
  t: number;
  left: number;
  W: number;
  ox: number;
  oy: number;
  snap: number | null;
}

export function RangeSlider(props: RangeSliderProps) {
  const {
    label, value: valueProp, defaultValue, onChange, onCommit, min = 0, max = 1, step, steps, detents, mapping, minSpan = 0,
    format = 'number', decimals = 2, unit, formatter, layout = 'integrated', labelWidth = 106,
    enabled: enabledProp, defaultEnabled = true, onEnabledChange, toggleable: toggleableProp, indicator, precision = 3,
    material, density, className, style, id,
  } = props;
  const quant = steps && steps > 1 ? steps : 0;
  const { toT, fromT, legal } = makeScale(min, max, mapping, quant);

  const [value, setValue] = useControllable<RangeValue>(valueProp, defaultValue ?? [min + (max - min) * 0.25, min + (max - min) * 0.75], onChange);
  const [enabled, setEnabled] = useControllable(enabledProp, defaultEnabled, onEnabledChange);
  const toggleable = toggleableProp ?? true;
  const [active, setActive] = useState<End>('hi');
  const [mode, setMode] = useState<Mode | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [ratio, setRatio] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [editing, setEditing] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const valRef = useRef<HTMLSpanElement>(null);
  const thumbs = { lo: useRef<HTMLSpanElement>(null), hi: useRef<HTMLSpanElement>(null) };
  const drag = useRef<Drag | null>(null);
  const live = useRef<RangeValue>(value);
  const dirRef = useRef({ v: value, d: [1, 1] });
  const clickMemo = useRef({ t: 0, v: value });
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const hudTokens = useRef<Record<string, string>>({});
  if (!drag.current) live.current = value;
  if (value[0] !== dirRef.current.v[0] || value[1] !== dirRef.current.v[1]) {
    const p = dirRef.current;
    dirRef.current = { v: value, d: [value[0] > p.v[0] ? 1 : value[0] < p.v[0] ? -1 : p.d[0], value[1] > p.v[1] ? 1 : value[1] < p.v[1] ? -1 : p.d[1]] };
  }

  const emit = (next: RangeValue) => {
    let [a, b] = next.map(legal) as RangeValue;
    if (b - a < minSpan) {
      if (drag.current?.end === 'lo' || (!drag.current && active === 'lo')) a = b - minSpan;
      else b = a + minSpan;
    }
    a = clamp(a, Math.min(min, max), Math.max(min, max));
    b = clamp(b, Math.min(min, max), Math.max(min, max));
    if (a === live.current[0] && b === live.current[1]) return;
    live.current = [a, b];
    setValue([a, b]);
  };
  const setEnd = (end: End, v: number) => {
    const [a, b] = live.current;
    emit(end === 'lo' ? [Math.min(v, b - minSpan), b] : [a, Math.max(v, a + minSpan)]);
  };
  const pulse = (k: string, ms = 200) => {
    clearTimeout(timers.current.f);
    setFlash(k);
    timers.current.f = setTimeout(() => setFlash(null), ms);
  };
  const geo = () => {
    const r = trackRef.current!.getBoundingClientRect();
    const inset = pxToken(trackRef.current, '--ar-inset', 2);
    return { left: r.left + inset, W: r.width - inset * 2 };
  };
  const hit = (x: number, g: { left: number; W: number }) => {
    const vr = valRef.current?.getBoundingClientRect() ?? null;
    const xa = g.left + toT(live.current[0]) * g.W;
    const xb = g.left + toT(live.current[1]) * g.W;
    const da = Math.abs(x - xa);
    const db = Math.abs(x - xb);
    if (Math.min(da, db) <= 7) return { z: 'seam', end: (da < db || (da === db && x < xa) ? 'lo' : 'hi') as End, vr };
    if (vr && x >= vr.left - 10) return { z: 'value', end: active, vr };
    if (Math.min(da, db) <= SEAM_GRAB) return { z: 'seam', end: (da < db ? 'lo' : 'hi') as End, vr };
    if (x > xa && x < xb) return { z: 'inside', end: active, vr };
    return { z: 'body', end: (da < db ? 'lo' : 'hi') as End, vr };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const now = performance.now();
    if (now - clickMemo.current.t > 420) clickMemo.current.v = live.current;
    clickMemo.current.t = now;
    e.preventDefault();
    if (!enabled) {
      thumbs[active].current?.focus({ preventScroll: true });
      return;
    }
    const g = geo();
    const { z, end, vr } = hit(e.clientX, g);
    const m: Mode = z === 'value' ? 'scrub' : z === 'seam' ? 'seam' : z === 'inside' ? 'span' : 'jump';
    setActive(end);
    thumbs[end].current?.focus({ preventScroll: true });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    hudTokens.current = snapshotTokens(rootRef.current, HUD_TOKENS);
    const cur = live.current[end === 'lo' ? 0 : 1];
    drag.current = {
      m, end, id: e.pointerId, v0: live.current, lx: e.clientX, vx: m === 'jump' ? e.clientX : g.left + toT(cur) * g.W, t: toT(cur),
      left: g.left, W: g.W, ox: vr ? vr.left + vr.width / 2 : e.clientX, oy: vr ? vr.top + vr.height / 2 : e.clientY, snap: null,
    };
    setMode(m);
    setRatio(1);
    if (m === 'jump') move(e, 0);
    else if (m === 'scrub') setHud({ kind: 'scrub', ox: drag.current.ox, oy: drag.current.oy, px: e.clientX, py: e.clientY });
  };
  const move = (e: ReactPointerEvent, dx: number) => {
    const d = drag.current!;
    if (d.m === 'scrub') {
      const r = Math.min(zoneRatio(e.clientY - d.oy, precision), modifierRatio(e, precision));
      d.t = clamp(d.t + (dx / d.W) * r, 0, 1);
      setRatio(r);
      setEnd(d.end, fromT(d.t));
      setHud({ kind: 'scrub', ox: d.ox, oy: d.oy, px: e.clientX, py: e.clientY });
      return;
    }
    const r = modifierRatio(e, precision);
    d.vx += dx * r;
    setRatio(r);
    if (d.m === 'span') {
      // the interval moves as one piece in position space; its value span is preserved at the edges
      const [a, b] = live.current;
      const dt = (dx * r) / d.W;
      const ta = toT(a);
      const tb = toT(b);
      const shift = clamp(dt, -ta, 1 - tb);
      emit([fromT(ta + shift), fromT(tb + shift)]);
      return;
    }
    let v = fromT(clamp((d.vx - d.left) / d.W, 0, 1));
    const [sv, sn] = applyDetent(v, d.W, snapKey(e), detents, toT, fromT, quant > 1);
    if (sn !== null && sn !== d.snap) pulse('snap');
    d.snap = sn;
    v = sv;
    setEnd(d.end, v);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) {
      if (e.pointerType !== 'mouse') return;
      const h = enabled ? hit(e.clientX, geo()) : null;
      const z = h ? (h.z === 'seam' ? 'seam' : h.z === 'value' ? 'value' : 'body') : 'off';
      if (z !== zone) setZone(z);
      return;
    }
    if (e.pointerId !== d.id) return;
    const dx = e.clientX - d.lx;
    d.lx = e.clientX;
    move(e, dx);
  };
  const end = (cancel: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (cancel) emit(d.v0);
    setMode(null);
    setRatio(1);
    setHud((h) => (h ? { ...h, leaving: true } : null));
    clearTimeout(timers.current.h);
    timers.current.h = setTimeout(() => setHud(null), 140);
    onCommit?.(live.current);
  };

  const nudge = (which: End, dir: number, e: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    const r = modifierRatio(e, precision);
    const cur = live.current[which === 'lo' ? 0 : 1];
    if (quant > 1) setEnd(which, fromT(toT(cur) + dir / (quant - 1)));
    else if (snapKey(e)) setEnd(which, nextDetent(cur, dir, detents, toT, fromT).value);
    else if (step) setEnd(which, cur + dir * step * r);
    else setEnd(which, fromT(toT(cur) + dir * 0.01 * r));
  };
  const onThumbKey = (which: End) => (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      if (drag.current) {
        e.preventDefault();
        end(true);
      }
      return;
    }
    if (!enabled) return;
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      setActive(which);
      setEditing(true);
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setEnd(which, e.key === 'Home' ? min : max);
      onCommit?.(live.current);
      return;
    }
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    nudge(which, dir, e);
    onCommit?.(live.current);
  };
  const shown = (v: number) => {
    const f = runFormat(v, { format, decimals, unit, formatter });
    return f.unit === 'kHz' ? f.text + 'k' : f.text;
  };
  const finishEdit = (text: string | null) => {
    setEditing(false);
    if (text !== null) {
      // "lo – hi" (en dash, em dash, ';', ' to ' or a spaced hyphen), or one number for the active end
      const parts = text.split(/\s*[\u2013\u2014;]\s*|\s+-\s+|\s+to\s+/i).filter(Boolean);
      const lim = (n: number) => (Number.isFinite(n) ? n : n < 0 ? Math.min(min, max) : Math.max(min, max));
      const a = parts[0] !== undefined ? parseTyped(parts[0], format) : null;
      const b = parts[1] !== undefined ? parseTyped(parts[1], format) : null;
      if (a !== null && b !== null) emit([Math.min(lim(a), lim(b)), Math.max(lim(a), lim(b))]);
      else if (a !== null) setEnd(active, lim(a));
      onCommit?.(live.current);
    }
    thumbs[active].current?.focus({ preventScroll: true });
  };

  /** Is the pointer on the readout itself? Double-click there types a value, whatever lies beneath. */
  const onReadout = (x: number, y: number) => {
    const r = valRef.current?.getBoundingClientRect();
    return !!r && x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;
  };
  const onDoubleClick = (e: ReactMouseEvent) => {
    if (enabled && onReadout(e.clientX, e.clientY)) {
      e.preventDefault();
      if (drag.current) end(false);
      setEditing(true);
      return;
    }
    if (!toggleable) return;
    e.preventDefault();
    if (drag.current) end(false);
    const next = !enabled;
    if (!next) emit(clickMemo.current.v);
    setEnabled(next);
    pulse(next ? 'on' : 'off', 320);
  };

  const wheelRef = useRef({ nudge, enabled });
  wheelRef.current = { nudge, enabled };
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      const which: End | null = document.activeElement === thumbs.lo.current ? 'lo' : document.activeElement === thumbs.hi.current ? 'hi' : null;
      if (!which || !wheelRef.current.enabled) return;
      const dv = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? -e.deltaY : e.deltaX;
      if (!dv) return;
      e.preventDefault();
      wheelRef.current.nudge(which, dv > 0 ? 1 : -1, e);
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  /* ---------- presentation ---------- */
  const dragging = !!mode;
  const extra = quant > 1 ? 0 : dragging ? extraDigits(ratio) : 0;
  const fa = runFormat(value[0], { format, decimals, extra, unit, formatter });
  const fb = runFormat(value[1], { format, decimals, extra, unit, formatter });
  const integrated = layout !== 'paired';
  const showDot = indicator ?? !!toggleableProp;
  const hot = mode === 'seam' || mode === 'jump' || mode === 'span' || flash === 'on' || flash === 'snap';
  const lo = toT(value[0]);
  const hi = toT(value[1]);
  const stepTicks = quant > 2 && quant <= 17 ? Array.from({ length: quant - 2 }, (_, i) => (i + 1) / (quant - 1)) : [];

  const dot = showDot ? <i className="ar-dot" data-on={enabled ? '' : undefined} /> : null;
  const content = (over: boolean) => (
    <div className={cx('ar-slider__content', over ? 'ar-slider__content--over' : 'ar-slider__content--base')} aria-hidden={over || undefined}>
      {dot}
      {integrated && label ? <span className={cx('ar-text ar-slider__label', over && 'ar-text--over')}>{label}</span> : null}
      <span ref={over ? undefined : valRef} className={cx('ar-value ar-slider__readout', over && 'ar-slider__readout--over')}>
        {editing && !over ? (
          <ValueEditor initial={shown(live.current[0]) + ' – ' + shown(live.current[1])} label={(props['aria-label'] ?? label ?? 'Range') + ' — type lo – hi'} onDone={finishEdit} />
        ) : (
          <>
            <RollingValue text={fa.text} dir={dirRef.current.d[0]} fast={dragging} base={decimals} />
            <span className="ar-range__sep">–</span>
            <RollingValue text={fb.text} unit={fb.unit} dir={dirRef.current.d[1]} fast={dragging} base={decimals} />
          </>
        )}
      </span>
    </div>
  );
  const thumb = (which: End, v: number, f: ReturnType<typeof runFormat>) => (
    <span
      ref={thumbs[which]}
      className="ar-range__thumb"
      role="slider"
      tabIndex={0}
      aria-label={(props['aria-label'] ?? label ?? 'Range') + (which === 'lo' ? ' minimum' : ' maximum')}
      aria-valuemin={which === 'lo' ? min : value[0]}
      aria-valuemax={which === 'lo' ? value[1] : max}
      aria-valuenow={v}
      aria-valuetext={joinFormatted(f)}
      aria-disabled={!enabled || undefined}
      onFocus={(e: ReactFocusEvent) => e.target === e.currentTarget && setActive(which)}
      onKeyDown={onThumbKey(which)}
    />
  );

  return (
    <div
      ref={rootRef}
      id={id}
      role="group"
      aria-label={props['aria-label'] ?? label}
      {...scopeAttrs({ material, density })}
      data-variant="range"
      data-active={active}
      data-mode={mode ?? undefined}
      data-zone={zone ?? undefined}
      data-flash={flash ?? undefined}
      data-hot={hot && enabled ? '' : undefined}
      data-off={enabled ? undefined : ''}
      data-quant={quant > 1 ? '' : undefined}
      data-interacting={dragging ? 'true' : undefined}
      data-editing={editing ? '' : undefined}
      onBlur={(e) => !rootRef.current?.contains(e.relatedTarget as Node) && drag.current && end(false)}
      className={cx('ar-slider ar-range', className)}
      style={{ ...(integrated ? null : ({ '--_lw': typeof labelWidth === 'number' ? labelWidth + 'px' : labelWidth } as CSSProperties)), ...style }}
    >
      {!integrated && label ? <span className="ar-text ar-slider__side">{label}</span> : null}
      <div
        ref={trackRef}
        className="ar-well ar-slider__track"
        style={{ '--ar-lo': lo, '--ar-hi': hi } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => drag.current && e.pointerId === drag.current.id && end(false)}
        onPointerCancel={() => end(true)}
        onPointerLeave={() => !drag.current && zone && setZone(null)}
        onDoubleClick={onDoubleClick}
      >
        <div className="ar-insert ar-slider__fill" />
        <div className="ar-slider__offline" />
        {(detents ?? []).map((m, i) => (
          <i key={'d' + i} className="ar-slider__mark ar-slider__mark--detent" style={{ '--_m': toT(m) } as CSSProperties} />
        ))}
        {stepTicks.map((m, i) => (
          <i key={'s' + i} className="ar-slider__mark ar-slider__mark--step" style={{ '--_m': m } as CSSProperties} />
        ))}
        <i className="ar-seam ar-slider__seam ar-slider__seam--lo" />
        <i className="ar-seam ar-slider__seam ar-slider__seam--hi" />
        {content(false)}
        {content(true)}
        {thumb('lo', value[0], fa)}
        {thumb('hi', value[1], fb)}
      </div>
      {hud ? <Hud h={hud} text={joinFormatted(active === 'lo' ? fa : fb)} ratio={ratio} levels={precision} tokens={hudTokens.current} /> : null}
    </div>
  );
}
