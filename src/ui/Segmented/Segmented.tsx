'use client';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useControllable } from '../system/hooks';
import { normalizeOptions } from '../system/options';
import type { OptionInput } from '../system/options';
import { cx, scopeAttrs } from '../system/utils';
import type { ScopeProps } from '../system/utils';
import './Segmented.css';

/* ARTINOS Segmented — one of n. The insert travels between positions and the text
   it arrives under switches ink. Arrow keys move it. */

export interface SegmentedProps<V extends string = string> extends ScopeProps {
  /** Accessible name. */
  label?: string;
  options: readonly OptionInput<V>[];
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

export function Segmented<V extends string = string>({ label, options, value, defaultValue, onChange, material, density, className, style, id }: SegmentedProps<V>) {
  const opts = normalizeOptions(options);
  const [cur, pick] = useControllable<V>(value, defaultValue ?? opts[0]?.value, onChange);
  const n = Math.max(1, opts.length);
  const idx = Math.max(0, opts.findIndex((o) => o.value === cur));
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    for (let k = 1; k < n; k++) {
      const o = opts[(((idx + d * k) % n) + n) % n];
      if (!o.disabled) {
        pick(o.value);
        return;
      }
    }
  };
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      tabIndex={0}
      {...scopeAttrs({ material, density })}
      onKeyDown={onKeyDown}
      className={cx('ar-well ar-segmented', className)}
      style={{ '--_i': idx, '--_n': n, ...style } as CSSProperties}
    >
      <span className="ar-insert ar-segmented__insert" />
      <div className="ar-segmented__row">
        {opts.map((o, i) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={i === idx}
            aria-label={o.title}
            tabIndex={-1}
            title={o.title}
            disabled={o.disabled}
            onClick={() => pick(o.value)}
            className="ar-segmented__opt"
            data-on={i === idx ? '' : undefined}
          >
            {o.icon ? <span className="ar-icon">{o.icon}</span> : null}
            {o.label != null ? <span className={cx('ar-text', i === idx && 'ar-text--over')}>{o.label}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
