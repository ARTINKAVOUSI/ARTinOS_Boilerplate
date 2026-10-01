import { Vector3 } from 'three/webgpu'
import type { StageDims } from './params'
import { PatchGeometry } from './patchGeometry'

/**
 * Apse — a curved wall wrapping the subject: straight side walls that turn
 * into a half-ellipse behind it, coved into the floor and open to the sky.
 * The walls run back past the camera and are as tall as the view's top edge
 * at the rear, so the camera only ever sees wall and floor.
 *
 *   plan (top view)      ╭───────╮   ← half-ellipse, z = −totalDepth at the back
 *                        │       │
 *                        │   ·   │   ← subject
 *                        │       │
 *                        └ front ┘   ← walls and floor run on to the camera
 */

const NS = 12 // each straight side
const NE = 40 // the half-ellipse
const NPATH = NS + NE + NS
const NC = 10 // the floor cove
const NW = 12 // the wall
const NR = 8 // floor, from the cove inward

export class ApseGeometry extends PatchGeometry {
  // The plan path along the foot of the wall, its inward normal, and where its floor ribbon ends.
  private px = new Float64Array(NPATH)
  private pz = new Float64Array(NPATH)
  private qx = new Float64Array(NPATH)
  private qz = new Float64Array(NPATH)
  private sx = new Float64Array(NPATH)
  private sz = new Float64Array(NPATH)
  private len = new Float64Array(NPATH)

  constructor(dims: StageDims) {
    super([
      [NPATH, NC + NW], // wall and cove
      [NPATH, NR], // floor
    ])
    this.build(dims)
  }

  update(d: StageDims) {
    const D = Math.max(1, d.totalDepth)
    const a = Math.max(0.5, d.width / 2)
    const b = Math.min(D * 0.9, a) // depth of the curved back
    const zb = -(D - b) // where the sides turn into the curve
    const zf = Math.max(0.5, d.front)
    // An inset curve stays valid while the cove is tighter than the ellipse's sharpest bend.
    const r = Math.min(Math.max(0.05, d.radius), a * 0.45, b * 0.45, (Math.min(a, b) ** 2 / Math.max(a, b)) * 0.9)
    const H = Math.max(r + 0.1, d.wallHeight)
    const { px, pz, qx, qz, sx, sz, len } = this

    let i = 0
    for (let k = 0; k < NS; k++, i++) {
      px[i] = -a
      pz[i] = zf + (zb - zf) * (k / NS)
      qx[i] = 1
      qz[i] = 0
      sx[i] = 0
      sz[i] = pz[i]
    }
    for (let k = 0; k < NE; k++, i++) {
      const phi = Math.PI * (1 - k / (NE - 1))
      const x = a * Math.cos(phi)
      const z = -b * Math.sin(phi)
      px[i] = x
      pz[i] = zb + z
      // Inward normal: against the ellipse's gradient.
      const gx = -x / (a * a)
      const gz = -z / (b * b)
      const gl = Math.hypot(gx, gz) || 1
      qx[i] = gx / gl
      qz[i] = gz / gl
      sx[i] = 0
      sz[i] = zb
    }
    for (let k = 1; k <= NS; k++, i++) {
      px[i] = a
      pz[i] = zb + (zf - zb) * (k / NS)
      qx[i] = -1
      qz[i] = 0
      sx[i] = 0
      sz[i] = pz[i]
    }
    len[0] = 0
    for (let k = 1; k < NPATH; k++) len[k] = len[k - 1] + Math.hypot(px[k] - px[k - 1], pz[k] - pz[k - 1])

    for (let u = 0; u < NPATH; u++) {
      // Wall: from the floor, inset by the cove radius, round the cove and up.
      let arc = 0
      let lastX = px[u] + qx[u] * r
      let lastY = 0
      for (let v = 0; v < NC + NW; v++) {
        let inset: number
        let y: number
        let nh: number
        let ny: number
        if (v < NC) {
          const t = ((v / (NC - 1)) * Math.PI) / 2
          inset = r - r * Math.sin(t)
          y = r - r * Math.cos(t)
          nh = Math.sin(t)
          ny = Math.cos(t)
        } else {
          inset = 0
          y = r + (H - r) * ((v - NC + 1) / NW)
          nh = 1
          ny = 0
        }
        const x = px[u] + qx[u] * inset
        const z = pz[u] + qz[u] * inset
        arc += Math.hypot(x - lastX, y - lastY)
        lastX = x
        lastY = y
        this.put(this.at(0, u, v), x, y, z, qx[u] * nh, ny, qz[u] * nh, len[u], arc)
      }
      // Floor: from the foot of the cove in to the centre line (a fan across the curve).
      const fx = px[u] + qx[u] * r
      const fz = pz[u] + qz[u] * r
      for (let v = 0; v < NR; v++) {
        const t = v / (NR - 1)
        const x = fx + (sx[u] - fx) * t
        const z = fz + (sz[u] - fz) * t
        this.put(this.at(1, u, v), x, 0, z, 0, 1, 0, x, z)
      }
    }
    this.commit(new Vector3(0, H / 2, (zf - D) / 2), Math.hypot(a, H / 2, (zf + D) / 2) + 1)
  }
}
