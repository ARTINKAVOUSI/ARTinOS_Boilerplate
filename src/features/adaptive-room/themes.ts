/**
 * A theme is one architectural mood: the plaster's colour and surface
 * response, and the light temperatures. Themes never touch the adaptive
 * geometry, only material and light.
 */
export interface Theme {
  id: string
  /** Shell albedo. */
  room: string
  roughness: number
  /** Key and fill light colours. */
  key: string
  fill: string
  /** Hemisphere (ambient) sky and ground colours. */
  hemiSky: string
  hemiGround: string
  /** Suggested multiplier over the whole rig. */
  lightIntensity: number
}

export const THEMES: Theme[] = [
  { id: 'studio', room: '#e9e4dc', roughness: 0.95, key: '#fff5e8', fill: '#e7ecf5', hemiSky: '#fdf6ea', hemiGround: '#b8b0a4', lightIntensity: 1 },
  { id: 'limestone', room: '#ddd0b9', roughness: 0.97, key: '#ffe9c4', fill: '#f3e6d0', hemiSky: '#fff0d8', hemiGround: '#a8977d', lightIntensity: 1.05 },
  { id: 'terracotta', room: '#b96c4d', roughness: 0.93, key: '#ffd9b0', fill: '#d9c4bb', hemiSky: '#ffdcc0', hemiGround: '#7a4630', lightIntensity: 1.12 },
  { id: 'sage', room: '#c2cab7', roughness: 0.96, key: '#fbf3e2', fill: '#dde7dd', hemiSky: '#f2f5e9', hemiGround: '#8a9383', lightIntensity: 1 },
  { id: 'concrete', room: '#b3b5b8', roughness: 0.88, key: '#f4f6fa', fill: '#dfe5ee', hemiSky: '#eef1f6', hemiGround: '#85878a', lightIntensity: 1.1 },
  { id: 'noir', room: '#46454b', roughness: 0.9, key: '#ffdfae', fill: '#9aa7c0', hemiSky: '#6b6a70', hemiGround: '#26252b', lightIntensity: 1.4 },
  // Studio and photography grades
  { id: 'pure-white', room: '#f4f4f2', roughness: 0.98, key: '#ffffff', fill: '#f0f2f6', hemiSky: '#ffffff', hemiGround: '#d0d0cc', lightIntensity: 1.35 },
  { id: 'paper-white', room: '#efece6', roughness: 0.97, key: '#fffaf2', fill: '#ebe6dc', hemiSky: '#fff8ee', hemiGround: '#c8c2b6', lightIntensity: 1.2 },
  { id: 'daylight', room: '#e6e8ec', roughness: 0.96, key: '#eef4ff', fill: '#d8e4f4', hemiSky: '#f0f6ff', hemiGround: '#a8b0bc', lightIntensity: 1.25 },
  { id: 'tungsten', room: '#e8ddd0', roughness: 0.94, key: '#ffc878', fill: '#e8c8a0', hemiSky: '#ffe8c4', hemiGround: '#a88868', lightIntensity: 1.3 },
  { id: 'softbox', room: '#eceae6', roughness: 0.99, key: '#fff8f0', fill: '#f0ece8', hemiSky: '#fffaf4', hemiGround: '#c8c4be', lightIntensity: 1.15 },
  { id: 'high-key', room: '#f6f5f2', roughness: 0.98, key: '#ffffff', fill: '#ffffff', hemiSky: '#ffffff', hemiGround: '#e8e6e0', lightIntensity: 1.8 },
  { id: 'low-key', room: '#2e2c2a', roughness: 0.88, key: '#ffe8c8', fill: '#6a6870', hemiSky: '#4a4844', hemiGround: '#1a1816', lightIntensity: 1.6 },
  { id: 'chrome-lab', room: '#c8ccd0', roughness: 0.55, key: '#f8faff', fill: '#c0d0e8', hemiSky: '#e8eef8', hemiGround: '#788088', lightIntensity: 1.4 },
  { id: 'fashion-gray', room: '#9a9a98', roughness: 0.92, key: '#fff0e4', fill: '#d0d4dc', hemiSky: '#e8e6e0', hemiGround: '#686664', lightIntensity: 1.25 },
  { id: 'beauty-blush', room: '#f0e4dc', roughness: 0.96, key: '#ffe8e0', fill: '#f0d8d0', hemiSky: '#fff0ea', hemiGround: '#c8a8a0', lightIntensity: 1.2 },
  { id: 'product-slate', room: '#d0d4d8', roughness: 0.9, key: '#f4f6fa', fill: '#d0d8e4', hemiSky: '#eef0f4', hemiGround: '#888c90', lightIntensity: 1.3 },
  { id: 'sepia-print', room: '#d8c8b0', roughness: 0.95, key: '#f0d8a8', fill: '#d8c0a0', hemiSky: '#f4e4c4', hemiGround: '#988870', lightIntensity: 1.15 },
]

export const getTheme = (id: string): Theme => THEMES.find(theme => theme.id === id) ?? THEMES[0]
