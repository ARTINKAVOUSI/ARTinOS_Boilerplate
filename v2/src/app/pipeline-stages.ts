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

// Attachments something outside the effect chain wants rendered — the live
// graph asks for normal and velocity so their passes exist to be previewed.
let wanted: readonly string[] = []
const wantListeners = new Set<() => void>()

export const pipelineStages = {
  publish(next: readonly PipelineStage[]) {
    // Same nodes in the same order means nothing downstream has to re-render.
    if (next.length === stages.length && next.every((stage, index) => stages[index].id === stage.id && stages[index].node === stage.node)) return
    stages = next
    listeners.forEach(listener => listener())
  },
  getStages: () => stages,

  /** Ask the pipeline to render these attachments too. Pass [] to release. */
  want(next: readonly string[]) {
    if (next.join() === wanted.join()) return
    wanted = next
    wantListeners.forEach(listener => listener())
  },
  getWanted: () => wanted,
  subscribeWanted(listener: () => void) {
    wantListeners.add(listener)
    return () => wantListeners.delete(listener)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
