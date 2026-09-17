import { clamp } from '../../core/math';
import type { FrustumFit } from './frustum';
import type { RoomDims, RoomParams } from './room-params';

export interface SubjectSize {
  w: number;
  h: number;
  d: number;
}

const EPS = 1e-3;

/**
 * Uniform scale that keeps a floor-seated subject inside the composition safe
 * area. The user multiplier is hard-capped so the subject can never breach
 * the physical shell, even at extreme values.
 */
export function subjectScale(
  raw: SubjectSize,
  p: Pick<RoomParams, 'margin' | 'subjectScale'>,
  d: RoomDims,
  fit: Pick<FrustumFit, 'visW'>
): number {
  const safeW = Math.min(fit.visW * (1 - p.margin * 2), d.width - d.radius * 2 - 0.4);
  const safeH = d.height * (1 - p.margin * 2) * 0.72;
  const safeD = d.depth * 0.8;
  const fitTarget = Math.min(
    1,
    safeW / Math.max(raw.w, EPS),
    safeH / Math.max(raw.h, EPS),
    safeD / Math.max(raw.d, EPS)
  );
  const hardCap = Math.min(
    (d.width - 0.25) / Math.max(raw.w, EPS),
    (d.height - 0.25) / Math.max(raw.h, EPS),
    (d.totalDepth - 0.25) / Math.max(raw.d, EPS)
  );
  return clamp(fitTarget * p.subjectScale, Math.min(0.05, hardCap), hardCap);
}

/** Depth at which the fitted subject sits (fraction of the nominal depth). */
export const SUBJECT_DEPTH = 0.52;
