'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { RollingValue } from '../system/RollingValue';
import { useControllable, useSafeId } from '../system/hooks';
import { clamp, cx, GRADIENTS, gradientCss, joinFormatted, luminance, pxToken, reducedMotion, runFormat, sampleStops, scopeAttrs, snapshotTokens } from '../system/utils';
import type { Format, Formatter, Gradient, GradientName, Mapping, ScopeProps } from '../system/utils';
import { applyDetent, CURVES, extraDigits, majorEvery, makeScale, modifierRatio, nextDetent, niceUnit, parseTyped, SEAM_GRAB, snapKey, zoneRatio } from './engine';
import type { CurveName, PrecisionLevels } from './engine';
import { Hud, HUD_TOKENS, ValueEditor } from './parts';
import type { HudState } from './parts';
import './Slider.css';

/* ARTINOS Slider — one compact precision surface.
 *
 * The capsule is the slider, the seam is the handle, the readout is the
 * precision scrub zone.
 *   body press   → value jumps there, keeps dragging
 *   seam press   → grabs the value, no jump (±13 px)
 *   value press  → precision scrub: vertical distance picks 1× · 0.1× · 0.01×, local HUD
 *   double-click the value (or Enter / F2) → type a value in the readout's own units
 *   double-click the body → switch the parameter off / back on, value preserved (on by default; toggleable={false} opts out)
 *   Alt fine · Shift ultra-fine · Ctrl snap · Esc cancels · wheel only when focused
 *
 * Variants: material · stepped · gradient · ruler (scale moves under a fixed
 * index) · curve · wave. Every visual is a token — see tokens/materials.css.
 */

export type SliderVariant = 'material' | 'stepped' | 'gradient' | 'ruler' | 'curve' | 'wave';
export type SliderStatus = 'bound' | 'automated' | 'warn' | 'fault';

export interface SliderProps extends ScopeProps {
  label?: string;
  value?: number;
  defaultValue?: number;
  /** Live, on every change. */
  onChange?: (value: number) => void;
  /** Once, on release. */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  /** Keyboard / wheel increment. Default 1% of the range. */
  step?: number;
  /** Quantize to n values (true steps, not just drawing). Stepped variant draws cells. */
  steps?: number;
  /** Semantic magnetic points (6 px magnet, 22 px with Ctrl). */
  detents?: number[];
  /** Geometry only — the value stays exact. linear · log · exp · power or { to, from }. */
  mapping?: Mapping;
  /** Fill grows from this value instead of min. */
  origin?: number;
  /** Shorthand: origin at 0 (or the midpoint when 0 is out of range). */
  bipolar?: boolean;
  format?: Format;
  decimals?: number;
  unit?: string;
  formatter?: Formatter;
  variant?: SliderVariant;
  /** Gradient variant: preset name or { stops, describe }. */
  gradient?: GradientName | Gradient;
  /** Gradient variant: caption shown in the swatch while dragging. */
  describe?: Gradient['describe'];
  /** integrated: label inside the capsule · paired: label outside. */
  layout?: 'integrated' | 'paired';
  labelWidth?: number | string;
  enabled?: boolean;
  defaultEnabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /** Double-click the body switches the parameter off and back on. Default: true; pass false to opt out. */
  toggleable?: boolean;
  /** Show the enable dot. Default: on when toggleable is passed explicitly, or with a status. */
  indicator?: boolean;
  /** 2 → 1× · 0.1×   3 → 1× · 0.1× · 0.01× */
  precision?: PrecisionLevels;
  /** Ruler: value span visible across the viewport. */
  span?: number;
  /** Ruler: highlighted, lightly magnetic positions. */
  marks?: number[];
  /** Ruler: settle to this grid on release. */
  snapStep?: number;
  /** Curve variant: response the value samples. */
  curve?: CurveName | ((x: number) => number);
  /** Wave variant: 0..1 amplitudes drawn under the playhead. */
  samples?: number[];
  /** Subtle semantic state on the seam and indicator. */
  status?: SliderStatus;
  className?: string;
  style?: CSSProperties;
  id?: string;
  'aria-label'?: string;
}

