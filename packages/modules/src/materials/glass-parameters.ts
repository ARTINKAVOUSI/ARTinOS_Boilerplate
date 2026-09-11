/**
 * Parameter definitions for the glass material, so any project can expose the whole surface in
 * the Inspector without redeclaring twenty controls. Register them on the project and read them
 * back with `useGlassParameters()`.
 */
import { useResolvedParameter, type ParameterDefinition } from '@artinos/runtime'
import type { GlassMaterialProps } from './GlassMaterial'

const num = (id: string, label: string, defaultValue: number, min: number, max: number, step: number, group: string, extra: Partial<ParameterDefinition> = {}) =>
  ({ id, label, type: 'number', defaultValue, min, max, step, group, ...extra }) as ParameterDefinition
const bool = (id: string, label: string, defaultValue: boolean, group: string, extra: Partial<ParameterDefinition> = {}) =>
  ({ id, label, type: 'boolean', defaultValue, group, ...extra }) as ParameterDefinition
const color = (id: string, label: string, defaultValue: string, group: string) =>
  ({ id, label, type: 'color', defaultValue, group, presentation: { preferred: 'color-control' } }) as ParameterDefinition

export const glassParameterDefs = {
  color: color('glass.color', 'Surface Color', '#ffffff', 'Glass'),
  transmission: num('glass.transmission', 'Transmission', 1, 0, 1, .01, 'Glass'),
  ior: num('glass.ior', 'IOR', 1.26, 1, 2.5, .01, 'Glass', { description: 'Air 1.0 · water 1.33 · glass 1.5' }),
  thickness: num('glass.thickness', 'Thickness', .98, 0, 5, .01, 'Glass'),
  roughness: num('glass.roughness', 'Roughness', .05, 0, 1, .01, 'Glass'),
  dispersion: num('glass.dispersion', 'Dispersion', 6, 0, 20, .1, 'Glass', { presentation: { preferred: 'knob' } }),
  spectralDispersion: bool('glass.spectralDispersion', 'Spectral Dispersion', false, 'Glass', { advanced: true, description: 'Stratified spectrum instead of R/G/B taps. Recompiles the shader.' }),
  anisotropicBlur: num('glass.anisotropicBlur', 'Frost', 0, 0, 1, .01, 'Glass'),

  attenuationColor: color('glass.attenuationColor', 'Attenuation Color', '#F1E2D3', 'Glass Volume'),
  attenuationDistance: num('glass.attenuationDistance', 'Attenuation Distance', 8, 0, 20, .1, 'Glass Volume'),
  distortion: num('glass.distortion', 'Distortion', 0, 0, 1, .01, 'Glass Volume', { modulatable: true }),
  distortionScale: num('glass.distortionScale', 'Distortion Scale', .5, 0, 2, .01, 'Glass Volume'),
  temporalDistortion: num('glass.temporalDistortion', 'Temporal Distortion', 0, 0, 1, .01, 'Glass Volume'),

  envMapIntensity: num('glass.envMapIntensity', 'Env Intensity', .8, 0, 5, .01, 'Glass Surface'),
  clearcoat: num('glass.clearcoat', 'Clearcoat', 0, 0, 1, .01, 'Glass Surface'),
  iridescence: num('glass.iridescence', 'Iridescence', 0, 0, 1, .01, 'Glass Surface'),

  metalness: num('glass.metalness', 'Metalness', 0, 0, 1, 0.01, 'Glass Surface', { advanced: true }),
  specularIntensity: num('glass.specularIntensity', 'Reflectivity', 1, 0, 1, 0.01, 'Glass Surface', { advanced: true }),
  clearcoatRoughness: num('glass.clearcoatRoughness', 'Clearcoat Roughness', 0, 0, 1, 0.01, 'Glass Surface', { advanced: true }),
  iridescenceIOR: num('glass.iridescenceIOR', 'Film IOR', 1.3, 1, 2.5, 0.01, 'Glass Surface', { advanced: true }),
  iridescenceThicknessMin: num('glass.iridescenceThicknessMin', 'Film Thickness Min', 100, 0, 1000, 1, 'Glass Surface', { advanced: true }),
  iridescenceThicknessMax: num('glass.iridescenceThicknessMax', 'Film Thickness Max', 400, 0, 1000, 1, 'Glass Surface', { advanced: true }),
  sheen: num('glass.sheen', 'Sheen', 0, 0, 1, 0.01, 'Glass Surface', { advanced: true }),
  sheenRoughness: num('glass.sheenRoughness', 'Sheen Roughness', 1, 0, 1, 0.01, 'Glass Surface', { advanced: true }),
  anisotropy: num('glass.anisotropy', 'Anisotropy', 0, 0, 1, 0.01, 'Glass Surface', { advanced: true }),
  anisotropyRotation: num('glass.anisotropyRotation', 'Anisotropy Rotation', 0, -3.141592653589793, 3.141592653589793, 0.01, 'Glass Surface', { advanced: true }),
  specularColor: { ...color('glass.specularColor', 'Specular Color', '#ffffff', 'Glass Surface'), advanced: true },
  sheenColor: { ...color('glass.sheenColor', 'Sheen Color', '#ffffff', 'Glass Surface'), advanced: true },
  forceSinglePass: bool('glass.forceSinglePass', 'Force Single Pass', false, 'Glass Quality', { advanced: true }),

  samples: num('glass.samples', 'Samples', 4, 1, 16, 1, 'Glass Quality', { description: 'Baked into the refraction loop. Spectral mode uses at least 3 samples to cover all color lobes. Recompiles the shader.' }),
  backside: bool('glass.backside', 'Backside Pass', true, 'Glass Quality'),
  backsideThickness: num('glass.backsideThickness', 'Backside Thickness', 3, 0, 10, .01, 'Glass Quality'),
  backdropResolutionScale: num('glass.backdropResolutionScale', 'Backdrop Scale', .85, .25, 1, .05, 'Glass Quality'),
  backsideResolutionScale: num('glass.backsideResolutionScale', 'Clean Pass Scale', .7, .25, 1, .05, 'Glass Quality'),
} satisfies Record<string, ParameterDefinition>

