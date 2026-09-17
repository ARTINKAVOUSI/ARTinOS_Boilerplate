import { clamp } from '../../core/math';
import type { RoomDims, RoomParams } from './room-params';

/** Extra interior width beyond the frustum at the rim. */
export const FRONT_PAD = 0.55;
/** The frustum may never cover more than this fraction of the room height. */
export const MAX_COVER = 0.982;

/** Result of fitting the room to the camera frustum. */
export interface FrustumFit {
  /** camera distance from the open front plane (z = 0) */
  dist: number;
  /** required interior width */
  width: number;
  /** visible world width/height at the front plane */
  visW: number;
  visH: number;
}

type FitParams = Pick<RoomParams, 'fov' | 'margin' | 'height' | 'distanceBias' | 'radius'>;

/**
 * viewport -> aspect -> frustum -> visible world size -> room dimensions.
 * Height & depth stay stable; width is the primary responsive dimension.
 */
export function fitFrustum(p: FitParams, aspect: number): FrustumFit {
  const halfV = Math.tan((clamp(p.fov, 8, 110) * Math.PI) / 360);
  const coverage = clamp(1 - p.margin, 0.55, MAX_COVER);
  // distance so the vertical frustum covers `coverage` of the room height at
  // the open front — keeps height & subject scale stable across aspects
  const distBase = (p.height * coverage) / (2 * halfV);
  // hard ceiling: the frustum may never exceed MAX_COVER of the room height,
  // regardless of how far the distance bias pushes the camera out
  const distMax = (p.height * MAX_COVER) / (2 * halfV);
  const dist = clamp(distBase * p.distanceBias, distBase * 0.22, distMax);
  const visH = 2 * halfV * dist;
  const visW = visH * aspect;
  // width responds strongly to aspect; never narrower than an elegant minimum
  const width = Math.max(visW + FRONT_PAD, p.height * 0.8, p.radius * 2 + 0.4);
  return { dist, width, visW, visH };
}

/** Target cove radius for the given (damped) dimensions. */
export const targetRadius = (radius: number, d: Pick<RoomDims, 'height' | 'width' | 'totalDepth'>) =>
  clamp(Math.min(radius, d.height * 0.48, d.width * 0.48, d.totalDepth * 0.9), 0.05, 4.5);

/**
 * Vertical camera placement: composition bias clamped to the free margin
 * between the frustum and the room height, plus the allowed parallax range.
 */
export function cameraComposition(p: Pick<RoomParams, 'targetBias'>, d: Pick<RoomDims, 'height'>, fit: FrustumFit) {
  const marginY = Math.max(0, (d.height - fit.visH) / 2);
  const biasShift = clamp(p.targetBias, -0.5, 0.5) * 2 * Math.max(0, marginY - 0.02);
  const ampX = Math.min(0.14, FRONT_PAD * 0.22);
  const ampY = Math.min(0.1, Math.max(0, marginY - Math.abs(biasShift)) * 0.35);
  return { centerY: d.height / 2 + biasShift, ampX, ampY };
}
