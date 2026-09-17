import { useThree } from '@react-three/fiber';

/**
 * Small shims over the R3F v9 → v10 differences this package touches:
 * v10 passes `elapsed` in the frame state instead of a `clock`, and exposes
 * the WebGPU renderer as `renderer` while `gl` is deprecated.
 */

type TimedState = { elapsed?: number; clock?: { elapsedTime: number } };

export const elapsedTime = (state: unknown): number => {
  const s = state as TimedState;
  return s.elapsed ?? s.clock?.elapsedTime ?? performance.now() / 1000;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const selectRenderer = (s: any): any => s.renderer ?? s.gl;

/** The active renderer (a `WebGPURenderer` in this package's supported setups). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useRenderer = (): any => useThree(selectRenderer);
