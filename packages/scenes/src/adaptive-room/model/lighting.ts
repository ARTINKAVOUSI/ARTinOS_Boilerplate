/**
 * Lighting & staging parameter model + curated light modes.
 *
 * Modes are recipes that set the multi-light rig into a coherent look.
 * Individual knobs always override after a mode is applied.
 */

export type LightModeId =
  | 'studio'
  | 'softbox'
  | 'beauty'
  | 'dramatic'
  | 'product'
  | 'gallery'
  | 'daylight'
  | 'neon';

export interface LightParams {
  /** Active lighting recipe. */
  mode: LightModeId;

  /** Master multiplier over the whole rig. */
  master: number;
  /** Ambient / hemisphere contribution. */
  ambient: number;

  /** Key (main) light. */
  keyIntensity: number;
  keyAzimuth: number; // degrees
  keyElevation: number; // degrees above horizon
  keyColor: string;
  keySoftness: number; // 0 hard … 1 very soft (shadow radius / area size)

  /** Fill light. */
  fillIntensity: number;
  fillAzimuth: number;
  fillColor: string;

  /** Rim / kicker from behind. */
  rimIntensity: number;
  rimAzimuth: number;
  rimColor: string;
  rimSpread: number; // spot angle factor

  /** Overhead / ceiling contribution. */
  topIntensity: number;
  topColor: string;

  /** Twin softbox / rect-area panels (left + right). */
  softboxIntensity: number;
  softboxSize: number; // panel scale
  softboxColor: string;
  /** Optional right-panel color; empty = mirror softboxColor. */
  softboxColorR: string;

  /** Practical accent / bounce point. */
  accentIntensity: number;
  accentColor: string;

  /** Multi-color accent ring (extra colored point lights). */
  colorRing: boolean;
  colorRingIntensity: number;
  colorRingCount: number; // 2–6
  colorRingRadius: number; // fraction of room
  colorRingHeight: number; // 0 floor … 1 ceiling
  colorRingSpeed: number; // rev/min, 0 = static
  /** Up to 6 gel colors for the ring. */
  colorRingColors: string[];

  /** Global gel saturation boost (0 = pale, 1 = as-set, 1.5 = punchy). */
  gelSaturation: number;
  /** Mix colored lights toward pure white (0 = full gel, 1 = white). */
  gelWash: number;

  /** Shadow map quality bias helpers. */
  shadowSoftness: number;
  showHelpers: boolean;

  /** Per-channel mute flags (true = muted / off). */
  mute: Partial<Record<LightChannelId, boolean>>;
  /** Solo channel — when set, all other channels mute. */
  solo: LightChannelId | null;

  /** Key distance bias (0.5 close … 2 far). */
  keyDistance: number;
  /** Fill elevation degrees. */
  fillElevation: number;
  /** Link L/R softbox colors. */
  softboxLinked: boolean;
  /** Kelvin temperature for key (0 = use gel hex directly). */
  keyKelvin: number;
  fillKelvin: number;
}

export type LightChannelId =
  | 'key'
  | 'fill'
  | 'rim'
  | 'top'
  | 'softbox'
  | 'accent'
  | 'ring'
  | 'ambient';

export const LIGHT_CHANNELS: {
  id: LightChannelId;
  label: string;
  short: string;
  color: string;
}[] = [
  { id: 'key', label: 'Key', short: 'KEY', color: '#fbbf24' },
  { id: 'fill', label: 'Fill', short: 'FIL', color: '#93c5fd' },
  { id: 'rim', label: 'Rim', short: 'RIM', color: '#f9a8d4' },
  { id: 'top', label: 'Top', short: 'TOP', color: '#e7e5e4' },
  { id: 'softbox', label: 'Softbox', short: 'SBX', color: '#a7f3d0' },
  { id: 'accent', label: 'Accent', short: 'ACC', color: '#c4b5fd' },
  { id: 'ring', label: 'Ring', short: 'RNG', color: '#fb7185' },
  { id: 'ambient', label: 'Ambient', short: 'AMB', color: '#a8a29e' },
];

