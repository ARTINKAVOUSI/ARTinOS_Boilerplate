/**
 * Swaps three's default IBL volume refraction for the screen-space backdrop node.
 *
 * Specular / Fresnel still come from the physical stack; only the transmitted light is replaced.
 * The backdrop node is injected into the builder context so `PhysicalLightingModel` picks it up
 * where it would otherwise reach for the environment map.
 */
import { PhysicalLightingModel } from 'three/webgpu'
import { diffuseColor, mix, transmission } from 'three/tsl'

export class TransmissionPhysicalLightingModel extends PhysicalLightingModel {
  useCustomTransmission: boolean
  backdropNode: any

  constructor(
    clearcoat: boolean,
    sheen: boolean,
    iridescence: boolean,
    anisotropy: boolean,
    useCustomTransmission: boolean,
    backdropNode: any,
  ) {
    // The last two flags are three's own transmission and dispersion. They are switched off only
    // when a backdrop node is replacing them — with no backdrop node, leaving them off is what
    // makes the glass render as a black silhouette, since nothing is transmitted at all.
    const useOwnTransmission = backdropNode === null || backdropNode === undefined
    super(clearcoat, sheen, iridescence, anisotropy, useOwnTransmission, useOwnTransmission)
    this.useCustomTransmission = useCustomTransmission
    this.backdropNode = backdropNode
  }

  start(builder: any) {
    if (this.backdropNode !== null && this.backdropNode !== undefined) {
      const context = builder.context
      context.backdrop = this.backdropNode
      context.backdropAlpha = transmission
      diffuseColor.a.mulAssign(mix(1, context.backdrop.a, transmission))
    }
    super.start(builder)
  }
}

export default TransmissionPhysicalLightingModel
