/* ARTINOS UI — shared helpers: math, mapping, formatting, colour. No React. */

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/* ---------- mapping: the semantic value stays exact, only geometry changes ---------- */

export interface MappingFns {
  /** value → normalized position 0..1 */
  to: (v: number, min: number, max: number) => number;
  /** normalized position 0..1 → value */
  from: (t: number, min: number, max: number) => number;
}
export type MappingName = 'linear' | 'log' | 'exp' | 'power';
export type Mapping = MappingName | MappingFns;

export const MAPPINGS: Record<MappingName, MappingFns> = {
  linear: { to: (v, a, b) => (v - a) / (b - a), from: (t, a, b) => a + t * (b - a) },
  /** min must be > 0 */
  log: { to: (v, a, b) => Math.log(v / a) / Math.log(b / a), from: (t, a, b) => a * Math.pow(b / a, t) },
  exp: { to: (v, a, b) => Math.sqrt(Math.max(0, (v - a) / (b - a))), from: (t, a, b) => a + (b - a) * t * t },
  power: { to: (v, a, b) => Math.cbrt((v - a) / (b - a)), from: (t, a, b) => a + (b - a) * t * t * t },
};
export const resolveMapping = (m: Mapping | undefined): MappingFns =>
  typeof m === 'object' ? m : MAPPINGS[m ?? 'linear'] ?? MAPPINGS.linear;

/* ---------- formatting belongs to the parameter ---------- */

export type Format = 'number' | 'percent' | 'db' | 'angle' | 'hz' | 'time';
export interface Formatted {
  text: string;
  unit: string;
}
/** Custom formatter: return a string, or text + separate (quieter) unit. */
export type Formatter = (value: number, decimals: number) => string | Formatted;

const minus = (s: string) => s.replace('-', '−');

/** `extra` adds precision digits (used while scrubbing finely). */
export function formatValue(v: number, format: Format = 'number', decimals = 2, unit?: string, extra = 0): Formatted {
  const d = Math.max(0, decimals + extra);
  switch (format) {
    case 'percent':
      return { text: minus((v * 100).toFixed(d)), unit: '%' };
    case 'db':
      return v <= -96 ? { text: '−∞', unit: 'dB' } : { text: minus(v.toFixed(d)), unit: 'dB' };
    case 'angle':
      return { text: minus(v.toFixed(d)), unit: '°' };
    case 'hz': // compacts: 1000 → 1.0 kHz, 10000 → 10 kHz
      return v >= 1000 ? { text: (v / 1000).toFixed((v >= 10000 ? 0 : 1) + extra), unit: 'kHz' } : { text: v.toFixed(d), unit: 'Hz' };
    case 'time':
      return { text: v.toFixed(d), unit: unit ?? 's' };
    default:
      return { text: minus(v.toFixed(d)), unit: unit ?? '' };
  }
}

export function runFormat(
  v: number,
  opts: { format?: Format; decimals: number; extra?: number; unit?: string; formatter?: Formatter },
): Formatted {
  if (opts.formatter) {
    const r = opts.formatter(v, opts.decimals + (opts.extra ?? 0));
    return typeof r === 'string' ? { text: r, unit: '' } : r;
  }
  return formatValue(v, opts.format, opts.decimals, opts.unit, opts.extra ?? 0);
}

/** Unit glyphs that sit tight against the number. */
export const tightUnit = (u: string) => u === '°' || u === '%';
export const joinFormatted = (f: Formatted) => f.text + (f.unit ? (tightUnit(f.unit) ? '' : ' ') + f.unit : '');

/* ---------- colour ---------- */

export type Stop = [position: number, hex: string];

export const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const toHex = (a: number[]) =>
  '#' + a.map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();