export interface StagingParams {
  /** Floor plinth / pedestal. */
  plinth: boolean;
  plinthHeight: number;
  plinthRadius: number;
  plinthColor: string;

  /** Slow turntable under fitted subject. */
  turntable: boolean;
  turntableSpeed: number; // rev per minute

  /** Contact shadow catcher disc on the floor. */
  shadowCatcher: boolean;
  shadowCatcherOpacity: number;
  shadowCatcherScale: number;

  /** Vertical backdrop card behind subject. */
  backdrop: boolean;
  backdropHeight: number;
  backdropWidth: number;
  backdropColor: string;
  backdropOffset: number; // depth from subject toward rear

  /** Reflective floor sheen strength (0–1). */
  floorSheen: number;
}

export const DEFAULT_LIGHT: LightParams = {
  mode: 'studio',
  master: 1,
  ambient: 0.42,
  keyIntensity: 2.6,
  keyAzimuth: -28,
  keyElevation: 42,
  keyColor: '#fff5e8',
  keySoftness: 0.45,
  fillIntensity: 0.55,
  fillAzimuth: 35,
  fillColor: '#e7ecf5',
  rimIntensity: 0,
  rimAzimuth: 160,
  rimColor: '#fff0e0',
  rimSpread: 0.55,
  topIntensity: 0,
  topColor: '#fff8f0',
  softboxIntensity: 0,
  softboxSize: 1,
  softboxColor: '#ffffff',
  softboxColorR: '',
  accentIntensity: 0,
  accentColor: '#a8c4ff',
  colorRing: false,
  colorRingIntensity: 1.2,
  colorRingCount: 4,
  colorRingRadius: 0.55,
  colorRingHeight: 0.35,
  colorRingSpeed: 0,
  colorRingColors: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b5179e', '#f72585'],
  gelSaturation: 1,
  gelWash: 0,
  shadowSoftness: 0.5,
  showHelpers: true,
  mute: {},
  solo: null,
  keyDistance: 1,
  fillElevation: 25,
  softboxLinked: true,
  keyKelvin: 0,
  fillKelvin: 0,
};

export const DEFAULT_STAGING: StagingParams = {
  plinth: false,
  plinthHeight: 0.42,
  plinthRadius: 0.7,
  plinthColor: '',
  turntable: false,
  turntableSpeed: 4,
  shadowCatcher: true,
  shadowCatcherOpacity: 0.22,
  shadowCatcherScale: 1.4,
  backdrop: false,
  backdropHeight: 2.4,
  backdropWidth: 2.2,
  backdropColor: '',
  backdropOffset: 1.2,
  floorSheen: 0,
};

export interface LightModeDef {
  id: LightModeId;
  label: string;
  blurb: string;
  patch: Partial<LightParams>;
}

