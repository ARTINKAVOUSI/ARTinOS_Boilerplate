import type { RoomParams } from './room-params';

/**
 * Space architecture catalog — adaptive spatial shells layered on top of the
 * frustum-fitted chamber. Spaces are orthogonal to content: any content can
 * play inside any space. Rendering lives in `components/spaces`.
 *
 *   contained     — cyclorama chamber, gallery niche, lightbox room
 *   stage         — monolith frame, tier deck
 *   architectural — interior slice, runway corridor, open pavilion
 *   atmospheric   — atmos volume
 */

export type SpaceCategory = 'contained' | 'stage' | 'architectural' | 'atmospheric';

export interface SpaceInfo {
  id: string;
  label: string;
  /** compact name for pills */
  short: string;
  blurb: string;
  mood: string;
  category: SpaceCategory;
  /** parameter nudges applied when the space is selected */
  overrides?: Partial<RoomParams>;
}

export const SPACE_CATEGORIES: readonly { id: SpaceCategory; label: string }[] = [
  { id: 'contained', label: 'Contained' },
  { id: 'stage', label: 'Stage' },
  { id: 'architectural', label: 'Architectural' },
  { id: 'atmospheric', label: 'Atmospheric' },
];

export const SPACES: readonly SpaceInfo[] = [
  {
    id: 'cyclo',
    label: 'Cyclo Chamber',
    short: 'Cyclo',
    blurb: 'Seamless open-front cyclorama — the reference studio shell.',
    mood: 'calm · premium · studio',
    category: 'contained',
  },
  {
    id: 'niche',
    label: 'Gallery Niche',
    short: 'Niche',
    blurb: 'Recessed exhibition bay with surround and plinth. Aperture tracks the room.',
    mood: 'curated · luxury · museum',
    category: 'contained',
    overrides: { radius: 0.9, rearInset: 0.15, fov: 33 },
  },
  {
    id: 'lightbox',
    label: 'Lightbox Room',
    short: 'Lightbox',
    blurb: 'Luminous diffuse panels — SSGI carries their bounce through the space.',
    mood: 'precision · clean · futuristic',
    category: 'contained',
    overrides: { ssgiIntensity: 1.3, lightIntensity: 0.7, roughness: 0.85 },
  },
  {
    id: 'monolith',
    label: 'Monolith Frame',
    short: 'Monolith',
    blurb: 'Sculptural portal that keeps the subject optically framed at any aspect.',
    mood: 'iconic · graphic · poster',
    category: 'stage',
    overrides: { depth: 7, fov: 33 },
  },
  {
    id: 'tiers',
    label: 'Tier Deck',
    short: 'Tiers',
    blurb: 'Concentric soft terraces — retail-display sculpture that scales with width.',
    mood: 'editorial · retail · sculptural',
    category: 'stage',
    overrides: { depth: 7.5 },
  },
  {
    id: 'slice',
    label: 'Interior Slice',
    short: 'Slice',
    blurb: 'Editorial interior vignette: warm window band, bench ledge, natural key.',
    mood: 'lifestyle · warm · editorial',
    category: 'architectural',
    overrides: { lightIntensity: 0.75, exposure: 1.1 },
  },
  {
    id: 'runway',
    label: 'Runway Corridor',
    short: 'Runway',
    blurb: 'Deep procession corridor — light strips repeat with the vanishing depth.',
    mood: 'cinematic · directional · reveal',
    category: 'architectural',
    overrides: { depth: 11, rearInset: 0.6, fov: 38, radius: 0.7 },
  },
  {
    id: 'pavilion',
    label: 'Open Pavilion',
    short: 'Pavilion',
    blurb: 'Semi-open shell with a skylight shaft and faint distance haze.',
    mood: 'airy · serene · indoor/outdoor',
    category: 'architectural',
    overrides: { height: 6, lightIntensity: 0.85 },
  },
  {
    id: 'atmos',
    label: 'Atmos Volume',
    short: 'Atmos',
    blurb: 'Space defined by haze, a glow field and one volumetric downlight.',
    mood: 'dreamy · immersive · abstract',
    category: 'atmospheric',
    overrides: { depth: 9, lightIntensity: 0.55, ssgiIntensity: 1.4, exposure: 1.15 },
  },
];

export const getSpace = (id: string): SpaceInfo => SPACES.find((s) => s.id === id) ?? SPACES[0];
