'use client';
import type { CSSProperties } from 'react';
import { useControllable } from '../system/hooks';
import { normalizeOptions } from '../system/options';
import type { OptionInput } from '../system/options';
import { cx, scopeAttrs } from '../system/utils';
import type { ScopeProps } from '../system/utils';
import './ToggleGroup.css';

/* ARTINOS ToggleGroup — independent flags sharing one well. Each chip is a small
   insert with its own LED seam; off, it drains to grey. `multiple={false}` makes
   it a solo group that can also be emptied. Icons replace text when given. */

export interface ToggleGroupProps<V extends string = string> extends ScopeProps {
  label?: string;
  options: readonly OptionInput<V>[];
  value?: V[];
  defaultValue?: V[];
  onChange?: (value: V[]) => void;
  multiple?: boolean;
  /** LED seam on each text chip. Default true. */
  led?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

export function ToggleGroup<V extends string = string>({ label, options, value, defaultValue = [], onChange, multiple = true, led = true, material, density, className, style, id }: ToggleGroupProps<V>) {
  const [sel, setSel] = useControllable<V[]>(value, defaultValue, onChange);
  const opts = normalizeOptions(options);
  const flip = (v: V) => {
    const has = sel.includes(v);
    setSel(multiple ? (has ? sel.filter((x) => x !== v) : [...sel, v]) : has ? [] : [v]);
  };
  return (
    <div id={id} role="group" aria-label={label} {...scopeAttrs({ material, density })} data-labelled={label ? '' : undefined} className={cx('ar-well ar-toggles', className)} style={style}>
      {label ? <span className="ar-text ar-toggles__label">{label}</span> : null}
      {opts.map((o) => {
        const on = sel.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.title}
            title={o.title}
            disabled={o.disabled}
            onClick={() => flip(o.value)}
            className="ar-insert ar-toggles__chip"
            data-off={on ? undefined : ''}
            data-icon={o.icon ? '' : undefined}
          >
            {led && !o.icon ? <i className="ar-led" data-on={on ? '' : undefined} /> : null}
            {o.icon ? <span className="ar-icon">{o.icon}</span> : null}
            {o.label != null ? <span className="ar-text ar-text--over">{o.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