export const LIGHT_MODES: LightModeDef[] = [
  {
    id: 'studio',
    label: 'Studio 3-Point',
    blurb: 'Classic key + fill + ambient. Clean product default.',
    patch: {
      mode: 'studio',
      keyIntensity: 2.6,
      keyAzimuth: -28,
      keyElevation: 42,
      keySoftness: 0.45,
      fillIntensity: 0.55,
      fillAzimuth: 35,
      rimIntensity: 0.15,
      rimAzimuth: 155,
      topIntensity: 0.1,
      softboxIntensity: 0,
      accentIntensity: 0,
      ambient: 0.42,
    },
  },
  {
    id: 'softbox',
    label: 'Softbox',
    blurb: 'Twin rect-area panels + soft overhead — beauty / cosmetics.',
    patch: {
      mode: 'softbox',
      keyIntensity: 0.6,
      keySoftness: 0.85,
      fillIntensity: 0.25,
      rimIntensity: 0,
      topIntensity: 0.8,
      softboxIntensity: 2.4,
      softboxSize: 1.3,
      ambient: 0.35,
      shadowSoftness: 0.8,
    },
  },
  {
    id: 'beauty',
    label: 'Beauty Clamshell',
    blurb: 'High soft key above + fill below. Flattering, even.',
    patch: {
      mode: 'beauty',
      keyIntensity: 2.2,
      keyElevation: 55,
      keyAzimuth: 0,
      keySoftness: 0.75,
      fillIntensity: 1.4,
      fillAzimuth: 0,
      rimIntensity: 0.3,
      rimAzimuth: 180,
      topIntensity: 1.0,
      softboxIntensity: 1.2,
      softboxSize: 1.1,
      ambient: 0.5,
    },
  },
  {
    id: 'dramatic',
    label: 'Dramatic',
    blurb: 'Hard side key, deep shadows, strong rim. Chiaroscuro.',
    patch: {
      mode: 'dramatic',
      keyIntensity: 3.4,
      keyAzimuth: -55,
      keyElevation: 28,
      keySoftness: 0.12,
      fillIntensity: 0.08,
      rimIntensity: 1.6,
      rimAzimuth: 150,
      rimSpread: 0.35,
      topIntensity: 0,
      softboxIntensity: 0,
      ambient: 0.18,
      shadowSoftness: 0.15,
    },
  },
  {
    id: 'product',
    label: 'Product Pack',
    blurb: 'Top-down key + twin soft sides. Catalog packshot.',
    patch: {
      mode: 'product',
      keyIntensity: 1.4,
      keyElevation: 70,
      keyAzimuth: -10,
      keySoftness: 0.6,
      fillIntensity: 0.5,
      rimIntensity: 0.4,
      rimAzimuth: 170,
      topIntensity: 1.6,
      softboxIntensity: 1.8,
      softboxSize: 1.0,
      ambient: 0.4,
    },
  },
  {
    id: 'gallery',
    label: 'Gallery',
    blurb: 'Museum overhead spots + soft ambient. Calm exhibit light.',
    patch: {
      mode: 'gallery',
      keyIntensity: 1.2,
      keyElevation: 65,
      keyAzimuth: -15,
      keySoftness: 0.55,
      fillIntensity: 0.45,
      rimIntensity: 0,
      topIntensity: 2.2,
      softboxIntensity: 0.4,
      ambient: 0.55,
      accentIntensity: 0.3,
    },
  },
  {
    id: 'daylight',
    label: 'Daylight',
    blurb: 'Large cool window area + warm sun key. Natural interior.',
    patch: {
      mode: 'daylight',
      keyIntensity: 2.8,
      keyAzimuth: -50,
      keyElevation: 35,
      keyColor: '#fff6e8',
      keySoftness: 0.35,
      fillIntensity: 0.7,
      fillColor: '#d8e4f8',
      rimIntensity: 0.2,
      topIntensity: 0.5,
      softboxIntensity: 2.0,
      softboxColor: '#e8f0ff',
      softboxSize: 1.6,
      ambient: 0.48,
    },
  },
  {
    id: 'neon',
    label: 'Neon Accent',
    blurb: 'Cool colored practicals + hard key. Editorial / night look.',
    patch: {
      mode: 'neon',
      keyIntensity: 2.0,
      keyAzimuth: -30,
      keyElevation: 40,
      keySoftness: 0.3,
      fillIntensity: 0.2,
      rimIntensity: 1.2,
      rimColor: '#66aaff',
      rimAzimuth: 140,
      topIntensity: 0.2,
      softboxIntensity: 0.3,
      accentIntensity: 2.4,
      accentColor: '#ff6ab0',
      ambient: 0.22,
    },
  },
];

export const getLightMode = (id: string): LightModeDef =>
  LIGHT_MODES.find((m) => m.id === id) ?? LIGHT_MODES[0];

