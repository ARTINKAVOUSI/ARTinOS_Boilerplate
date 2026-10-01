import { Vector3 } from 'three/webgpu'
import type { StageDims } from './params'
import { PatchGeometry } from './patchGeometry'

/**
 * Niche — an arched alcove set into a wall, like a museum apse or a shop
 * window. The facade at the opening is sized to cover the frame; the arch is
 * sized from the view and the stage height; behind it a barrel-vaulted recess
 * of the stage depth holds the subject.
 *
 *   front view    ┌───────────────┐  ← facade, past the frame on every side
 *                 │   ╭───────╮   │
 *                 │   │ recess│   │  ← arch: archWidth × archHeight
 *                 └───┴───────┴───┘  ← floor runs on toward the camera
 */

const NJ = 8 // each jamb
const NA = 36 // the arch
const NPATH = NJ + NA + NJ
const NR = 7 // facade, from the arch out to its edge
const NZ = 12 // recess depth
const NX = 9 // recess floor width
const NB = 6 // back wall, from the arch down
const NFX = 17 // front floor width
const NF = 6 // front floor depth

export class NicheGeometry extends PatchGeometry {
  // The opening's outline, from the left jamb's foot over the arch to the right jamb's foot.
  private ax = new Float64Array(NPATH)
  private ay = new Float64Array(NPATH)
  private qx = new Float64Array(NPATH)
  private qy = new Float64Array(NPATH)
  private len = new Float64Array(NPATH)

  constructor(dims: StageDims) {
    super([
      [NPATH, NR], // facade
      [NPATH, NZ], // jambs and vault
      [NX, NZ], // recess floor
      [NPATH, NB], // back wall
      [NFX, NF], // floor in front
    ])
    this.build(dims)
  }

  update(d: StageDims) {
    const D = Math.max(0.5, d.totalDepth)
    const Wf = Math.max(2, d.outerWidth)
    const Hf = Math.max(1, d.wallHeight)
    const zf = Math.max(0.5, d.front)
    const aw = Math.min(Math.max(0.6, d.archWidth), Wf - 0.4)
    const ah = Math.min(Math.max(0.6, d.archHeight), Hf - 0.2)
    const rx = aw / 2
    // A semicircle while the arch is tall enough; an elliptical arch when it is wide.
    const ry = Math.min(rx, ah * 0.6)
    const spring = ah - ry
    const { ax, ay, qx, qy, len } = this

    let i = 0
    for (let k = 0; k < NJ; k++, i++) {
      ax[i] = -rx
      ay[i] = spring * (k / NJ)
      qx[i] = 1
      qy[i] = 0
    }
    for (let k = 0; k < NA; k++, i++) {
      const phi = Math.PI * (1 - k / (NA - 1))
      const x = rx * Math.cos(phi)
      const y = ry * Math.sin(phi)
      ax[i] = x
      ay[i] = spring + y
      const gx = -x / (rx * rx)
      const gy = -y / (ry * ry)
      const gl = Math.hypot(gx, gy) || 1
      qx[i] = gx / gl
      qy[i] = gy / gl
    }
    for (let k = 1; k <= NJ; k++, i++) {
      ax[i] = rx
      ay[i] = spring * (1 - k / NJ)
      qx[i] = -1
      qy[i] = 0
    }
    len[0] = 0
    for (let k = 1; k < NPATH; k++) len[k] = len[k - 1] + Math.hypot(ax[k] - ax[k - 1], ay[k] - ay[k - 1])

    for (let u = 0; u < NPATH; u++) {
      // Facade: out from the arch along the ray from the floor's centre, to the facade's edge.
      const reach = Math.min(ax[u] !== 0 ? Wf / 2 / Math.abs(ax[u]) : Infinity, ay[u] > 0 ? Hf / ay[u] : Infinity)
      const ox = ax[u] * reach
      const oy = ay[u] * reach
      for (let v = 0; v < NR; v++) {
        const t = v / (NR - 1)
        const x = ax[u] + (ox - ax[u]) * t
        const y = ay[u] + (oy - ay[u]) * t
        this.put(this.at(0, u, v), x, y, 0, 0, 0, 1, x, y)
      }
      // Recess: the outline carried back to the rear wall.
      for (let v = 0; v < NZ; v++) {
        const z = (-D * v) / (NZ - 1)
        this.put(this.at(1, u, v), ax[u], ay[u], z, qx[u], qy[u], 0, len[u], z)
      }
      // Back wall: straight down from the outline to the floor.
      for (let v = 0; v < NB; v++) {
        const y = ay[u] * (1 - v / (NB - 1))
        this.put(this.at(3, u, v), ax[u], y, -D, 0, 0, 1, ax[u], y)
      }
    }
    for (let v = 0; v < NZ; v++) {
      for (let u = 0; u < NX; u++) {
        const x = -rx + (aw * u) / (NX - 1)
        const z = (-D * v) / (NZ - 1)
        this.put(this.at(2, u, v), x, 0, z, 0, 1, 0, x, z)
      }
    }
    for (let v = 0; v < NF; v++) {
      for (let u = 0; u < NFX; u++) {
        const x = -Wf / 2 + (Wf * u) / (NFX - 1)
        const z = (zf * v) / (NF - 1)
        this.put(this.at(4, u, v), x, 0, z, 0, 1, 0, x, z)
      }
    }
    this.commit(new Vector3(0, Hf / 2, (zf - D) / 2), Math.hypot(Wf / 2, Hf / 2, (zf + D) / 2) + 1)
  }
}
