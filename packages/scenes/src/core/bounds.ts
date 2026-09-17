/**
 * Live interior bounds of a scene, published by the scene's layout step and
 * read by anything that must agree with the visible architecture
 * (simulations, stages, helpers, host content).
 *
 * A channel is per scene instance: two scenes on one page never share bounds.
 */

/** Inner axis-aligned bounds of a scene volume (flat-face planes). */
export interface SceneBounds {
  left: number;
  right: number;
  floor: number;
  ceiling: number;
  back: number;
  front: number;
  /** Corner / cove radius — consumers can soften their own collisions with it. */
  radius: number;
}

export interface BoundsChannel {
  /**
   * The live bounds object. It is mutated in place on every layout change so
   * per-frame readers can keep a reference and never allocate.
   */
  readonly current: SceneBounds;
  /** Copy `next` into `current` and notify subscribers when it changed. */
  set(next: SceneBounds): void;
  /** Called with a snapshot whenever the bounds change beyond `epsilon`. */
  subscribe(listener: (bounds: SceneBounds) => void): () => void;
  /** A detached copy, safe to keep. */
  snapshot(): SceneBounds;
}

export const DEFAULT_BOUNDS: Readonly<SceneBounds> = Object.freeze({
  left: -4,
  right: 4,
  floor: 0,
  ceiling: 5,
  back: -6,
  front: 0,
  radius: 0.8,
});

const KEYS = ['left', 'right', 'floor', 'ceiling', 'back', 'front', 'radius'] as const;

export function boundsEqual(a: SceneBounds, b: SceneBounds, epsilon = 0): boolean {
  for (const key of KEYS) if (Math.abs(a[key] - b[key]) > epsilon) return false;
  return true;
}

export function createBoundsChannel(
  initial: SceneBounds = DEFAULT_BOUNDS,
  { epsilon = 0.005 }: { epsilon?: number } = {}
): BoundsChannel {
  const current: SceneBounds = { ...initial };
  const published: SceneBounds = { ...initial };
  const listeners = new Set<(bounds: SceneBounds) => void>();
  return {
    current,
    set(next) {
      for (const key of KEYS) current[key] = next[key];
      if (boundsEqual(current, published, epsilon)) return;
      Object.assign(published, current);
      const snapshot = { ...current };
      listeners.forEach((listener) => listener(snapshot));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => ({ ...current }),
  };
}

/** Width / height / depth of a bounds box. */
export function boundsSize(b: SceneBounds) {
  return { width: b.right - b.left, height: b.ceiling - b.floor, depth: b.front - b.back };
}