/** Apply a mode recipe onto existing light params (keeps master/helpers). */
export function applyLightMode(current: LightParams, id: LightModeId): LightParams {
  const mode = getLightMode(id);
  return {
    ...current,
    ...mode.patch,
    mode: id,
    master: current.master,
    showHelpers: current.showHelpers,
    colorRingColors: current.colorRingColors,
    mute: current.mute,
    solo: current.solo,
    keyDistance: current.keyDistance,
    fillElevation: current.fillElevation,
    softboxLinked: current.softboxLinked,
    keyKelvin: current.keyKelvin,
    fillKelvin: current.fillKelvin,
  };
}

/* ------------------------------------------------------------------ */
/* Color gels / multi-color schemes                                   */
/* ------------------------------------------------------------------ */

export interface ColorScheme {
  id: string;
  label: string;
  blurb: string;
  /** Swatch colors shown in the UI */
  swatches: string[];
  patch: Partial<LightParams>;
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'neutral',
    label: 'Neutral',
    blurb: 'Warm key + cool fill — classic studio balance.',
    swatches: ['#fff5e8', '#e7ecf5', '#fff0e0'],
    patch: {
      keyColor: '#fff5e8',
      fillColor: '#e7ecf5',
      rimColor: '#fff0e0',
      topColor: '#fff8f0',
      softboxColor: '#ffffff',
      softboxColorR: '',
      accentColor: '#c8d4e8',
      gelSaturation: 0.85,
      gelWash: 0.15,
      colorRing: false,
    },
  },
  {
    id: 'warm-cool',
    label: 'Warm / Cool',
    blurb: 'Amber key vs teal fill — cinematic cross-gel.',
    swatches: ['#ffb347', '#4ecdc4', '#ffe0a0'],
    patch: {
      keyColor: '#ffb347',
      fillColor: '#4ecdc4',
      rimColor: '#ffe0a0',
      topColor: '#ffd9a0',
      softboxColor: '#ffe8c8',
      softboxColorR: '#c8f0ea',
      accentColor: '#5eead4',
      gelSaturation: 1.15,
      gelWash: 0.05,
      colorRing: false,
      softboxIntensity: 1.2,
    },
  },
  {
    id: 'magenta-cyan',
    label: 'Magenta / Cyan',
    blurb: 'Bold complementary gels — editorial fashion.',
    swatches: ['#ff2d95', '#00e5ff', '#ff80bf'],
    patch: {
      keyColor: '#ffd6e8',
      fillColor: '#b8f0ff',
      rimColor: '#ff2d95',
      topColor: '#e8f8ff',
      softboxColor: '#ff2d95',
      softboxColorR: '#00e5ff',
      accentColor: '#ff2d95',
      rimIntensity: 1.4,
      softboxIntensity: 1.8,
      accentIntensity: 1.5,
      gelSaturation: 1.25,
      gelWash: 0,
      colorRing: false,
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    blurb: 'Golden hour key, rose fill, violet rim.',
    swatches: ['#ff8c42', '#ff6b9d', '#7b5ea7'],
    patch: {
      keyColor: '#ff8c42',
      fillColor: '#ffb3c6',
      rimColor: '#7b5ea7',
      topColor: '#ffcfa3',
      softboxColor: '#ffb07c',
      softboxColorR: '#e8a0c8',
      accentColor: '#ff6b9d',
      keyIntensity: 2.8,
      rimIntensity: 1.0,
      gelSaturation: 1.2,
      gelWash: 0.05,
      colorRing: false,
    },
  },
  {
    id: 'arctic',
    label: 'Arctic',
    blurb: 'Icy blue-white key, deep blue rim.',
    swatches: ['#e8f4ff', '#7dd3fc', '#38bdf8'],
    patch: {
      keyColor: '#e8f4ff',
      fillColor: '#bae6fd',
      rimColor: '#38bdf8',
      topColor: '#f0f9ff',
      softboxColor: '#e0f2fe',
      softboxColorR: '#7dd3fc',
      accentColor: '#0ea5e9',
      rimIntensity: 1.1,
      gelSaturation: 1.0,
      gelWash: 0.1,
      colorRing: false,
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    blurb: 'Moss green fill, amber key, emerald accents.',
    swatches: ['#f0e0c0', '#6b8f71', '#2d6a4f'],
    patch: {
      keyColor: '#f0e0c0',
      fillColor: '#95d5b2',
      rimColor: '#2d6a4f',
      topColor: '#e8f5e9',
      softboxColor: '#b7e4c7',
      softboxColorR: '#d8f3dc',
      accentColor: '#40916c',
      gelSaturation: 1.1,
      gelWash: 0.08,
      colorRing: false,
    },
  },
  {
    id: 'club',
    label: 'Club RGB',
    blurb: 'Rotating RGB ring + magenta accent. Party look.',
    swatches: ['#ff0040', '#00ff88', '#0088ff', '#ff00cc'],
    patch: {
      keyColor: '#ffe8f0',
      fillColor: '#e0e8ff',
      rimColor: '#ff00cc',
      topColor: '#ffffff',
      softboxColor: '#ff0040',
      softboxColorR: '#0088ff',
      accentColor: '#ff00cc',
      keyIntensity: 1.4,
      fillIntensity: 0.25,
      rimIntensity: 0.8,
      softboxIntensity: 0.8,
      accentIntensity: 1.6,
      ambient: 0.2,
      colorRing: true,
      colorRingIntensity: 2.0,
      colorRingCount: 4,
      colorRingSpeed: 6,
      colorRingColors: ['#ff0040', '#00ff88', '#0088ff', '#ff00cc', '#ffee00', '#ffffff'],
      gelSaturation: 1.35,
      gelWash: 0,
    },
  },
  {
    id: 'prism',
    label: 'Prism',
    blurb: 'Six-color static ring — rainbow product wash.',
    swatches: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b5179e', '#f72585'],
    patch: {
      keyColor: '#fff8f0',
      fillColor: '#f0f4ff',
      rimColor: '#b5179e',
      softboxColor: '#ffffff',
      softboxColorR: '',
      accentColor: '#4cc9f0',
      keyIntensity: 1.6,
      fillIntensity: 0.35,
      ambient: 0.28,
      colorRing: true,
      colorRingIntensity: 1.8,
      colorRingCount: 6,
      colorRingSpeed: 0,
      colorRingHeight: 0.4,
      colorRingRadius: 0.6,
      colorRingColors: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b5179e', '#f72585'],
      gelSaturation: 1.2,
      gelWash: 0,
    },
  },
  {
    id: 'duo-chrome',
    label: 'Duo Chrome',
    blurb: 'Split softboxes — orange left, blue right.',
    swatches: ['#ff7a18', '#1b9aaa'],
    patch: {
      keyColor: '#fff0e0',
      fillColor: '#d0eef2',
      rimColor: '#1b9aaa',
      softboxColor: '#ff7a18',
      softboxColorR: '#1b9aaa',
      softboxIntensity: 2.4,
      softboxSize: 1.3,
      accentColor: '#ff7a18',
      accentIntensity: 0.8,
      rimIntensity: 0.6,
      gelSaturation: 1.2,
      gelWash: 0,
      colorRing: false,
    },
  },
  {
    id: 'lavender',
    label: 'Lavender Mist',
    blurb: 'Soft purple wash — beauty / fragrance mood.',
    swatches: ['#e8d5ff', '#c9a0ff', '#9b5de5'],
    patch: {
      keyColor: '#f5e8ff',
      fillColor: '#e0d0ff',
      rimColor: '#c9a0ff',
      topColor: '#f8f0ff',
      softboxColor: '#e8d5ff',
      softboxColorR: '#d4b8ff',
      accentColor: '#9b5de5',
      softboxIntensity: 1.5,
      rimIntensity: 0.7,
      accentIntensity: 0.9,
      gelSaturation: 1.05,
      gelWash: 0.12,
      colorRing: false,
    },
  },
];

export const getColorScheme = (id: string): ColorScheme =>
  COLOR_SCHEMES.find((c) => c.id === id) ?? COLOR_SCHEMES[0];

/** Apply a color scheme onto the current light params. */
export function applyColorScheme(current: LightParams, id: string): LightParams {
  const scheme = getColorScheme(id);
  return {
    ...current,
    ...scheme.patch,
    master: current.master,
    showHelpers: current.showHelpers,
    mute: current.mute,
    solo: current.solo,
    keyDistance: current.keyDistance,
    fillElevation: current.fillElevation,
    softboxLinked: current.softboxLinked,
    // schemes set gel hex — clear Kelvin so gels win
    keyKelvin: 0,
    fillKelvin: 0,
    colorRingColors: scheme.patch.colorRingColors
      ? [...scheme.patch.colorRingColors]
      : current.colorRingColors,
  };
}

/** GEL swatches for quick single-channel picks. */
/** Approximate black-body Kelvin → sRGB hex (1000–12000 K). */
export function kelvinToHex(kelvin: number): string {
  const k = Math.max(1000, Math.min(12000, kelvin)) / 100;
  let r: number, g: number, b: number;
  if (k <= 66) {
    r = 255;
    g = Math.max(0, Math.min(255, 99.4708025861 * Math.log(k) - 161.1195681661));
    b =
      k <= 19
        ? 0
        : Math.max(0, Math.min(255, 138.5177312231 * Math.log(k - 10) - 305.0447927307));
  } else {
    r = Math.max(0, Math.min(255, 329.698727446 * Math.pow(k - 60, -0.1332047592)));
    g = Math.max(0, Math.min(255, 288.1221695283 * Math.pow(k - 60, -0.0755148492)));
    b = 255;
  }
  const hex = (n: number) =>
    Math.round(n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Resolve effective channel gain after mute/solo. */
export function channelGain(
  light: LightParams,
  channel: LightChannelId
): number {
  if (light.solo) return light.solo === channel ? 1 : 0;
  if (light.mute?.[channel]) return 0;
  return 1;
}

/** Effective color for a channel (Kelvin overrides gel hex when > 0). */
export function channelColor(
  light: LightParams,
  which: 'key' | 'fill'
): string {
  const kelvin = which === 'key' ? light.keyKelvin : light.fillKelvin;
  if (kelvin && kelvin >= 1000) return kelvinToHex(kelvin);
  return which === 'key' ? light.keyColor : light.fillColor;
}

export const KELVIN_PRESETS = [
  { label: 'Candle', k: 1800 },
  { label: 'Tungsten', k: 3200 },
  { label: 'Halogen', k: 3000 },
  { label: 'Warm LED', k: 3500 },
  { label: 'Moon', k: 4100 },
  { label: 'D50', k: 5000 },
  { label: 'Daylight', k: 5600 },
  { label: 'Flash', k: 5500 },
  { label: 'Overcast', k: 6500 },
  { label: 'Shade', k: 7500 },
  { label: 'Blue sky', k: 10000 },
];

export const GEL_SWATCHES: { label: string; hex: string }[] = [
  { label: 'CTO', hex: '#ffb347' },
  { label: 'CTB', hex: '#9ec9ff' },
  { label: 'Plus Green', hex: '#7dffb3' },
  { label: 'Minus Green', hex: '#ff8ad4' },
  { label: 'Primary Red', hex: '#ff2a2a' },
  { label: 'Primary Blue', hex: '#2a6bff' },
  { label: 'Primary Green', hex: '#20c997' },
  { label: 'Amber', hex: '#ff9f1c' },
  { label: 'Magenta', hex: '#ff2d95' },
  { label: 'Cyan', hex: '#00e5ff' },
  { label: 'Violet', hex: '#9b5de5' },
  { label: 'Lime', hex: '#c6ff00' },
  { label: 'Rose', hex: '#ff6b9d' },
  { label: 'Steel', hex: '#8aa0b8' },
  { label: 'White', hex: '#ffffff' },
  { label: 'Warm White', hex: '#fff5e8' },
];
