'use client';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useControllable } from '../system/hooks';
import { cx, scopeAttrs } from '../system/utils';
import type { ScopeProps } from '../system/utils';
import './Switch.css';

/* ARTINOS Switch.
 *   shutter  the slider insert as a two-position shutter: it travels to the active
 *            half and its LED seam lights; off, the same insert drains to grey.
 *   compact  a short well with a knob — the inspector "Enabled [ | ]" form.
 * Click, Space or Enter. */

export interface SwitchProps extends ScopeProps {
  /** Text on the insert (shutter) and accessible name (both). */
  label?: string;
  labelOn?: string;
  labelOff?: string;
  value?: boolean;
  defaultValue?: boolean;
  onChange?: (on: boolean) => void;
  variant?: 'shutter' | 'compact';
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
  'aria-label'?: string;
}

export function Switch({ label, labelOn, labelOff, value, defaultValue = false, onChange, variant = 'shutter', disabled, material, density, className, style, id, ...rest }: SwitchProps) {
  const [on, setOn] = useControllable(value, defaultValue, onChange);
  const toggle = () => {
    if (!disabled) setOn(!on);
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  };
  const text = on ? labelOn ?? label : labelOff ?? label;
  return (
    <div
      id={id}
      role="switch"
      aria-checked={on}
      aria-label={rest['aria-label'] ?? label}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      {...scopeAttrs({ material, density })}
      data-on={on ? '' : undefined}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={cx('ar-well ar-switch', variant === 'compact' && 'ar-switch--compact', disabled && 'is-disabled', className)}
      style={style}
    >
      {variant === 'compact' ? (
        <span className="ar-insert ar-switch__knob" data-off={on ? undefined : ''}>
          <i className="ar-switch__mark" />
        </span>
      ) : (
        <span className="ar-insert ar-switch__shutter" data-off={on ? undefined : ''}>
          <i className="ar-led" data-on={on ? '' : undefined} />
          {text ? <span className="ar-text ar-text--over ar-switch__text">{text}</span> : null}
        </span>
      )}
    </div>
  );
}
