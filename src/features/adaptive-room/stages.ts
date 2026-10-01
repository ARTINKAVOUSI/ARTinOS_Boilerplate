import { LatheGeometry, Vector2, type BufferGeometry } from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { ApseGeometry } from './apseGeometry'
import { CycloramaGeometry } from './cycloramaGeometry'
import { NicheGeometry } from './nicheGeometry'
import { clamp, type FrustumFit, type RoomParams, type StageDims } from './params'
import { RoomShellGeometry } from './roomGeometry'

/**
 * The stages: one camera fit, four shapes. Every stage takes the same frustum
 * fit (camera distance, visible size at the opening) and derives the
 * dimensions that keep the camera enclosed — side walls past the frustum's
 * edges, walls taller than its top, floors that run on to the camera.
 */

export type StageId = 'room' | 'cyclorama' | 'apse' | 'niche'

export interface StageGeometry extends BufferGeometry {
  update(dims: StageDims): void
}

interface StageDef {
  /** This frame's target dimensions, from the params and the live frustum fit. */
  dims(p: RoomParams, fit: FrustumFit): StageDims
  create(dims: StageDims): StageGeometry
}

/** What the camera can reach beyond the fitted frame: vertical bias, parallax, a damped glide. */
const SLACK = 0.35

function common(p: RoomParams, fit: FrustumFit) {
  const totalDepth = p.depth + p.rearInset
  // The frustum grows from the opening to the rear wall by this much.
  const grow = (fit.dist + totalDepth) / fit.dist
  // Highest the camera's eye can sit: half the height, the full bias margin, the parallax.
  const eye = p.height / 2 + Math.max(0, (p.height - fit.visH) / 2) + 0.1
  return {
    base: {
      width: fit.width,
      height: p.height,
      depth: p.depth,
      totalDepth,
      radius: p.radius,
      wallThickness: p.wallThickness,
      front: 0,
      wallHeight: 0,
      outerWidth: 0,
      archWidth: 0,
      archHeight: 0,
    } satisfies StageDims,
    totalDepth,
    /** The view's top edge at the rear wall. */
    topAtBack: eye + (fit.visH / 2) * grow + SLACK,
    /** The view's width at the rear wall, either side of the parallax. */
    widthAtBack: fit.visW * grow + 0.5 + SLACK * 2,
    /** Floors run on behind the camera, even while it glides in from further out. */
    front: fit.dist * 1.5 + 1,
    eye,
  }
}

export const STAGES: Record<StageId, StageDef> = {
  // Open-front chamber: walls, floor and ceiling past the frustum on every side.
  room: {
    dims: (p, fit) => {
      const { base, totalDepth } = common(p, fit)
      return { ...base, radius: clamp(Math.min(p.radius, p.height * 0.48, fit.width * 0.48, totalDepth * 0.9), 0.05, 4.5) }
    },
    create: dims => new RoomShellGeometry(dims),
  },
  // Infinity cove: floor sweeping up into the back wall, nothing at the sides or above.
  cyclorama: {
    dims: (p, fit) => {
      const { base, totalDepth, topAtBack, widthAtBack, front } = common(p, fit)
      return { ...base, radius: clamp(p.radius, 0.05, totalDepth * 0.8), outerWidth: widthAtBack, wallHeight: topAtBack, front }
    },
    create: dims => new CycloramaGeometry(dims),
  },
  // Curved wall wrapping the subject, open above.
  apse: {
    dims: (p, fit) => {
      const { base, topAtBack, front } = common(p, fit)
      return { ...base, radius: clamp(p.radius, 0.05, fit.width * 0.3), wallHeight: topAtBack, front }
    },
    create: dims => new ApseGeometry(dims),
  },
  // Arched alcove in a wall that fills the frame.
  niche: {
    dims: (p, fit) => {
      const { base, eye, front } = common(p, fit)
      // Wide enough for a subject the size of the frame's middle, with facade still showing either side.
      const archWidth = clamp(fit.visW * 0.72, p.height * 0.5, p.height * 1.5)
      return {
        ...base,
        width: archWidth,
        archWidth,
        archHeight: p.height * 0.8,
        outerWidth: fit.visW + 2.4,
        wallHeight: eye + fit.visH / 2 + 1,
        front,
      }
    },
    create: dims => new NicheGeometry(dims),
  },
}

export type PedestalShape = 'none' | 'round' | 'square'

/**
 * A plinth of unit size — radius or half-width 1, height 1, standing on y = 0 —
 * so the stage scales it to the controls without rebuilding it.
 */
export function pedestalGeometry(shape: PedestalShape): BufferGeometry | null {
  if (shape === 'round') {
    // Side, a small rounded lip, then the top; it stands on the floor, so no bottom.
    const lip = 0.06
    const profile = [new Vector2(1, 0), new Vector2(1, 1 - lip)]
    for (let k = 1; k <= 6; k++) {
      const t = ((k / 6) * Math.PI) / 2
      profile.push(new Vector2(1 - lip + lip * Math.cos(t), 1 - lip + lip * Math.sin(t)))
    }
    profile.push(new Vector2(0, 1))
    return new LatheGeometry(profile, 72)
  }
  if (shape === 'square') return new RoundedBoxGeometry(2, 1, 2, 4, 0.05).translate(0, 0.5, 0)
  return null
}
