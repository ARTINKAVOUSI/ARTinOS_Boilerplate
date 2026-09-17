export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Frame-rate independent exponential damping (same curve as THREE.MathUtils.damp). */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

/** Blend factor for `lerp(current, target, k)` with the same curve as `damp`. */
export const dampFactor = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

/** Clamp a frame delta so a stalled tab does not produce a huge step. */
export const frameDelta = (delta: number, max = 1 / 20) => Math.min(Math.max(delta, 0), max);
