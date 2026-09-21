/**
 * The glass material's controls, ported from v1's glass-parameters: every
 * surface setting with v1's labels, groups, descriptions and Advanced flags,
 * so any glass feature exposes the whole material in the Inspector without
 * redeclaring thirty controls. Spread it into a feature's `controls`, passing
 * the defaults that object wants.
 */
import type { Controls } from '../../../app/feature'

type GlassDefaults = Partial<{
  color: string
  transmission: number
  ior: number
  thickness: number
  roughness: number
  dispersion: number
  anisotropicBlur: number
  attenuationColor: string
  attenuationDistance: number
  envMapIntensity: number
  samples: number
  backside: boolean
  backsideThickness: number
  backdropResolutionScale: number
  backsideResolutionScale: number
}>

/** v1's defaults — the reference rings' look. */
const V1: Required<GlassDefaults> = {
  color: '#ffffff',
  transmission: 1,
  ior: 1.26,
  thickness: 0.98,
  roughness: 0.05,
  dispersion: 6,
  anisotropicBlur: 0,
  attenuationColor: '#f1e2d3',
  attenuationDistance: 8,
  envMapIntensity: 0.8,
  samples: 4,
  backside: true,
  backsideThickness: 3,
  backdropResolutionScale: 0.85,
  backsideResolutionScale: 0.7,
}

export function glassControls(overrides: GlassDefaults = {}): Controls {
  const d = { ...V1, ...overrides }
  return {
    // ── Glass ────────────────────────────────────────────────────────────
    color: { type: 'color', value: d.color, label: 'Surface Color', group: 'Glass' },
    transmission: { type: 'number', value: d.transmission, min: 0, max: 1, step: 0.01, label: 'Transmission', group: 'Glass' },
    ior: { type: 'number', value: d.ior, min: 1, max: 2.5, step: 0.01, label: 'IOR', group: 'Glass', description: 'Air 1.0 · water 1.33 · glass 1.5' },
    thickness: { type: 'number', value: d.thickness, min: 0, max: 5, step: 0.01, label: 'Thickness', group: 'Glass' },
    roughness: { type: 'number', value: d.roughness, min: 0, max: 1, step: 0.01, label: 'Roughness', group: 'Glass' },
    dispersion: { type: 'number', value: d.dispersion, min: 0, max: 20, step: 0.1, label: 'Dispersion', group: 'Glass' },
    spectralDispersion: {
      type: 'boolean',
      value: false,
      label: 'Spectral Dispersion',
      group: 'Glass',
      advanced: true,
      description: 'Stratified spectrum instead of R/G/B taps. Recompiles the shader.',
    },
    anisotropicBlur: { type: 'number', value: d.anisotropicBlur, min: 0, max: 1, step: 0.01, label: 'Frost', group: 'Glass' },

    // ── Glass Volume ─────────────────────────────────────────────────────
    attenuationColor: { type: 'color', value: d.attenuationColor, label: 'Attenuation Color', group: 'Glass Volume' },
    attenuationDistance: { type: 'number', value: d.attenuationDistance, min: 0, max: 20, step: 0.1, label: 'Attenuation Distance', group: 'Glass Volume' },
    distortion: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Distortion', group: 'Glass Volume' },
    distortionScale: { type: 'number', value: 0.5, min: 0, max: 2, step: 0.01, label: 'Distortion Scale', group: 'Glass Volume' },
    temporalDistortion: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Temporal Distortion', group: 'Glass Volume' },

    // ── Glass Surface ────────────────────────────────────────────────────
    envMapIntensity: { type: 'number', value: d.envMapIntensity, min: 0, max: 5, step: 0.01, label: 'Env Intensity', group: 'Glass Surface' },
    clearcoat: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Clearcoat', group: 'Glass Surface' },
    iridescence: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Iridescence', group: 'Glass Surface' },
    metalness: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Metalness', group: 'Glass Surface', advanced: true },
    specularIntensity: { type: 'number', value: 1, min: 0, max: 1, step: 0.01, label: 'Reflectivity', group: 'Glass Surface', advanced: true },
    clearcoatRoughness: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Clearcoat Roughness', group: 'Glass Surface', advanced: true },
    iridescenceIOR: { type: 'number', value: 1.3, min: 1, max: 2.5, step: 0.01, label: 'Film IOR', group: 'Glass Surface', advanced: true },
    iridescenceThicknessMin: { type: 'number', value: 100, min: 0, max: 1000, step: 1, label: 'Film Thickness Min', group: 'Glass Surface', advanced: true },
    iridescenceThicknessMax: { type: 'number', value: 400, min: 0, max: 1000, step: 1, label: 'Film Thickness Max', group: 'Glass Surface', advanced: true },
    sheen: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Sheen', group: 'Glass Surface', advanced: true },
    sheenRoughness: { type: 'number', value: 1, min: 0, max: 1, step: 0.01, label: 'Sheen Roughness', group: 'Glass Surface', advanced: true },
    anisotropy: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Anisotropy', group: 'Glass Surface', advanced: true },
    anisotropyRotation: { type: 'number', value: 0, min: -Math.PI, max: Math.PI, step: 0.01, label: 'Anisotropy Rotation', group: 'Glass Surface', advanced: true },
    specularColor: { type: 'color', value: '#ffffff', label: 'Specular Color', group: 'Glass Surface', advanced: true },
    sheenColor: { type: 'color', value: '#ffffff', label: 'Sheen Color', group: 'Glass Surface', advanced: true },

    // ── Glass Quality ────────────────────────────────────────────────────
    forceSinglePass: { type: 'boolean', value: false, label: 'Force Single Pass', group: 'Glass Quality', advanced: true },
    samples: {
      type: 'number',
      value: d.samples,
      min: 1,
      max: 16,
      step: 1,
      label: 'Samples',
      group: 'Glass Quality',
      description: 'Baked into the refraction loop. Spectral mode uses at least 3 samples to cover all color lobes. Recompiles the shader.',
    },
    backside: { type: 'boolean', value: d.backside, label: 'Backside Pass', group: 'Glass Quality' },
    backsideThickness: { type: 'number', value: d.backsideThickness, min: 0, max: 10, step: 0.01, label: 'Backside Thickness', group: 'Glass Quality' },
    backdropResolutionScale: { type: 'number', value: d.backdropResolutionScale, min: 0.25, max: 1, step: 0.05, label: 'Backdrop Scale', group: 'Glass Quality' },
    backsideResolutionScale: { type: 'number', value: d.backsideResolutionScale, min: 0.25, max: 1, step: 0.05, label: 'Clean Pass Scale', group: 'Glass Quality' },
  }
}
