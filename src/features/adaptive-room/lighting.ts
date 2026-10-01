/**
 * The room's light model: every parameter the rig reads, the curated recipes
 * that set the rig into a coherent look, and the gel schemes that colour it.
 *
 * A recipe is applied first, then a gel scheme; the room's controls scale the
 * result, so individual knobs always act on top of the look.
 */

export type LightChannelId = 'key' | 'fill' | 'rim' | 'top' | 'softbox' | 'accent' | 'ring' | 'ambient'

export interface LightParams {
  /** Multiplier over the whole rig. */
  master: number
  /** Hemisphere contribution and colours. */
  ambient: number
  skyColor: string
  groundColor: string

  /** Key (main) light: a shadow-casting directional light. */
  keyIntensity: number
  /** Degrees; negative is from the left. */
  keyAzimuth: number
  /** Degrees above the horizon. */
  keyElevation: number
  keyColor: string
  /** 0 hard … 1 very soft. */
  keySoftness: number

  fillIntensity: number
  fillAzimuth: number
  fillColor: string

  /** Rim / kicker spot from behind. */
  rimIntensity: number
  rimAzimuth: number
  rimColor: string
  /** Spot cone factor. */
  rimSpread: number

  /** Overhead spot. */
  topIntensity: number
  topColor: string

  /** Twin softbox spots, left and right of the opening. */
  softboxIntensity: number
  softboxSize: number
  softboxColor: string
  /** Right panel colour; empty mirrors softboxColor. */
  softboxColorR: string

  /** Practical accent / bounce point light. */
  accentIntensity: number
  accentColor: string

  /** Ring of coloured point lights. */
  colorRing: boolean
  colorRingIntensity: number
  /** 2–6. */
  colorRingCount: number
  /** Fraction of the room. */
  colorRingRadius: number
  /** 0 floor … 1 ceiling. */
  colorRingHeight: number
  /** Revolutions per minute; 0 is static. */
  colorRingSpeed: number
  /** Up to six gel colours. */
  colorRingColors: string[]

  /** Gel saturation: 0 pale, 1 as set, 1.5 punchy. */
  gelSaturation: number
  /** Mix coloured lights toward white: 0 full gel, 1 white. */
  gelWash: number

  shadowSoftness: number
  /** Light position markers. */
  showHelpers: boolean
  /** When set, every other channel is muted. */
  solo: LightChannelId | null
}

export const DEFAULT_LIGHT: LightParams = {
  master: 1,
  ambient: 0.42,
  skyColor: '#fdf6ea',
  groundColor: '#b8b0a4',
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
  showHelpers: false,
  solo: null,
}

export type LightModeId = 'studio' | 'softbox' | 'beauty' | 'dramatic' | 'product' | 'gallery' | 'daylight' | 'neon'