export const glassParameterList: ParameterDefinition[] = Object.values(glassParameterDefs)

/** Resolves every glass parameter into props for `<GlassMaterial>`. */
export function useGlassParameters(): GlassMaterialProps {
  const defs = glassParameterDefs
  return {
    color: String(useResolvedParameter(defs.color)),
    transmission: Number(useResolvedParameter(defs.transmission)),
    ior: Number(useResolvedParameter(defs.ior)),
    thickness: Number(useResolvedParameter(defs.thickness)),
    roughness: Number(useResolvedParameter(defs.roughness)),
    dispersion: Number(useResolvedParameter(defs.dispersion)),
    spectralDispersion: Boolean(useResolvedParameter(defs.spectralDispersion)),
    anisotropicBlur: Number(useResolvedParameter(defs.anisotropicBlur)),
    attenuationColor: String(useResolvedParameter(defs.attenuationColor)),
    attenuationDistance: Number(useResolvedParameter(defs.attenuationDistance)),
    distortion: Number(useResolvedParameter(defs.distortion)),
    distortionScale: Number(useResolvedParameter(defs.distortionScale)),
    temporalDistortion: Number(useResolvedParameter(defs.temporalDistortion)),
    envMapIntensity: Number(useResolvedParameter(defs.envMapIntensity)),
    clearcoat: Number(useResolvedParameter(defs.clearcoat)),
    iridescence: Number(useResolvedParameter(defs.iridescence)),
    metalness: Number(useResolvedParameter(defs.metalness)),
    specularIntensity: Number(useResolvedParameter(defs.specularIntensity)),
    clearcoatRoughness: Number(useResolvedParameter(defs.clearcoatRoughness)),
    iridescenceIOR: Number(useResolvedParameter(defs.iridescenceIOR)),
    sheen: Number(useResolvedParameter(defs.sheen)),
    sheenRoughness: Number(useResolvedParameter(defs.sheenRoughness)),
    anisotropy: Number(useResolvedParameter(defs.anisotropy)),
    anisotropyRotation: Number(useResolvedParameter(defs.anisotropyRotation)),
    iridescenceThicknessRange: [Number(useResolvedParameter(defs.iridescenceThicknessMin)), Number(useResolvedParameter(defs.iridescenceThicknessMax))],
    specularColor: String(useResolvedParameter(defs.specularColor)),
    sheenColor: String(useResolvedParameter(defs.sheenColor)),
    forceSinglePass: Boolean(useResolvedParameter(defs.forceSinglePass)),
    samples: Math.round(Number(useResolvedParameter(defs.samples))),
    backside: Boolean(useResolvedParameter(defs.backside)),
    backsideThickness: Number(useResolvedParameter(defs.backsideThickness)),
    backdropResolutionScale: Number(useResolvedParameter(defs.backdropResolutionScale)),
    backsideResolutionScale: Number(useResolvedParameter(defs.backsideResolutionScale)),
  }
}
