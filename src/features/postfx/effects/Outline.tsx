import { Color, type Object3D } from 'three/webgpu'
import { uniform } from 'three/tsl'
import { outline } from 'three/addons/tsl/display/OutlineNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface OutlineProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Edge brightness. */
  strength?: number
  /** Edge width. */
  thickness?: number
  /** Edge glow. */
  glow?: number
  /** Colour of unoccluded edges. */
  visibleColor?: string
  /** Colour of occluded edges. */
  hiddenColor?: string
  /** Objects to outline. */
  selection?: Object3D[]
}

/**
 * Outline — glowing edges around selected objects.
 *
 * Pass `selection`, or tag objects with `userData.outline = true`.
 *
 * Mount inside <PostFX>.
 */
export function Outline({ id = 'outline', enabled = true, order = 500, strength = 3, thickness = 1, glow = 0, visibleColor = '#ffffff', hiddenColor = '#4e3636', selection }: OutlineProps) {
  const strengthU = useUniform(strength)
  const thicknessU = useUniform(thickness)
  const glowU = useUniform(glow)
  usePostFXEffect(id, {
    enabled,
    order,
    build: ({ input, scene, camera }) => {
      const selectedObjects = selection ?? []
      if (!selection) scene.traverse(object => { if (object.userData.outline) selectedObjects.push(object) })
      if (!selectedObjects.length) return null
      const node = outline(scene, camera, { selectedObjects, edgeThickness: thicknessU, edgeGlow: glowU })
      const edges = node.visibleEdge.mul(uniform(new Color(visibleColor))).add(node.hiddenEdge.mul(uniform(new Color(hiddenColor)))).mul(strengthU)
      return input.add(edges)
    },
  }, [visibleColor, hiddenColor, selection])
  return null
}

export default Outline

export const feature: Feature = {
  id: 'effect.outline',
  label: 'Outline',
  kind: 'effect',
  category: 'screen-space',
  cost: 'medium',
  order: 500,
  enabled: false,
  component: Outline,
  controls: {
    strength: { type: 'number', value: 3, min: 0, max: 10, step: 0.01 },
    thickness: { type: 'number', value: 1, min: 0.5, max: 4, step: 0.01 },
    glow: { type: 'number', value: 0, min: 0, max: 4, step: 0.01 },
    visibleColor: { type: 'color', value: '#ffffff' },
    hiddenColor: { type: 'color', value: '#4e3636' },
  },
}