export const LIGHT_MODES: Record<LightModeId, Partial<LightParams>> = {
  // Classic key + fill + ambient. Clean product default.
  studio: {
    keyIntensity: 2.6, keyAzimuth: -28, keyElevation: 42, keySoftness: 0.45,
    fillIntensity: 0.55, fillAzimuth: 35, rimIntensity: 0.15, rimAzimuth: 155,
    topIntensity: 0.1, softboxIntensity: 0, accentIntensity: 0, ambient: 0.42,
  },
  // Twin softboxes + soft overhead: beauty, cosmetics.
  softbox: {
    keyIntensity: 0.6, keySoftness: 0.85, fillIntensity: 0.25, rimIntensity: 0,
    topIntensity: 0.8, softboxIntensity: 2.4, softboxSize: 1.3, ambient: 0.35, shadowSoftness: 0.8,
  },
  // High soft key above + fill below. Flattering, even.
  beauty: {
    keyIntensity: 2.2, keyElevation: 55, keyAzimuth: 0, keySoftness: 0.75,
    fillIntensity: 1.4, fillAzimuth: 0, rimIntensity: 0.3, rimAzimuth: 180,
    topIntensity: 1, softboxIntensity: 1.2, softboxSize: 1.1, ambient: 0.5,
  },
  // Hard side key, deep shadows, strong rim. Chiaroscuro.
  dramatic: {
    keyIntensity: 3.4, keyAzimuth: -55, keyElevation: 28, keySoftness: 0.12,
    fillIntensity: 0.08, rimIntensity: 1.6, rimAzimuth: 150, rimSpread: 0.35,
    topIntensity: 0, softboxIntensity: 0, ambient: 0.18, shadowSoftness: 0.15,
  },
  // Top-down key + twin soft sides. Catalogue packshot.
  product: {
    keyIntensity: 1.4, keyElevation: 70, keyAzimuth: -10, keySoftness: 0.6,
    fillIntensity: 0.5, rimIntensity: 0.4, rimAzimuth: 170, topIntensity: 1.6,
    softboxIntensity: 1.8, softboxSize: 1, ambient: 0.4,
  },
  // Museum overhead spots + soft ambient. Calm exhibit light.
  gallery: {
    keyIntensity: 1.2, keyElevation: 65, keyAzimuth: -15, keySoftness: 0.55,
    fillIntensity: 0.45, rimIntensity: 0, topIntensity: 2.2, softboxIntensity: 0.4,
    ambient: 0.55, accentIntensity: 0.3,
  },
  // Large cool window + warm sun key. Natural interior.
  daylight: {
    keyIntensity: 2.8, keyAzimuth: -50, keyElevation: 35, keyColor: '#fff6e8', keySoftness: 0.35,
    fillIntensity: 0.7, fillColor: '#d8e4f8', rimIntensity: 0.2, topIntensity: 0.5,
    softboxIntensity: 2, softboxColor: '#e8f0ff', softboxSize: 1.6, ambient: 0.48,
  },
  // Cool coloured practicals + hard key. Editorial, night.
  neon: {
    keyIntensity: 2, keyAzimuth: -30, keyElevation: 40, keySoftness: 0.3,
    fillIntensity: 0.2, rimIntensity: 1.2, rimColor: '#66aaff', rimAzimuth: 140,
    topIntensity: 0.2, softboxIntensity: 0.3, accentIntensity: 2.4, accentColor: '#ff6ab0', ambient: 0.22,
  },
}

