import { useEffect, useRef } from 'react'
import { ssaaPass } from 'three/addons/tsl/display/SSAAPassNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface SSAAProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Samples = 2^level. */
  sampleLevel?: number
}

/**
 * SSAA — supersampled anti-aliasing. Re-renders the scene several times per frame,
 * so it replaces the scene pass and ignores effects ordered before it.
 *
 * Mount inside <PostFX>.
 */
export function SSAA({ id = 'ssaa', enabled = true, order = 10, sampleLevel = 2 }: SSAAProps) {
  // The node reads sampleLevel every frame, so it is assigned live instead of
  // rebuilding. Rounded: it indexes a table, and a slider drag delivers fractions.
  const level = Math.round(sampleLevel)
  const levelRef = useRef(level)
  const node = useRef<ReturnType<typeof ssaaPass> | null>(null)
  useEffect(() => {
    levelRef.current = level
    if (node.current) node.current.sampleLevel = level
  }, [level])
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ scene, camera }) => {
      const pass = ssaaPass(scene, camera)
      pass.sampleLevel = levelRef.current
      // three r185's updateBefore assumes setup() has made its sample target. A pass
      // downstream that schedules it early (Recurrent Denoise does, for its input)
      // would throw on the first frame and take the canvas down; skip until set up.
      const updateBefore = pass.updateBefore.bind(pass)
      pass.updateBefore = frame => ((pass as unknown as { _sampleRenderTarget: unknown })._sampleRenderTarget ? updateBefore(frame) : undefined)
      node.current = pass
      return pass.getTextureNode()
    },
  })
  return null
}

export default SSAA

export const feature: Feature = {
  id: 'effect.ssaa',
  label: 'SSAA',
  kind: 'effect',
  category: 'anti-aliasing',
  cost: 'very-high',
  order: 10,
  enabled: false,
  webgpuOnly: true,
  description: 'Supersampled anti-aliasing; re-renders the scene several times a frame',
  component: SSAA,
  controls: {
    sampleLevel: { type: 'number', value: 2, min: 0, max: 5, step: 1 },
  },
}
