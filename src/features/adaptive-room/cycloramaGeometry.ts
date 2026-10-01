import { Vector3 } from 'three/webgpu'
import type { StageDims } from './params'
import { PatchGeometry } from './patchGeometry'

/**
 * Cyclorama — the photo studio's infinity cove: one seamless sweep from the
 * floor, through a cove, up the back wall. No side walls and no ceiling: the
 * sweep is sized from the frustum (width at the back wall, wall height above
 * the view's top edge there), so the camera never sees past its edges.
 *
 *   profile (side view)        wall ── y = wallHeight
 *                              │
 *                              ╰─ cove (radius)
 *   floor ─────────────────────   z: front (toward the camera) … −totalDepth
 */

const NX = 33 // across the width
const NF = 24 // floor
const NC = 16 // cove
const NW = 16 // wall
const NP = NF + NC + NW

export class CycloramaGeometry extends PatchGeometry {
  private pz = new Float64Array(NP)
  private py = new Float64Array(NP)
  private nz = new Float64Array(NP)
  private ny = new Float64Array(NP)
  private arc = new Float64Array(NP)

  constructor(dims: StageDims) {
    super([[NX, NP]])
    this.build(dims)
  }

  update(d: StageDims) {
    const D = Math.max(0.5, d.totalDepth)
    const W = Math.max(1, d.outerWidth)
    const zf = Math.max(0.5, d.front)
    const r = Math.min(Math.max(0.05, d.radius), D * 0.8, Math.max(0.1, d.wallHeight) * 0.45)
    const H = Math.max(r + 0.1, d.wallHeight)
    const { pz, py, nz, ny, arc } = this

    // The profile: floor toward the back, a quarter-circle cove, then up the wall.
    let j = 0
    for (let k = 0; k < NF; k++, j++) {
      pz[j] = zf + (-D + r - zf) * (k / NF)
      py[j] = 0
      nz[j] = 0
      ny[j] = 1
    }
    for (let k = 0; k < NC; k++, j++) {
      const t = ((k / (NC - 1)) * Math.PI) / 2
      // Centre (z = −D + r, y = r); from the floor (t = 0) to the wall (t = π/2).
      pz[j] = -D + r - r * Math.sin(t)
      py[j] = r - r * Math.cos(t)
      nz[j] = Math.sin(t)
      ny[j] = Math.cos(t)
    }
    for (let k = 1; k <= NW; k++, j++) {
      pz[j] = -D
      py[j] = r + (H - r) * (k / NW)
      nz[j] = 1
      ny[j] = 0
    }
    arc[0] = 0
    for (let k = 1; k < NP; k++) arc[k] = arc[k - 1] + Math.hypot(pz[k] - pz[k - 1], py[k] - py[k - 1])

    for (let v = 0; v < NP; v++) {
      for (let u = 0; u < NX; u++) {
        const x = -W / 2 + (W * u) / (NX - 1)
        this.put(this.at(0, u, v), x, py[v], pz[v], 0, ny[v], nz[v], x, arc[v])
      }
    }
    this.commit(new Vector3(0, H / 2, (zf - D) / 2), Math.hypot(W / 2, H / 2, (zf + D) / 2) + 1)
  }
}
