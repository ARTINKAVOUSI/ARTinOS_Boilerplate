export type MaterialProfileId =
  | 'clear' | 'frosted.subtle' | 'frosted.standard' | 'frosted.dense'
  | 'floating' | 'overlay'

export interface MaterialProfile {
  id: MaterialProfileId
  backgroundOpacity: number
  backdropBlur: number
  saturation: number
  edgeLuminance: number
  innerHighlight: number
  outerShadow: number
  surfaceNoise: number
  depth: number
  transmission: number
}

export const MATERIAL_PROFILES: Record<MaterialProfileId, MaterialProfile> = {
  clear: { id: 'clear', backgroundOpacity: 0, backdropBlur: 0, saturation: 1, edgeLuminance: 0, innerHighlight: 0, outerShadow: 0, surfaceNoise: 0, depth: 0, transmission: 1 },
  'frosted.subtle': { id: 'frosted.subtle', backgroundOpacity: 0.08, backdropBlur: 32, saturation: 1.18, edgeLuminance: 0.08, innerHighlight: 0.06, outerShadow: 0.12, surfaceNoise: 0, depth: 1, transmission: 0.92 },
  'frosted.standard': { id: 'frosted.standard', backgroundOpacity: 0.12, backdropBlur: 44, saturation: 1.28, edgeLuminance: 0.12, innerHighlight: 0.08, outerShadow: 0.2, surfaceNoise: 0, depth: 2, transmission: 0.84 },
  'frosted.dense': { id: 'frosted.dense', backgroundOpacity: 0.2, backdropBlur: 64, saturation: 1.2, edgeLuminance: 0.14, innerHighlight: 0.1, outerShadow: 0.26, surfaceNoise: 0, depth: 3, transmission: 0.68 },
  floating: { id: 'floating', backgroundOpacity: 0.16, backdropBlur: 52, saturation: 1.24, edgeLuminance: 0.16, innerHighlight: 0.1, outerShadow: 0.34, surfaceNoise: 0, depth: 4, transmission: 0.76 },
  overlay: { id: 'overlay', backgroundOpacity: 0.24, backdropBlur: 64, saturation: 1.12, edgeLuminance: 0.12, innerHighlight: 0.06, outerShadow: 0.42, surfaceNoise: 0, depth: 5, transmission: 0.58 },
}

export interface MaterialContext {
  reducedTransparency?: boolean
  highContrast?: boolean
  interaction?: 'idle' | 'hover' | 'pressed' | 'dragging'
}

export function resolveMaterial(id: MaterialProfileId, context: MaterialContext = {}): MaterialProfile {
  const base = MATERIAL_PROFILES[id]
  if (context.reducedTransparency) return { ...base, backgroundOpacity: Math.max(0.92, base.backgroundOpacity), backdropBlur: 0, transmission: 0 }
  const interaction = context.interaction
  return {
    ...base,
    backgroundOpacity: Math.min(1, base.backgroundOpacity + (interaction === 'hover' ? 0.025 : interaction === 'pressed' ? 0.04 : 0)),
    edgeLuminance: Math.min(1, base.edgeLuminance + (interaction === 'dragging' ? 0.08 : interaction === 'hover' ? 0.03 : 0)),
    depth: Math.max(0, base.depth + (interaction === 'pressed' ? -0.5 : interaction === 'dragging' ? 0.5 : 0)),
    outerShadow: context.highContrast ? 0 : base.outerShadow,
  }
}

export function materialVariables(id: MaterialProfileId, context: MaterialContext = {}): Record<string, string> {
  const material = resolveMaterial(id, context)
  return {
    '--material-opacity': String(material.backgroundOpacity),
    '--material-blur': `${material.backdropBlur}px`,
    '--material-saturation': String(material.saturation),
    '--material-edge': String(material.edgeLuminance),
    '--material-highlight': String(material.innerHighlight),
    '--material-shadow': String(material.outerShadow),
    '--material-noise': String(material.surfaceNoise),
    '--material-depth': String(material.depth),
    '--material-transmission': String(material.transmission),
  }
}
