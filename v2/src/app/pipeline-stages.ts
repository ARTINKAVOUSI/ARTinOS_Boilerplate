/**
 * What each stage of the render pipeline produced this build.
 *
 * A leaf module on purpose: the PostFX host publishes here as it assembles the
 * chain, and the Graph panel reads it to show a live thumbnail on every pass
 * and effect node. Neither imports the other.
 */

export interface PipelineStage {
  /** `pass:scene`, `pass:depth`, `effect.bloom`, `pass:output`. */
  id: string
  label: string
  /** The TSL node this stage outputs, renderable to a thumbnail. */
  node: unknown
}

let stages: readonly PipelineStage[] = []
const listeners = new Set<() => void>()

export const pipelineStages = {
  publish(next: readonly PipelineStage[]) {
    // Same nodes in the same order means nothing downstream has to re-render.
    if (next.length === stages.length && next.every((stage, index) => stages[index].id === stage.id && stages[index].node === stage.node)) return
    stages = next
    listeners.forEach(listener => listener())
  },
  getStages: () => stages,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
