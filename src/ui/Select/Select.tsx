'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useControllable, useSafeId } from '../system/hooks';
import { normalizeOptions } from '../system/options';
import type { OptionInput } from '../system/options';
import { cx, reducedMotion, scopeAttrs, snapshotTokens } from '../system/utils';
import type { ScopeProps } from '../system/utils';
import './Select.css';

/* ARTINOS Select — closed, a full-width insert with a chevron (or a quiet well with
   `appearance="well"`); open, it extends downward into a glass list panel,
   portalled to <body> so docks and clipped panels never cut it off.
   Arrow keys, Home/End, Enter, Escape and type-ahead work throughout. */

export interface SelectProps<V extends string = string> extends ScopeProps {
  /** Placeholder when nothing is chosen, and the accessible name. */
  label?: string;
  options: readonly OptionInput<V>[];
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
  appearance?: 'insert' | 'well';
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

/** Tokens the portalled panel carries out of its theme scope. */
const LIST_TOKENS = [
  '--ar-h', '--ar-radius', '--ar-inset', '--ar-insert-radius', '--ar-label-size', '--ar-label-bump', '--ar-label-weight', '--ar-label-tracking',
  '--ar-label-case', '--ar-control-font', '--ar-list-bg', '--ar-list-backdrop', '--ar-list-shadow', '--ar-list-insert', '--ar-list-insert-blend',
  '--ar-list-insert-shadow', '--ar-list-ink', '--ar-list-ink-hi', '--ar-list-text-shadow', '--ar-list-hover', '--ar-led-on', '--ar-led-glow',
  '--ar-led-off', '--ar-ease', '--ar-dur-surface',
] as const;

const Chevron = ({ up }: { up?: boolean }) => (
  <svg className="ar-chevron" data-up={up ? '' : undefined} viewBox="0 0 10 6" aria-hidden="true">
    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Select<V extends string = string>({ label, options, value, defaultValue, onChange, appearance = 'insert', disabled, material, density, className, style, id }: SelectProps<V>) {
  const opts = normalizeOptions(options);
  const [cur, setCur] = useControllable<V | undefined>(value, defaultValue, onChange as ((v: V | undefined) => void) | undefined);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tokens = useRef<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const typed = useRef({ s: '', t: 0 });
  const listId = useSafeId('arl');

  const current = opts.find((o) => o.value === cur);
  const show = () => {
    if (disabled || !ref.current) return;
    tokens.current = snapshotTokens(ref.current, LIST_TOKENS);
    setRect(ref.current.getBoundingClientRect());
    setHi(Math.max(0, opts.findIndex((o) => o.value === cur)));
    setOpen(true);
  };
  const close = () => setOpen(false);
  const pick = (v: V) => {
    setCur(v);
    close();
    ref.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !panel.current?.contains(t)) close();
    };
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);
  useLayoutEffect(() => {
    const p = panel.current;
    if (!open || !p?.animate || reducedMotion() || !rect) return;
    const r = getComputedStyle(p).borderRadius;
    p.animate([{ clipPath: `inset(0 0 calc(100% - ${rect.height}px) 0 round ${r})` }, { clipPath: `inset(0 0 0 0 round ${r})` }], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }, [open, rect]);

  const move = (i: number) => {
    const n = opts.length;
    for (let k = 0; k < n; k++) {
      const j = (((i + k) % n) + n) % n;
      if (!opts[j].disabled) return setHi(j);
    }
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        close();
      }
      return;
    }
    if (e.key === 'Tab') return close();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return show();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      let j = hi;
      for (let k = 0; k < opts.length; k++) {
        j = (j + d + opts.length) % opts.length;
        if (!opts[j].disabled) break;
      }
      setHi(j);
      return;
    }
    if (open && (e.key === 'Home' || e.key === 'End')) {
      e.preventDefault();
      return move(e.key === 'Home' ? 0 : opts.length - 1);
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && hi >= 0 && !opts[hi].disabled) pick(opts[hi].value);
      else show();
      return;
    }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      // type-ahead
      const now = performance.now();
      typed.current = { s: (now - typed.current.t < 600 ? typed.current.s : '') + e.key.toLowerCase(), t: now };
      const j = opts.findIndex((o) => !o.disabled && String(typeof o.label === 'string' ? o.label : o.value).toLowerCase().startsWith(typed.current.s));
      if (j >= 0) {
        if (open) setHi(j);
        else setCur(opts[j].value);
      }
    }
  };

  const text = current?.label ?? label;
  const pnl =
    open && rect ? (
      <div
        ref={panel}
        id={listId}
        role="listbox"
        aria-label={label}
        className="ar-list"
        style={{ ...tokens.current, left: rect.left, top: rect.top, width: rect.width, '--_head': rect.height + 'px' } as CSSProperties}
      >
        <span className="ar-list__insert" />
        <div className="ar-list__head" onClick={close}>
          <span className="ar-text ar-list__text">{text}</span>
          <Chevron up />
        </div>
        {opts.map((o, i) => (
          <div
            key={o.value}
            role="option"
            aria-selected={o.value === cur}
            aria-disabled={o.disabled || undefined}
            data-hi={i === hi ? '' : undefined}
            onPointerEnter={() => !o.disabled && setHi(i)}
            onClick={() => !o.disabled && pick(o.value)}
            className="ar-list__row"
          >
            <span className="ar-list__led">{o.value === cur ? <i className="ar-led" data-on="" /> : null}</span>
            {o.icon ? <span className="ar-icon">{o.icon}</span> : null}
            <span className="ar-text ar-list__text">{o.label}</span>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div
      ref={ref}
      id={id}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? listId : undefined}
      aria-label={label}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      {...scopeAttrs({ material, density })}
      data-open={open ? '' : undefined}
      data-appearance={appearance}
      onKeyDown={onKeyDown}
      onClick={() => (open ? close() : show())}
      className={cx('ar-well ar-select', disabled && 'is-disabled', className)}
      style={style}
    >
      <span className={cx('ar-select__face', appearance === 'insert' && 'ar-insert')}>
        {current?.icon ? <span className="ar-icon">{current.icon}</span> : null}
        <span className={cx('ar-text ar-select__text', appearance === 'insert' && 'ar-text--over', !current && 'is-placeholder')}>{text}</span>
        <Chevron />
      </span>
      {pnl && typeof document !== 'undefined' ? createPortal(pnl, document.body) : pnl}
    </div>
  );
}
