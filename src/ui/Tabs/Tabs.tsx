'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useControllable } from '../system/hooks';
import { normalizeOptions } from '../system/options';
import type { OptionInput } from '../system/options';
import { cx } from '../system/utils';
import './Tabs.css';

/* ARTINOS Tabs — a quiet text tab strip with a travelling underline. Renders the
   tablist only; render the active panel yourself from `value`. Arrow keys,
   Home and End move between tabs. */

export interface TabsProps<V extends string = string> {
  items: readonly OptionInput<V>[];
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
  /** Accessible name of the tab list. */
  label?: string;
  /** Prefix for tab / panel ids: tab `${idBase}-tab-${value}`, panel `${idBase}-panel-${value}`. */
  idBase?: string;
  className?: string;
  style?: CSSProperties;
}

export function Tabs<V extends string = string>({ items, value, defaultValue, onChange, label, idBase, className, style }: TabsProps<V>) {
  const opts = normalizeOptions(items);
  const [cur, pick] = useControllable<V>(value, defaultValue ?? opts[0]?.value, onChange);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const idx = Math.max(0, opts.findIndex((o) => o.value === cur));

  useLayoutEffect(() => {
    const el = refs.current[idx];
    if (!el) return;
    const place = () => setBar({ x: el.offsetLeft, w: el.offsetWidth });
    place();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [idx, opts.length]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const n = opts.length;
    let j = e.key === 'ArrowRight' ? idx + 1 : e.key === 'ArrowLeft' ? idx - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j === -1 && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    j = (j + n) % n;
    if (opts[j].disabled) return;
    pick(opts[j].value);
    refs.current[j]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cx('ar-tabs', className)} style={style} onKeyDown={onKeyDown}>
      {opts.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={idBase ? `${idBase}-tab-${o.value}` : undefined}
          aria-controls={idBase ? `${idBase}-panel-${o.value}` : undefined}
          aria-selected={i === idx}
          tabIndex={i === idx ? 0 : -1}
          disabled={o.disabled}
          title={o.title}
          onClick={() => pick(o.value)}
          className="ar-tabs__tab"
        >
          {o.icon ? <span className="ar-icon">{o.icon}</span> : null}
          {o.label}
        </button>
      ))}
      {bar ? <i className="ar-tabs__bar" style={{ transform: `translateX(${bar.x}px)`, width: bar.w }} /> : null}
    </div>
  );
}