type Mode = 'scrub' | 'ruler' | 'seam' | 'jump';
type Zone = 'seam' | 'value' | 'body' | 'off' | null;
interface Geo {
  left: number;
  W: number;
  r: DOMRect;
}
interface Drag {
  m: Mode;
  id: number;
  v0: number;
  lx: number;
  vx: number;
  t: number;
  g: Geo;
  ox: number;
  oy: number;
  snap: number | null;
  maj: number | null;
}

export function Slider(props: SliderProps) {
  const {
    label, value: valueProp, defaultValue, onChange, onCommit,
    min = 0, max = 1, step, steps, detents, mapping, origin, bipolar,
    format = 'number', decimals = 2, unit, formatter,
    variant = 'material', gradient = 'temperature', describe, layout = 'integrated', labelWidth = 106,
    enabled: enabledProp, defaultEnabled = true, onEnabledChange, toggleable: toggleableProp, indicator,
    precision = 3, span, marks, snapStep, curve = 'sigmoid', samples, status,
    material, density, className, style, id,
  } = props;

  const tall = variant === 'curve' || variant === 'wave';
  const quant = variant === 'stepped' ? steps || 6 : steps && steps > 1 ? steps : 0;
  const { toT, fromT, qT, legal } = makeScale(min, max, mapping, quant);
  const tToP = (t: number) => (variant === 'stepped' ? (Math.round(t * (quant - 1)) + 1) / quant : t);
  const pToT = (p: number) => (variant === 'stepped' ? Math.floor(clamp(p, 0, 0.9999) * quant) / (quant - 1) : clamp(p, 0, 1));
  const G: Gradient | null = variant === 'gradient' ? (typeof gradient === 'string' ? GRADIENTS[gradient] ?? GRADIENTS.temperature : gradient) : null;
  const sampleG = (t: number) => sampleStops(G!.stops, t);
  const originV = origin ?? (bipolar ? (min < 0 && max > 0 ? 0 : (min + max) / 2) : null);

  const [value, setValue] = useControllable(valueProp, defaultValue ?? min, onChange);
  const [enabled, setEnabled] = useControllable(enabledProp, defaultEnabled, onEnabledChange);
  const toggleable = toggleableProp ?? true;
  const [mode, setMode] = useState<Mode | null>(null);
  const [zone, setZone] = useState<Zone>(null);
  const [ratio, setRatio] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [kbExtra, setKbExtra] = useState(0);
  const [editing, setEditing] = useState(false);
  const [size, setSize] = useState({ w: 200, h: 26 });
  const [zoom, setZoom] = useState(1);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const valRef = useRef<HTMLSpanElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const drag = useRef<Drag | null>(null);
  const live = useRef(value);
  const dirRef = useRef({ v: value, d: 1 });
  const clickMemo = useRef({ t: 0, v: value });
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const zoomRef = useRef(1);
  const insetRef = useRef(2);
  const hudTokens = useRef<Record<string, string>>({});
  const clipId = useSafeId('arc');
  if (!drag.current) live.current = value;
  if (value !== dirRef.current.v) dirRef.current = { v: value, d: value > dirRef.current.v ? 1 : -1 };

  const emit = (v: number) => {
    v = legal(v);
    if (v === live.current) return;
    live.current = v;
    setValue(v);
  };
  const pulse = (k: string, ms = 200) => {
    clearTimeout(timers.current.f);
    setFlash(k);
    timers.current.f = setTimeout(() => setFlash(null), ms);
  };
  const ppu = (z?: number) => (size.w / (span || (max - min) / 4)) * (z ?? zoom);

  const geo = (): Geo => {
    const r = trackRef.current!.getBoundingClientRect();
    const inset = insetRef.current;
    return tall ? { left: r.left + 10, W: r.width - 20, r } : { left: r.left + inset, W: r.width - inset * 2, r };
  };
  const seamT = () => {
    const t = toT(live.current);
    return variant === 'stepped' ? tToP(t) : t;
  };
  const hit = (x: number, y: number, g: Geo): { z: Zone; vr: DOMRect | null } => {
    const vr = valRef.current ? valRef.current.getBoundingClientRect() : null;
    const inVal = !!vr && (tall ? x >= vr.left - 10 && x <= vr.right + 10 && y >= vr.top - 8 && y <= vr.bottom + 8 : x >= vr.left - 10);
    if (variant === 'ruler' || variant === 'stepped') return { z: inVal ? 'value' : 'body', vr };
    const d = Math.abs(x - (g.left + seamT() * g.W));
    return { z: d <= 7 ? 'seam' : inVal ? 'value' : d <= SEAM_GRAB ? 'seam' : 'body', vr };
  };

  const swatch = (v: number) => {
    const d = drag.current;
    if (!d || !G) return;
    const t = toT(v);
    const col = sampleG(t);
    const cap = (describe ?? G.describe ?? (() => joinFormatted(runFormat(v, { format, decimals, unit, formatter }))))(t, col, v);
    setHud({ kind: 'swatch', sx: d.g.left + t * d.g.W, sy: d.g.r.bottom, color: col, caption: cap });
  };

  const moveBody = (e: ReactPointerEvent, dx: number) => {
    const d = drag.current!;
    const r = modifierRatio(e, precision);
    d.vx += dx * r;
    let v = fromT(pToT((d.vx - d.g.left) / d.g.W));
    const [sv, sn] = applyDetent(v, d.g.W, snapKey(e), detents, toT, fromT, quant > 1);
    if (sn !== null && sn !== d.snap) pulse('snap');
    d.snap = sn;
    v = sv;
    setRatio(r);
    emit(v);
    swatch(v);
  };
  const moveScrub = (e: ReactPointerEvent, dx: number) => {
    const d = drag.current!;
    const r = Math.min(zoneRatio(e.clientY - d.oy, precision), modifierRatio(e, precision));
    let v: number;
    if (variant === 'ruler') v = live.current + (dx / ppu(1)) * r;
    else {
      d.t = clamp(d.t + (dx / d.g.W) * r, 0, 1);
      v = fromT(d.t);
      if (snapKey(e)) {
        const [sv, sn] = applyDetent(v, d.g.W, true, detents, toT, fromT, quant > 1);
        if (sn !== null && sn !== d.snap) pulse('snap');
        d.snap = sn;
        v = sv;
      }
    }
    setRatio(r);
    emit(v);
    setHud({ kind: 'scrub', ox: d.ox, oy: d.oy, px: e.clientX, py: e.clientY });
  };
  const moveRuler = (e: ReactPointerEvent, dx: number) => {
    const d = drag.current!;
    const r = modifierRatio(e, precision);
    let v = live.current - dx / ppu(); // precision here is the zoom: the engraving spreads, the hand stays 1:1 with the scale
    const list = marks ?? detents ?? [];
    let sn: number | null = null;
    for (const m of list) if (Math.abs(m - v) * ppu() <= (snapKey(e) ? 22 : 5)) {
      sn = m;
      v = m;
    }
    if (sn !== null && sn !== d.snap) pulse('snap');
    d.snap = sn;
    const u = niceUnit(6 / ppu());
    const mk = Math.floor(v / (u * majorEvery(u)));
    if (d.maj !== null && mk !== d.maj && sn === null) pulse('tick', 110); // index crossing a major tick
    d.maj = mk;
    setRatio(r);
    emit(v);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const now = performance.now();
    if (now - clickMemo.current.t > 420) clickMemo.current.v = live.current;
    clickMemo.current.t = now;
    e.preventDefault();
    rootRef.current?.focus({ preventScroll: true });
    if (!enabled) return;
    insetRef.current = pxToken(trackRef.current, '--ar-inset', 2);
    measure();
    const g = geo();
    const x = e.clientX;
    const y = e.clientY;
    const t0 = toT(live.current);
    const { z, vr } = hit(x, y, g);
    const m: Mode = z === 'value' ? 'scrub' : variant === 'ruler' ? 'ruler' : z === 'seam' ? 'seam' : 'jump';
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    hudTokens.current = snapshotTokens(rootRef.current, HUD_TOKENS);
    drag.current = {
      m, id: e.pointerId, v0: live.current, lx: x, vx: m === 'jump' ? x : g.left + tToP(t0) * g.W, t: t0, g,
      ox: vr ? vr.left + vr.width / 2 : x, oy: vr ? vr.top + vr.height / 2 : y, snap: null, maj: null,
    };
    setMode(m);
    setRatio(1);
    if (m === 'jump') moveBody(e, 0);
    else if (m === 'scrub') setHud({ kind: 'scrub', ox: drag.current.ox, oy: drag.current.oy, px: x, py: y });
    else swatch(live.current);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) {
      if (e.pointerType !== 'mouse') return;
      const z: Zone = enabled ? hit(e.clientX, e.clientY, geo()).z : 'off';
      if (z !== zone) setZone(z);
      return;
    }
    if (e.pointerId !== d.id) return;
    const dx = e.clientX - d.lx;
    d.lx = e.clientX;
    if (d.m === 'scrub') moveScrub(e, dx);
    else if (d.m === 'ruler') moveRuler(e, dx);
    else moveBody(e, dx);
  };
  const end = (cancel: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (cancel) emit(d.v0);
    else if (variant === 'ruler' && snapStep) {
      const prev = live.current;
      const target = Math.round(prev / snapStep) * snapStep;
      emit(target);
      if (gRef.current && !reducedMotion() && target !== prev)
        gRef.current.animate([{ transform: `translateX(${(target - prev) * ppu(1)}px)` }, { transform: 'translateX(0)' }], { duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
    setMode(null);
    setRatio(1);
    setHud((h) => (h ? { ...h, leaving: true } : null));
    clearTimeout(timers.current.h);
    timers.current.h = setTimeout(() => setHud(null), 140);
    onCommit?.(live.current);
  };

  const nudge = (dir: number, e: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    const r = modifierRatio(e, precision);
    const cur = live.current;
    if (quant > 1) {
      emit(fromT(qT(toT(cur) + dir / (quant - 1))));
      return;
    }
    if (snapKey(e)) {
      const n = nextDetent(cur, dir, detents ?? marks, toT, fromT);
      emit(n.value);
      if (n.detent) pulse('snap');
      return;
    }
    if (step) emit(cur + dir * step * r);
    else emit(fromT(toT(cur) + dir * 0.01 * r));
    if (r < 1) {
      setKbExtra(extraDigits(r));
      clearTimeout(timers.current.k);
      timers.current.k = setTimeout(() => setKbExtra(0), 1100);
    }
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
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
      startEdit();
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      emit(e.key === 'Home' ? min : max);
      onCommit?.(live.current);
      return;
    }
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    nudge(dir, e);
    onCommit?.(live.current);
  };
  /* typed entry: the readout becomes a field in its own units */
  const startEdit = () => {
    if (!enabled) return;
    if (drag.current) end(false);
    setEditing(true);
  };
  const editInitial = () => {
    const f = runFormat(live.current, { format, decimals, unit, formatter });
    const text = f.unit === 'kHz' ? f.text + 'k' : f.text;
    return parseTyped(text, format) === null ? String(+live.current.toFixed(decimals + 2)) : text;
  };
  const finishEdit = (text: string | null) => {
    setEditing(false);
    if (text !== null) {
      const n = parseTyped(text, format);
      if (n !== null && !Number.isNaN(n)) {
        emit(Number.isFinite(n) ? n : n < 0 ? Math.min(min, max) : Math.max(min, max));
        onCommit?.(live.current);
      }
    }
    rootRef.current?.focus({ preventScroll: true });
  };

  /** Is the pointer on the readout itself? Double-click there types a value, whatever lies beneath. */
  const onReadout = (x: number, y: number) => {
    const r = valRef.current?.getBoundingClientRect();
    return !!r && x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;
  };
  const onDoubleClick = (e: ReactMouseEvent) => {
    if (enabled && onReadout(e.clientX, e.clientY)) {
      e.preventDefault();
      startEdit();
      return;
    }
    if (!toggleable) return;
    e.preventDefault();
    if (drag.current) end(false);
    const next = !enabled;
    if (!next) emit(clickMemo.current.v); // the first click of the pair must not cost the stored value
    setEnabled(next);
    pulse(next ? 'on' : 'off', 320);
  };

  /* wheel: guarded — edits only a focused, enabled slider */
  const wheelRef = useRef({ nudge, enabled });
  wheelRef.current = { nudge, enabled };
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      if (document.activeElement !== el || !wheelRef.current.enabled) return;
      const dv = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? -e.deltaY : e.deltaX;
      if (!dv) return;
      e.preventDefault();
      wheelRef.current.nudge(dv > 0 ? 1 : -1, e);
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, []);

  /* viewport size for ruler / plots */
  const measure = () => {
    const el = viewRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w > 0 && (w !== size.w || h !== size.h)) setSize({ w, h });
  };
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const set = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) setSize((s) => (Math.round(r.width) === s.w && Math.round(r.height) === s.h ? s : { w: Math.round(r.width), h: Math.round(r.height) }));
    };
    set();
    document.fonts?.ready.then(set);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant]);

  /* ruler precision zoom: the engraving spreads while scrubbing finely */
  const zoomTarget = variant === 'ruler' && mode ? 1 / Math.sqrt(ratio) : 1;
  useEffect(() => {
    const from = zoomRef.current;
    const to = zoomTarget;
    if (from === to) return;
    if (reducedMotion()) {
      zoomRef.current = to;
      setZoom(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const f = (now: number) => {
      const k = Math.min(1, (now - t0) / 220);
      const z = from + (to - from) * (1 - Math.pow(1 - k, 3));
      zoomRef.current = z;
      setZoom(z);
      if (k < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [zoomTarget]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  /* ---------- derived presentation ---------- */
  const t = toT(value);
  const dragging = !!mode;
  const extra = quant > 1 ? 0 : dragging ? extraDigits(ratio) : kbExtra;
  const fv = runFormat(value, { format, decimals, extra, unit, formatter });
  const hudText = joinFormatted(fv);
  const integrated = layout !== 'paired';
  const showDot = indicator ?? (!!toggleableProp || !!status);
  const hot = mode === 'seam' || mode === 'jump' || mode === 'ruler' || flash === 'on' || flash === 'snap' || flash === 'tick';

  // fill span [lo, hi] and the seam: inside the active end
  let lo = 0;
  let hi = tToP(t);
  let seamP = hi;
  let sd = -1;
  if (originV !== null && variant === 'material') {
    const o = toT(originV);
    lo = Math.min(o, t);
    hi = Math.max(o, t);
    seamP = t;
    sd = Math.abs(t - o) < 1e-9 ? 0 : t > o ? -1 : 1;
  }
  if (variant === 'gradient') sd = 0;

  const dot = showDot ? <i className="ar-dot" data-on={enabled ? '' : undefined} /> : null;
  const labelEl = (over: boolean) => (integrated && label ? <span className={cx('ar-text ar-slider__label', over && 'ar-text--over')}>{label}</span> : null);
  const editor = <ValueEditor initial={editInitial()} label={(props['aria-label'] ?? label ?? 'Value') + ' — type a value'} onDone={finishEdit} />;
  const readout = (over: boolean) => (
    <span ref={over ? undefined : valRef} className={cx('ar-value ar-slider__readout', over && 'ar-slider__readout--over')}>
      {editing && !over ? editor : <RollingValue text={fv.text} unit={fv.unit} dir={dirRef.current.d} fast={dragging} base={decimals} />}
    </span>
  );
  const markTicks = (list: number[] | null | undefined, kind: string) =>
    (list ?? []).map((m, i) => <i key={kind + i} className={'ar-slider__mark ar-slider__mark--' + kind} style={{ '--_m': toT(m) } as CSSProperties} />);

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent) => drag.current && e.pointerId === drag.current.id && end(false),
    onPointerCancel: () => end(true),
    onPointerEnter: () => {
      insetRef.current = pxToken(trackRef.current, '--ar-inset', 2);
    },
    onPointerLeave: () => !drag.current && zone && setZone(null),
    onDoubleClick,
  };
  const trackVars = { '--ar-lo': lo, '--ar-hi': hi, '--ar-p': seamP, '--_sd': sd } as CSSProperties;

  let track;
  if (variant === 'material' || variant === 'stepped') {
    const lit = Math.round(t * (quant - 1)) + 1;
    const stepTicks = quant > 2 && quant <= 17 && variant === 'material' ? Array.from({ length: quant - 2 }, (_, i) => fromT((i + 1) / (quant - 1))) : null;
    track = (
      <div ref={trackRef} {...handlers} className="ar-well ar-slider__track" style={trackVars}>
        {variant === 'stepped' ? (
          <div className="ar-slider__cells">
            {Array.from({ length: quant }, (_, i) => (
              <i key={i} className="ar-slider__cell" data-lit={i < lit ? '' : undefined} />
            ))}
          </div>
        ) : (
          <div className="ar-insert ar-slider__fill" />
        )}
        <div className="ar-slider__offline" />
        {originV !== null && variant === 'material' ? markTicks([originV], 'origin') : null}
        {markTicks(detents, 'detent')}
        {markTicks(stepTicks, 'step')}
        {variant === 'material' ? <i className="ar-seam ar-slider__seam" /> : null}
        <div className="ar-slider__content ar-slider__content--base">
          {dot}
          {labelEl(false)}
          {readout(false)}
        </div>
        <div className="ar-slider__content ar-slider__content--over" aria-hidden="true">
          {dot}
          {labelEl(true)}
          {readout(true)}
        </div>
      </div>
    );
  } else if (variant === 'gradient') {
    const inkAt = (p: number) => (luminance(sampleG(p)) > 0.2 ? 'dark' : 'light');
    track = (
      <div ref={trackRef} {...handlers} className="ar-well ar-slider__track ar-slider__track--gradient" style={trackVars}>
        <div className="ar-slider__grad" style={{ background: gradientCss(G!) }} />
        <div className="ar-slider__sheen" />
        <div className="ar-slider__gradwell" />
        {markTicks(detents, 'detent')}
        <i className="ar-seam ar-slider__seam ar-slider__seam--grad" />
        <div className="ar-slider__content">
          {dot}
          {integrated && label ? (
            <span className="ar-text ar-slider__label" data-ink={inkAt(0.08)}>
              {label}
            </span>
          ) : null}
          <span ref={valRef} className="ar-value ar-slider__readout" data-ink={inkAt(0.93)}>
            {editing ? editor : <RollingValue text={fv.text} unit={fv.unit} dir={dirRef.current.d} fast={dragging} base={decimals} />}
          </span>
        </div>
      </div>
    );
  } else if (variant === 'ruler') {
    const W = size.w;
    const H = size.h || 30;
    const pp = ppu();
    const u = niceUnit(6 / pp);
    const maj = u * majorEvery(u);
    const labelEvery = [1, 2, 5, 10, 20].find((k) => maj * k * pp >= 40) || 20;
    const lu = maj * labelEvery;
    const decs = Math.max(0, -Math.floor(Math.log10(lu) + 1e-9));
    const half = W / 2 / pp;
    const lo2 = Math.max(min, value - half - u);
    const hi2 = Math.min(max, value + half + u);
    const minorOp = clamp((u * pp - 5) / 6, 0.3, 1);
    const base = H - 8;
    const near = (a: number, q: number) => Math.abs(Math.round(a / q) * q - a) < u * 1e-3;
    const ticks = [];
    for (let i = Math.ceil(lo2 / u - 1e-9), n = 0; i * u <= hi2 + 1e-9 && n < 500; i++, n++) {
      const tv = i * u;
      const x = W / 2 + (tv - value) * pp;
      const isMaj = near(tv, maj);
      ticks.push(<line key={'t' + i} className={isMaj ? 'ar-ruler__major' : 'ar-ruler__minor'} x1={x} x2={x} y1={base - (isMaj ? 7 : 3.5)} y2={base} opacity={isMaj ? 1 : minorOp} />);
      if (isMaj && near(tv, lu))
        ticks.push(
          <text key={'l' + i} className="ar-ruler__num" x={x} y={10.5} textAnchor="middle">
            {Number(tv.toFixed(decs)).toString()}
          </text>,
        );
    }
    (marks ?? []).forEach((m, i) => {
      if (m >= lo2 && m <= hi2) {
        const x = W / 2 + (m - value) * pp;
        ticks.push(<line key={'m' + i} className="ar-ruler__mark" x1={x} x2={x} y1={base - 9} y2={base} />);
      }
    });
    track = (
      <div ref={trackRef} {...handlers} className="ar-well ar-slider__track ar-slider__track--ruler">
        {dot || (integrated && label) ? (
          <div className="ar-slider__lead">
            {dot}
            {labelEl(false)}
          </div>
        ) : null}
        <div ref={viewRef} className="ar-slider__view">
          <svg className="ar-ruler" width={W} height={H}>
            <g ref={gRef}>{ticks}</g>
          </svg>
          <i className="ar-ruler__index" style={{ left: W / 2 }} />
          <i className="ar-ruler__foot" style={{ left: W / 2 }} />
        </div>
        <div className="ar-slider__tail">{readout(false)}</div>
      </div>
    );
  } else {
    const W = size.w;
    const ch = size.h || 28;
    const f = variant === 'curve' ? (typeof curve === 'function' ? curve : CURVES[curve] ?? CURVES.sigmoid) : null;
    const pts: Array<[number, number]> = [];
    if (f) for (let i = 0; i <= 64; i++) pts.push([(i / 64) * W, ch - f(i / 64) * ch]);
    else {
      const s = samples?.length ? samples : [0];
      s.forEach((a, i) => pts.push([(i / Math.max(1, s.length - 1)) * W, ch - clamp(a, 0, 1) * ch * 0.95]));
    }
    const d = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
    const px = t * W;
    const py = f ? ch - f(t) * ch : 0;
    track = (
      <div ref={trackRef} {...handlers} className="ar-well ar-slider__track ar-slider__track--tall">
        <div className="ar-slider__corner ar-slider__corner--label">
          {dot}
          {labelEl(false)}
        </div>
        <div className="ar-slider__corner ar-slider__corner--value">{readout(false)}</div>
        <div ref={viewRef} className="ar-slider__plot">
          <svg width={W} height={ch}>
            <defs>
              <clipPath id={clipId}>
                <rect x="-2" y="-10" width={Math.max(0, px + 2)} height={ch + 20} />
              </clipPath>
            </defs>
            <path className="ar-plot__base" d={d} />
            <path className="ar-plot__live" d={d} clipPath={`url(#${clipId})`} />
            {f ? <line className="ar-plot__drop" x1={px} x2={px} y1={py} y2={ch} /> : null}
          </svg>
          {f ? (
            <>
              <i className="ar-plot__point" style={{ left: px, top: py }} />
              <i className="ar-plot__foot" style={{ left: px, top: ch }} />
            </>
          ) : (
            <i className="ar-plot__head" style={{ left: px }} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      id={id}
      tabIndex={0}
      role="slider"
      aria-label={props['aria-label'] ?? label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={hudText}
      aria-orientation="horizontal"
      aria-disabled={!enabled || undefined}
      {...scopeAttrs({ material, density })}
      data-variant={variant}
      data-layout={integrated ? undefined : 'paired'}
      data-mode={mode ?? undefined}
      data-zone={zone ?? undefined}
      data-flash={flash ?? undefined}
      data-hot={hot && enabled ? '' : undefined}
      data-off={enabled ? undefined : ''}
      data-quant={quant > 1 ? '' : undefined}
      data-status={status}
      data-interacting={dragging ? 'true' : undefined}
      data-editing={editing ? '' : undefined}
      onKeyDown={onKeyDown}
      onBlur={() => drag.current && end(false)}
      className={cx('ar-slider ar-focus-host', className)}
      style={{ ...(integrated ? null : ({ '--_lw': typeof labelWidth === 'number' ? labelWidth + 'px' : labelWidth } as CSSProperties)), ...style }}
    >
      {!integrated && label ? <span className="ar-text ar-slider__side">{label}</span> : null}
      {track}
      {hud ? <Hud h={hud} text={hudText} ratio={ratio} levels={precision} tokens={hudTokens.current} /> : null}
    </div>
  );
}
