'use client';
import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useControllable } from '../system/hooks';
import { clamp, cx, luminance, scopeAttrs } from '../system/utils';
import type { ScopeProps } from '../system/utils';
import './ColorField.css';

/* ARTINOS ColorField — label in the well, the colour itself as the insert. The hex
   ink follows the colour's luminance. Click the colour for the system picker, click
   the code to type one. With `alpha`, a scrubbable opacity readout sits at the end:
   drag it sideways (1 px = 1%), or focus it and use the arrows. */

export interface ColorFieldProps extends ScopeProps {
  /** Omit for a full-width swatch. */
  label?: string;
  /** #RRGGBB, or #RRGGBBAA when `alpha` is on. */
  value?: string;
  defaultValue?: string;
  onChange?: (hex: string) => void;
  alpha?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

const HEX6 = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i;
function parse(v: string) {
  const m = HEX6.exec(v.trim());
  if (!m) return null;
  return { rgb: '#' + m[1].toUpperCase(), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
}
const alphaHex = (a: number) => Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0').toUpperCase();

export function ColorField({ label, value, defaultValue = '#00C8B3', onChange, alpha = false, material, density, className, style, id }: ColorFieldProps) {
  const [raw, setRaw] = useControllable(value, defaultValue, onChange);
  const parsed = parse(raw) ?? { rgb: '#000000', a: 1 };
  const { rgb, a } = parsed;
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  draftRef.current = draft;
  const scrub = useRef<{ x: number; a: number; id: number } | null>(null);

  const emit = (nextRgb: string, nextA: number) => setRaw(alpha ? nextRgb + alphaHex(nextA) : nextRgb);
  const ink = luminance(rgb) > 0.36 ? 'dark' : 'light';

  const commitDraft = () => {
    const d = draftRef.current;
    if (d === null) return; // already committed or cancelled
    draftRef.current = null;
    setDraft(null);
    const p = parse(d);
    if (p) emit(p.rgb, alpha && d.replace('#', '').length === 8 ? p.a : a);
  };
  const onAlphaDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    scrub.current = { x: e.clientX, a, id: e.pointerId };
  };
  const onAlphaMove = (e: ReactPointerEvent) => {
    const s = scrub.current;
    if (!s || s.id !== e.pointerId) return;
    const k = e.altKey ? 0.1 : 1;
    emit(rgb, clamp(s.a + ((e.clientX - s.x) * k) / 100, 0, 1));
  };
  const onAlphaKey = (e: ReactKeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    emit(rgb, clamp(a + d * (e.shiftKey ? 0.1 : 0.01), 0, 1));
  };

  return (
    <div id={id} {...scopeAttrs({ material, density })} data-labelled={label ? '' : undefined} className={cx('ar-well ar-color', className)} style={style}>
      {label ? <span className="ar-text ar-color__label">{label}</span> : null}
      <label className="ar-color__swatch" data-ink={ink} style={{ '--_c': rgb, '--_a': a } as CSSProperties}>
        <span className="ar-color__paint" />
        <input
          type="color"
          className="ar-color__native"
          aria-label={(label ?? 'Colour') + ' picker'}
          value={rgb.toLowerCase()}
          onChange={(e) => emit(e.target.value.toUpperCase(), a)}
        />
        <input
          className="ar-value ar-color__hex"
          aria-label={(label ?? 'Colour') + ' hex'}
          spellCheck={false}
          maxLength={alpha ? 9 : 7}
          value={draft ?? rgb.replace('#', '')}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              draftRef.current = null;
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {alpha ? (
          <span
            className="ar-value ar-color__alpha"
            role="slider"
            tabIndex={0}
            aria-label={(label ?? 'Colour') + ' opacity'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(a * 100)}
            onPointerDown={onAlphaDown}
            onPointerMove={onAlphaMove}
            onPointerUp={() => (scrub.current = null)}
            onPointerCancel={() => (scrub.current = null)}
            onKeyDown={onAlphaKey}
            onClick={(e) => e.preventDefault()}
          >
            {Math.round(a * 100)}%
          </span>
        ) : null}
      </label>
    </div>
  );
}
