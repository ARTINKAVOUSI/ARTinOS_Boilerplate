export { GlassMaterial, default as GlassMaterialDefault, type GlassMaterialProps } from './GlassMaterial'
export { GlassRings, type GlassRingsProps } from './GlassRings'
export { TransmissionPhysicalLightingModel } from './TransmissionPhysicalLightingModel'
export {
  buildTransmissionBackdropNode,
  createVolumeRefraction,
  type TransmissionUniforms,
  type VolumeRefractionOptions,
} from './transmission-nodes'
export { GLASS_LAYER, TRANSMISSION_BACKDROP_LAYER, markAsGlass, unmarkAsGlass } from './transmission-backdrop'
export { glassParameterDefs, glassParameterList, useGlassParameters } from './glass-parameters'

export { GlassMesh, type GlassMeshProps } from './GlassMesh'
export { glassOptics, refractedAngle } from './glass-optics'
