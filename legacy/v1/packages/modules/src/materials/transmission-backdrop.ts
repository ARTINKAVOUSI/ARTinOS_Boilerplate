/** Legacy layer identifiers retained for existing imports. Glass no longer changes layers. */
export const GLASS_LAYER = 2
export const TRANSMISSION_BACKDROP_LAYER = 1

/** Exclude an object from glass captures without changing camera or light visibility. */
export function markAsGlass(object: any) {
  object.traverse?.((child: any) => { if (child.isMesh) child.userData.transmissionGlass = true })
  if (object.isMesh) object.userData.transmissionGlass = true
}

/** Remove an explicit capture tag; GlassMaterial is also detected from its material marker. */
export function unmarkAsGlass(object: any) {
  object.traverse?.((child: any) => { if (child.isMesh) delete child.userData.transmissionGlass })
  if (object.isMesh) delete object.userData.transmissionGlass
}
