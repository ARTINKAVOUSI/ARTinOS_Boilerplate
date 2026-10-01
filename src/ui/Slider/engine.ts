/* Slider engine — the gesture rules shared by Slider and RangeSlider. No React. */
import { clamp, resolveMapping } from '../system/utils';
import type { Mapping } from '../system/utils';

/** Seam grab zone: a press this close to the seam grabs it without a jump. */
export const SEAM_GRAB = 13;
/** Vertical distance from the readout that selects each precision level. */
export const PRECISION_ZONES = [26, 78] as const;
/** Detent magnet radius in px: resting, and with Ctrl held. */
export const DETENT_PX = 6;
export const DETENT_PX_CTRL = 22;

export type PrecisionLevels = 2 | 3;

interface ModKeys {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Alt → fine (0.1×), Shift → ultra-fine (0.01×, or 0.1× with two levels). */
export const modifierRatio = (e: ModKeys, levels: PrecisionLevels) =>
  e.shiftKey ? (levels >= 3 ? 0.01 : 0.1) : e.altKey ? 0.1 : 1;

/** Off-axis sensitivity: broad, predictable zones — 1× · 0.1× · 0.01×. */
export const zoneRatio = (dy: number, levels: PrecisionLevels) => {
  const a = Math.abs(dy);
  return a < PRECISION_ZONES[0] ? 1 : a < PRECISION_ZONES[1] || levels < 3 ? 0.1 : 0.01;
};

export const ratioLabel = (r: number) => (r >= 1 ? '1×' : r >= 0.1 ? '0.1×' : '0.01×');
/** Extra display digits revealed at each precision level. */
export const extraDigits = (r: number) => (r <= 0.011 ? 2 : r <= 0.11 ? 1 : 0);
export const snapKey = (e: ModKeys) => e.ctrlKey || e.metaKey;

/** Value ↔ position with optional quantization; one per slider render. */
export function makeScale(min: number, max: number, mapping: Mapping | undefined, quant: number) {
  const M = resolveMapping(mapping);
  const toT = (v: number) => clamp(M.to(v, min, max), 0, 1);
  const fromT = (t: number) => M.from(clamp(t, 0, 1), min, max);
  const qT = (t: number) => (quant > 1 ? Math.round(clamp(t, 0, 1) * (quant - 1)) / (quant - 1) : t);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  /** Quantize + clamp a raw value into the parameter's legal set. */
  const legal = (v: number) => clamp(quant > 1 ? fromT(qT(toT(v))) : v, lo, hi);
  return { toT, fromT, qT, legal };
}

/**
 * Detents are semantic magnetic points. Returns the snapped value and the
 * detent captured (null when free). With Ctrl and no detents, snaps to 5% steps.
 */
export function applyDetent(
  v: number,
  widthPx: number,
  ctrl: boolean,
  detents: readonly number[] | undefined,
  toT: (v: number) => number,
  fromT: (t: number) => number,
  quantized: boolean,
): [number, number | null] {
  const list = detents ?? [];
  let best: number | null = null;
  let bd = Infinity;
  for (const d of list) {
    const dd = Math.abs(toT(v) - toT(d));
    if (dd < bd) {
      bd = dd;
      best = d;
    }
  }
  if (best !== null && bd * widthPx <= (ctrl ? DETENT_PX_CTRL : DETENT_PX)) return [best, best];
  if (ctrl && !list.length && !quantized) {
    const t = Math.round(toT(v) * 20) / 20;
    return [fromT(t), t];
  }
  return [v, null];
}

/** Next detent (or 10% grid line) in a direction — Ctrl + arrow. */
export function nextDetent(cur: number, dir: number, detents: readonly number[] | undefined, toT: (v: number) => number, fromT: (t: number) => number) {
  const list = (detents ?? []).slice().sort((a, b) => a - b);
  const next = dir > 0 ? list.find((d) => d > cur + 1e-9) : list.reverse().find((d) => d < cur - 1e-9);
  if (next !== undefined) return { value: next, detent: true };
  const t = toT(cur);
  return { value: fromT(dir > 0 ? Math.floor(t * 10 + 1e-6) / 10 + 0.1 : Math.ceil(t * 10 - 1e-6) / 10 - 0.1), detent: false };
}

/* ---------- ruler ---------- */

/** A 1/2/5 × 10ⁿ tick unit at least `x` wide. */
export const niceUnit = (x: number) => {
  const e = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
};
export const majorEvery = (u: number) => {
  const m = Math.round(u / Math.pow(10, Math.floor(Math.log10(u) + 1e-9)));
  return m === 5 ? 2 : 5;
};

/* ---------- visualized ---------- */

export type CurveName = 'sigmoid' | 'smooth' | 'gamma';
export const CURVES: Record<CurveName, (x: number) => number> = {
  sigmoid: (x) => {
    const s = (v: number) => 1 / (1 + Math.exp(-9 * (v - 0.5)));
    return (s(x) - s(0)) / (s(1) - s(0));
  },
  smooth: (x) => x * x * (3 - 2 * x),
  gamma: (x) => Math.pow(x, 0.45),
};

/* ---------- typed entry ---------- */

/**
 * Parse a value typed into the readout, in the units the readout shows:
 * '47' or '47%' (percent) → 0.47 · '1.2k' / '1.2 kHz' → 1200 · '−4.5 dB' → -4.5 ·
 * '128°' → 128 · '-inf' / '−∞' → -Infinity. Returns null when nothing numeric is there.
 */
export function parseTyped(text: string, format?: string): number | null {
  const s = text.trim().replace(/−/g, '-').replace(/(\d),(\d)/g, '$1.$2');
  if (/^-\s*(inf|∞)/i.test(s)) return -Infinity;
  if (/^\+?\s*(inf|∞)/i.test(s)) return Infinity;
  const m = s.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(k)?/i);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (m[2]) v *= 1000;
  if (format === 'percent') v /= 100;
  return v;
}
