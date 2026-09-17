import { options, type ParamSchema } from '../../core/param-schema';
import type { LightParams, StagingParams } from './lighting';
import type { RoomParams, SimOpts } from './room-params';

const LIGHT_MODE_IDS = ['studio', 'softbox', 'beauty', 'dramatic', 'product', 'gallery', 'daylight', 'neon'] as const;

export const ROOM_SCHEMA: ParamSchema<RoomParams> = {
  height: { type: 'number', label: 'Height', group: 'Shell', min: 2, max: 12, step: 0.05, unit: 'm' },
  depth: { type: 'number', label: 'Depth', group: 'Shell', min: 2.5, max: 24, step: 0.05, unit: 'm' },
  radius: { type: 'number', label: 'Corner Radius', group: 'Shell', min: 0.05, max: 4, step: 0.01, unit: 'm' },
  rearInset: { type: 'number', label: 'Rear Inset', group: 'Shell', min: 0, max: 4, step: 0.01, unit: 'm', advanced: true },
  wallThickness: { type: 'number', label: 'Wall Thickness', group: 'Shell', min: 0.04, max: 0.8, step: 0.005, unit: 'm', advanced: true },
  color: { type: 'color', label: 'Plaster Color', group: 'Surface' },
  roughness: { type: 'number', label: 'Roughness', group: 'Surface', min: 0, max: 1, step: 0.01 },
  bumpScale: { type: 'number', label: 'Texture Relief', group: 'Surface', min: 0, max: 3, step: 0.01, advanced: true },

  fov: { type: 'number', label: 'FOV', group: 'Camera', min: 12, max: 90, step: 0.5, unit: '°', modulatable: true },
  distanceBias: { type: 'number', label: 'Distance Bias', group: 'Camera', min: 0.3, max: 2, step: 0.005, modulatable: true },
  margin: { type: 'number', label: 'Composition Margin', group: 'Camera', min: 0, max: 0.28, step: 0.005 },
  targetBias: { type: 'number', label: 'Vertical Bias', group: 'Camera', min: -0.5, max: 0.5, step: 0.01, modulatable: true },
  parallax: { type: 'boolean', label: 'Pointer Parallax', group: 'Camera' },
  subjectScale: { type: 'number', label: 'Subject Scale', group: 'Subject', min: 0.25, max: 3, step: 0.01, modulatable: true },

  ssgiIntensity: { type: 'number', label: 'SSGI Intensity', group: 'Render', min: 0, max: 4, step: 0.01, modulatable: true },
  exposure: { type: 'number', label: 'Exposure', group: 'Render', min: 0.2, max: 3, step: 0.01, modulatable: true },

  // Legacy preset fields — mapped onto LightParams when a preset is resolved.
  lightIntensity: { type: 'number', label: 'Light Intensity (legacy)', group: 'Legacy', min: 0, max: 3, step: 0.01, hidden: true },
  keyAzimuth: { type: 'number', label: 'Key Azimuth (legacy)', group: 'Legacy', min: -180, max: 180, step: 1, hidden: true },
  fillIntensity: { type: 'number', label: 'Fill Intensity (legacy)', group: 'Legacy', min: 0, max: 4, step: 0.01, hidden: true },
};

export const SIM_SCHEMA: ParamSchema<SimOpts> = {
  density: { type: 'number', label: 'Density', group: 'Simulation', min: 0.1, max: 4, step: 0.05 },
  speed: { type: 'number', label: 'Speed', group: 'Simulation', min: 0, max: 4, step: 0.05, modulatable: true },
};

const azimuth = (group: string) =>
  ({ type: 'number', label: 'Azimuth', group, min: -180, max: 180, step: 1, unit: '°', modulatable: true }) as const;
const elevation = (group: string, max = 90) =>
  ({ type: 'number', label: 'Elevation', group, min: 0, max, step: 1, unit: '°' }) as const;
const intensity = (group: string, max: number) =>
  ({ type: 'number', label: 'Intensity', group, min: 0, max, step: 0.01, modulatable: true }) as const;
const color = (group: string, label = 'Color', allowEmpty = false) =>
  ({ type: 'color', label, group, allowEmpty }) as const;
const kelvin = (group: string) =>
  ({ type: 'number', label: 'Temperature', group, min: 0, max: 12000, step: 50, unit: 'K', advanced: true, description: '0 uses the gel color; 1000–12000 overrides it.' }) as const;