/** Gel schemes: multi-colour looks applied over a recipe. */
export const COLOR_SCHEMES: Record<string, Partial<LightParams>> = {
  // Warm key + cool fill: classic studio balance.
  neutral: {
    keyColor: '#fff5e8', fillColor: '#e7ecf5', rimColor: '#fff0e0', topColor: '#fff8f0',
    softboxColor: '#ffffff', softboxColorR: '', accentColor: '#c8d4e8',
    gelSaturation: 0.85, gelWash: 0.15, colorRing: false,
  },
  // Amber key vs teal fill: cinematic cross-gel.
  'warm-cool': {
    keyColor: '#ffb347', fillColor: '#4ecdc4', rimColor: '#ffe0a0', topColor: '#ffd9a0',
    softboxColor: '#ffe8c8', softboxColorR: '#c8f0ea', accentColor: '#5eead4',
    gelSaturation: 1.15, gelWash: 0.05, colorRing: false, softboxIntensity: 1.2,
  },
  // Bold complementary gels: editorial fashion.
  'magenta-cyan': {
    keyColor: '#ffd6e8', fillColor: '#b8f0ff', rimColor: '#ff2d95', topColor: '#e8f8ff',
    softboxColor: '#ff2d95', softboxColorR: '#00e5ff', accentColor: '#ff2d95',
    rimIntensity: 1.4, softboxIntensity: 1.8, accentIntensity: 1.5,
    gelSaturation: 1.25, gelWash: 0, colorRing: false,
  },
  // Golden-hour key, rose fill, violet rim.
  sunset: {
    keyColor: '#ff8c42', fillColor: '#ffb3c6', rimColor: '#7b5ea7', topColor: '#ffcfa3',
    softboxColor: '#ffb07c', softboxColorR: '#e8a0c8', accentColor: '#ff6b9d',
    keyIntensity: 2.8, rimIntensity: 1, gelSaturation: 1.2, gelWash: 0.05, colorRing: false,
  },
  // Icy blue-white key, deep blue rim.
  arctic: {
    keyColor: '#e8f4ff', fillColor: '#bae6fd', rimColor: '#38bdf8', topColor: '#f0f9ff',
    softboxColor: '#e0f2fe', softboxColorR: '#7dd3fc', accentColor: '#0ea5e9',
    rimIntensity: 1.1, gelSaturation: 1, gelWash: 0.1, colorRing: false,
  },
  // Moss-green fill, amber key, emerald accents.
  forest: {
    keyColor: '#f0e0c0', fillColor: '#95d5b2', rimColor: '#2d6a4f', topColor: '#e8f5e9',
    softboxColor: '#b7e4c7', softboxColorR: '#d8f3dc', accentColor: '#40916c',
    gelSaturation: 1.1, gelWash: 0.08, colorRing: false,
  },
  // Rotating RGB ring + magenta accent.
  club: {
    keyColor: '#ffe8f0', fillColor: '#e0e8ff', rimColor: '#ff00cc', topColor: '#ffffff',
    softboxColor: '#ff0040', softboxColorR: '#0088ff', accentColor: '#ff00cc',
    keyIntensity: 1.4, fillIntensity: 0.25, rimIntensity: 0.8, softboxIntensity: 0.8, accentIntensity: 1.6, ambient: 0.2,
    colorRing: true, colorRingIntensity: 2, colorRingCount: 4, colorRingSpeed: 6,
    colorRingColors: ['#ff0040', '#00ff88', '#0088ff', '#ff00cc', '#ffee00', '#ffffff'],
    gelSaturation: 1.35, gelWash: 0,
  },
  // Six-colour static ring: rainbow product wash.
  prism: {
    keyColor: '#fff8f0', fillColor: '#f0f4ff', rimColor: '#b5179e', softboxColor: '#ffffff', softboxColorR: '', accentColor: '#4cc9f0',
    keyIntensity: 1.6, fillIntensity: 0.35, ambient: 0.28,
    colorRing: true, colorRingIntensity: 1.8, colorRingCount: 6, colorRingSpeed: 0, colorRingHeight: 0.4, colorRingRadius: 0.6,
    colorRingColors: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b5179e', '#f72585'],
    gelSaturation: 1.2, gelWash: 0,
  },
  // Split softboxes: orange left, blue right.
  'duo-chrome': {
    keyColor: '#fff0e0', fillColor: '#d0eef2', rimColor: '#1b9aaa', softboxColor: '#ff7a18', softboxColorR: '#1b9aaa',
    softboxIntensity: 2.4, softboxSize: 1.3, accentColor: '#ff7a18', accentIntensity: 0.8, rimIntensity: 0.6,
    gelSaturation: 1.2, gelWash: 0, colorRing: false,
  },
  // Soft purple wash: beauty, fragrance.
  lavender: {
    keyColor: '#f5e8ff', fillColor: '#e0d0ff', rimColor: '#c9a0ff', topColor: '#f8f0ff',
    softboxColor: '#e8d5ff', softboxColorR: '#d4b8ff', accentColor: '#9b5de5',
    softboxIntensity: 1.5, rimIntensity: 0.7, accentIntensity: 0.9, gelSaturation: 1.05, gelWash: 0.12, colorRing: false,
  },
}

/** Effective gain of a channel after solo. */
export const channelGain = (light: LightParams, channel: LightChannelId) => (light.solo ? (light.solo === channel ? 1 : 0) : 1)
