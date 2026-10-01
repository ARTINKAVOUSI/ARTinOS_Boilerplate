'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { reducedMotion } from '../system/utils';
import { PRECISION_ZONES, ratioLabel } from './engine';

export type HudState =
  | { kind: 'scrub'; ox: number; oy: number; px: number; py: number; leaving?: boolean }
  | { kind: 'swatch'; sx: number; sy: number; color: string; caption: string; leaving?: boolean };

/** Tokens the portalled HUD carries out of its theme scope. */
export const HUD_TOKENS = ['--ar-signal-hi', '--ar-float-bg', '--ar-float-ring', '--ar-float-shadow', '--ar-float-ink', '--ar-float-ink-low', '--ar-font-num', '--ar-ease', '--ar-ease-exit'] as const;

/**
 * Precision HUD — small, quiet, local, temporary. Origin point on the readout,
 * dashed guide + arrow toward the pointer, zone hairlines, value + ratio pill.
 * Portalled to <body> so clipped or blurred panels never cut it off.
 */
export function Hud({ h, text, ratio, levels, tokens }: { h: HudState; text: string; ratio: number; levels: number; tokens: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current?.animate && !reducedMotion()) ref.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 130, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }, []);

  let body = null;
  if (h.kind === 'scrub') {
    const dx = h.px - h.ox;
    const dy = h.py - h.oy;
    const dist = Math.hypot(dx, dy);
    const k = Math.max(0, 1 - 9 / Math.max(dist, 9));
    const ex = h.ox + dx * k;
    const ey = h.oy + dy * k;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const zones = levels >= 3 ? PRECISION_ZONES : PRECISION_ZONES.slice(0, 1);
    body = (
      <>
        <svg className="ar-hud__guide">
          {zones.map((z) => (
            <g key={z} strokeOpacity={Math.abs(dy) >= z ? 0.55 : 0.22}>
              <line x1={h.ox - 7} x2={h.ox + 7} y1={h.oy + z} y2={h.oy + z} />
              <line x1={h.ox - 7} x2={h.ox + 7} y1={h.oy - z} y2={h.oy - z} />
            </g>
          ))}
          <circle cx={h.ox} cy={h.oy} r="2.25" className="ar-hud__fill" />
          {dist > 14 ? <line x1={h.ox} y1={h.oy} x2={ex} y2={ey} strokeOpacity=".8" strokeDasharray="2 3" /> : null}
          {dist > 14 ? <path d="M-1,-3.2 L5,0 L-1,3.2 Z" transform={`translate(${ex},${ey}) rotate(${ang})`} className="ar-hud__fill" /> : null}
        </svg>
        <div className="ar-hud__pill" style={{ left: h.px + 14, top: h.py + 12 }}>
          <span className="ar-hud__text">{text}</span>
          <span className="ar-hud__ratio" data-fine={ratio < 1 ? '' : undefined}>
            {ratioLabel(ratio)}
          </span>
        </div>
      </>
    );
  } else {
    body = (
      <div className="ar-hud__pill ar-hud__pill--swatch" style={{ left: h.sx + 6, top: h.sy + 7 }}>
        <i className="ar-hud__swatch" style={{ background: h.color }} />
        <span className="ar-hud__caption">{h.caption}</span>
      </div>
    );
  }
  const layer = (
    <div ref={ref} className="ar-hud" data-leaving={h.leaving ? '' : undefined} style={tokens as CSSProperties}>
      {body}
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(layer, document.body) : layer;
}

/**
 * The readout turned into a text field: double-click the value (or Enter / F2) to
 * type one. Enter or blur applies, Escape cancels. Keys stay inside the field.
 */
export function ValueEditor({ initial, label, onDone }: { initial: string; label: string; onDone: (text: string | null) => void }) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.select();
  }, []);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      ref={ref}
      className="ar-value ar-slider__edit"
      value={text}
      inputMode="decimal"
      spellCheck={false}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(text);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={() => finish(text)}
    />
  );
}