export const LIGHT_SCHEMA: ParamSchema<LightParams> = {
  mode: { type: 'enum', label: 'Light Mode', group: 'Light', options: options(LIGHT_MODE_IDS) },
  master: { type: 'number', label: 'Master', group: 'Light', min: 0, max: 3, step: 0.01, modulatable: true },
  ambient: { type: 'number', label: 'Ambient', group: 'Light', min: 0, max: 2, step: 0.01, modulatable: true },
  shadowSoftness: { type: 'number', label: 'Shadow Softness', group: 'Light', min: 0, max: 1, step: 0.01 },
  gelSaturation: { type: 'number', label: 'Gel Saturation', group: 'Light', min: 0, max: 1.8, step: 0.01, advanced: true },
  gelWash: { type: 'number', label: 'Wash to White', group: 'Light', min: 0, max: 1, step: 0.01, advanced: true },
  showHelpers: { type: 'boolean', label: 'Light Helpers', group: 'Light', advanced: true },

  keyIntensity: intensity('Light / Key', 6),
  keyAzimuth: azimuth('Light / Key'),
  keyElevation: elevation('Light / Key'),
  keyColor: color('Light / Key'),
  keyKelvin: kelvin('Light / Key'),
  keySoftness: { type: 'number', label: 'Softness', group: 'Light / Key', min: 0, max: 1, step: 0.01 },
  keyDistance: { type: 'number', label: 'Distance', group: 'Light / Key', min: 0.5, max: 2, step: 0.01, advanced: true },

  fillIntensity: intensity('Light / Fill', 4),
  fillAzimuth: azimuth('Light / Fill'),
  fillElevation: elevation('Light / Fill', 70),
  fillColor: color('Light / Fill'),
  fillKelvin: kelvin('Light / Fill'),

  rimIntensity: intensity('Light / Rim', 5),
  rimAzimuth: azimuth('Light / Rim'),
  rimColor: color('Light / Rim'),
  rimSpread: { type: 'number', label: 'Spread', group: 'Light / Rim', min: 0.1, max: 1, step: 0.01, advanced: true },

  topIntensity: intensity('Light / Top', 5),
  topColor: color('Light / Top'),

  softboxIntensity: intensity('Light / Softbox', 6),
  softboxSize: { type: 'number', label: 'Size', group: 'Light / Softbox', min: 0.4, max: 2.5, step: 0.01 },
  softboxColor: color('Light / Softbox'),
  softboxColorR: color('Light / Softbox', 'Right Color', true),
  softboxLinked: { type: 'boolean', label: 'Link Colors', group: 'Light / Softbox', advanced: true },

  accentIntensity: intensity('Light / Accent', 6),
  accentColor: color('Light / Accent'),

  colorRing: { type: 'boolean', label: 'Color Ring', group: 'Light / Ring' },
  colorRingIntensity: intensity('Light / Ring', 4),
  colorRingCount: { type: 'number', label: 'Count', group: 'Light / Ring', min: 2, max: 6, step: 1 },
  colorRingRadius: { type: 'number', label: 'Radius', group: 'Light / Ring', min: 0.2, max: 0.9, step: 0.01 },
  colorRingHeight: { type: 'number', label: 'Height', group: 'Light / Ring', min: 0.05, max: 0.9, step: 0.01 },
  colorRingSpeed: { type: 'number', label: 'Spin', group: 'Light / Ring', min: 0, max: 20, step: 0.1, unit: 'rpm', modulatable: true },
};

export const STAGING_SCHEMA: ParamSchema<StagingParams> = {
  plinth: { type: 'boolean', label: 'Plinth', group: 'Staging' },
  plinthHeight: { type: 'number', label: 'Plinth Height', group: 'Staging', min: 0.08, max: 1.2, step: 0.01 },
  plinthRadius: { type: 'number', label: 'Plinth Radius', group: 'Staging', min: 0.25, max: 2, step: 0.01 },
  plinthColor: { type: 'color', label: 'Plinth Color', group: 'Staging', allowEmpty: true, advanced: true },
  turntable: { type: 'boolean', label: 'Turntable', group: 'Staging' },
  turntableSpeed: { type: 'number', label: 'Turntable Speed', group: 'Staging', min: 0.2, max: 20, step: 0.1, unit: 'rpm', modulatable: true },
  shadowCatcher: { type: 'boolean', label: 'Shadow Catcher', group: 'Staging' },
  shadowCatcherOpacity: { type: 'number', label: 'Catcher Opacity', group: 'Staging', min: 0.05, max: 0.7, step: 0.01 },
  shadowCatcherScale: { type: 'number', label: 'Catcher Scale', group: 'Staging', min: 0.5, max: 3, step: 0.01, advanced: true },
  backdrop: { type: 'boolean', label: 'Backdrop Card', group: 'Staging' },
  backdropWidth: { type: 'number', label: 'Backdrop Width', group: 'Staging', min: 0.8, max: 5, step: 0.01 },
  backdropHeight: { type: 'number', label: 'Backdrop Height', group: 'Staging', min: 0.8, max: 5, step: 0.01 },
  backdropColor: { type: 'color', label: 'Backdrop Color', group: 'Staging', allowEmpty: true, advanced: true },
  backdropOffset: { type: 'number', label: 'Backdrop Offset', group: 'Staging', min: 0.3, max: 3, step: 0.01, advanced: true },
  floorSheen: { type: 'number', label: 'Floor Sheen', group: 'Staging', min: 0, max: 1, step: 0.01 },
};
