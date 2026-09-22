import { useSyncExternalStore } from 'react'
import { float, mix, vec3, vec4 } from 'three/tsl'
import type { Feature } from '../../../app/feature'
import { compiledGraphs } from '../../../app/compiled-graphs'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface GraphEffectProps {
  id?: string
  enabled?: boolean
  order?: number
  /** Which GPU graph to render. Empty uses the first one that is running. */
  graph?: string
  /** How the compiled node is combined with the image. */
  blend?: 'multiply' | 'add' | 'mix' | 'replace'
  amount?: number
  /** A TSL node to render instead of a Graph-panel graph; set it to use this effect outside the studio. */
  node?: unknown
}

/**
 * Graph — renders a GPU graph's compiled TSL node into the chain.
 *
 * A `gpu` graph in the Graph panel ends in a TSL Output node; whatever it
 * publishes is available here as a live node, with its signal and parameter
 * uniforms updated every frame. Switch the graph off and this effect passes the
 * image through untouched.
 *
 * Studio-bound by default: it reads the graphs the Graph panel publishes in
 * `app/compiled-graphs.ts`. Pass `node` to drive it with any TSL node instead,
 * which is also how to use it outside this app (drop that import).
 *
 * Mount inside <PostFX>.
 */
export function GraphEffect({ id = 'graph-effect', enabled = true, order = 460, graph = '', blend = 'multiply', amount = 1, node: explicit }: GraphEffectProps) {
  const entries = useSyncExternalStore(compiledGraphs.subscribe, compiledGraphs.getEntries, compiledGraphs.getEntries)
  const amountU = useUniform(amount)
  // The compiled node changes identity only when a GPU graph is recompiled.
  const entry = graph ? entries.find(item => item.id === graph || item.name.toLowerCase() === graph.toLowerCase()) : entries[0]
  const node = explicit ?? entry?.node ?? null

  usePostFXEffect(
    id,
    {
      enabled: enabled && !!node,
      order,
      build: ({ input }) => {
        if (!node) return input
        const source = float(node as never)
        const tint = vec3(source)
        const rgb =
          blend === 'add'
            ? input.rgb.add(tint.mul(amountU))
            : blend === 'replace'
              ? tint.mul(amountU)
              : blend === 'mix'
                ? mix(input.rgb, tint, amountU)
                : input.rgb.mul(mix(float(1), source, amountU))
        return vec4(rgb, input.a)
      },
    },
    [node, blend],
  )
  return null
}

export default GraphEffect

export const feature: Feature = {
  id: 'effect.graph',
  label: 'Graph',
  kind: 'effect',
  category: 'stylize',
  cost: 'low',
  order: 460,
  enabled: false,
  description: 'Renders a GPU graph from the Graph panel into the effect chain',
  webgpuOnly: true,
  component: GraphEffect,
  controls: {
    graph: { type: 'text', value: '', label: 'Graph name', placeholder: 'First running GPU graph' },
    blend: { type: 'select', value: 'multiply', options: ['multiply', 'add', 'mix', 'replace'] },
    amount: { type: 'number', value: 1, min: 0, max: 2, step: 0.01 },
  },
}