export function sampleStops(stops: Stop[], t: number): string {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const k = (t - p0) / (p1 - p0 || 1);
      const a = hexRgb(c0);
      const b = hexRgb(c1);
      return toHex(a.map((x, j) => x + (b[j] - x) * k));
    }
  }
  return stops[stops.length - 1][1].toUpperCase();
}

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string) {
  const [r, g, b] = hexRgb(hex).map((x) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface Gradient {
  stops: Stop[];
  /** caption for the swatch readout while dragging; defaults to the formatted value */
  describe?: (t: number, color: string, value: number) => string;
}
export type GradientName = 'temperature' | 'hue' | 'saturate' | 'exposure';

/** Parameter scales from the ARTINOS reference. */
export const GRADIENTS: Record<GradientName, Gradient> = {
  temperature: {
    stops: [[0, '#002F8E'], [0.1154, '#1979A5'], [0.2837, '#6BCFF1'], [0.4904, '#EDF7FF'], [0.6923, '#FDC94F'], [0.8413, '#FF7600'], [1, '#FF1500']],
    describe: (t) => (t < 0.3 ? 'COOL' : t < 0.55 ? 'NEUTRAL' : t < 0.8 ? 'WARM' : 'HOT'),
  },
  hue: {
    stops: [[0, '#FF1500'], [0.1587, '#FF7600'], [0.3077, '#FDC94F'], [0.4423, '#30D952'], [0.6106, '#1979A5'], [0.7788, '#002F8E'], [1, '#9917BA']],
    describe: (_t, color) => color,
  },
  saturate: { stops: [[0, '#5A5A5A'], [1, '#00FF91']] },
  exposure: { stops: [[0, '#000000'], [0.5481, '#6E6E6E'], [0.9856, '#FFFFFF'], [1, '#FFFFFF']] },
};

export const gradientCss = (g: Gradient) =>
  `linear-gradient(90deg, ${g.stops.map(([s, c]) => `${c} ${s * 100}%`).join(', ')})`;

/* ---------- tokens across portals ----------
   Floating layers (HUD, list panel) portal to <body> to escape clipped or
   blurred panels, which also takes them out of their theme scope. They carry
   the resolved values of the tokens they need with them. */
export function snapshotTokens(el: Element | null, names: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!el || typeof getComputedStyle === 'undefined') return out;
  const cs = getComputedStyle(el);
  for (const n of names) {
    const v = cs.getPropertyValue(n).trim();
    if (v) out[n] = v;
  }
  return out;
}

/** Reads a px length token (e.g. --ar-inset) from an element. */
export function pxToken(el: Element | null, name: string, fallback: number) {
  if (!el) return fallback;
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/* ---------- design-system axes ----------
   A theme is the whole look: ground, ink, signal, panel glass AND the finish of
   every control. Pick one theme; nothing else is required. Material and density
   are optional overrides for special cases. */

export const THEMES = [
  'frost-etched', 'frost-deep', 'studio',
] as const;
export type ThemeName = (typeof THEMES)[number];

export type ThemeFamily = 'studio' | 'signature' | 'glass' | 'frost' | 'clear' | 'clear-frost' | 'luxe' | 'luxe-frost' | 'atelier-glass' | 'atelier-frost' | 'untinted-glass' | 'untinted-frost';

export interface ThemeMeta {
  label: string;
  family: ThemeFamily;
  /** solid themes paint their own ground; pane themes sit over imagery or a live canvas */
  kind: 'solid' | 'glass';
  description: string;
  /** [ground, control, signal] — for picker swatches */
  swatch: [string, string, string];
}

export const THEME_META: Record<ThemeName, ThemeMeta> = {
  'frost-etched': { label: 'Etched Frost', family: 'untinted-frost', kind: 'glass', description: 'Fine etched glass. Light diffusion, translucent matte inserts and delicate satin edges.', swatch: ['#505050', '#808080', '#4fd1ba'] },
  'frost-deep': { label: 'Deep Frost', family: 'untinted-frost', kind: 'glass', description: 'Deep optical diffusion. The scene melts behind clear frost; dense satin inserts carry crisp charcoal numerals.', swatch: ['#4a4a4a', '#c6c6c6', '#4fd1ba'] },
  studio: { label: 'Studio', family: 'studio', kind: 'solid', description: 'Studio-grade neutral dark. Satin controls, hairline edges, teal signal. The default.', swatch: ['#101112', '#d2d2ce', '#3cbca5'] },
};
/** Themes meant to sit over imagery or a live canvas — their panels are glass. */
export const GLASS_THEMES = THEMES.filter((t) => THEME_META[t].kind === 'glass');

/** Control finishes. Each theme already picks one — use these only to override. */
export const MATERIALS = ['optical', 'frost', 'milk', 'clear', 'tint', 'smoked', 'metal', 'soft', 'reference'] as const;
export const DENSITIES = ['dense', 'standard', 'comfort'] as const;
export type MaterialName = (typeof MATERIALS)[number];
export type Density = (typeof DENSITIES)[number];

/** Props every control accepts to override its theme's finish or size. */
export interface ScopeProps {
  /** Advanced: override the theme's control finish for this control. */
  material?: MaterialName;
  /** Control height: dense 24 · standard 26 · comfort 30. Inherits when omitted. */
  density?: Density;
}

export const scopeAttrs = ({ material, density }: ScopeProps) => ({
  'data-ar-material': material,
  'data-ar-density': density,
});
