import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three/webgpu'
import type { StageDims } from './params'

/**
 * A stage surface built from a few fixed grids of vertices ("patches"). The
 * topology is set once; a resize only rewrites the vertex buffers, so the
 * stage can follow the damped dimensions every frame.
 *
 * A subclass declares its patch sizes, writes every vertex in `update`, and
 * calls `build` at the end of its constructor. Winding is taken from the
 * normals it writes, so a patch can be laid out in either direction.
 */

export const UV_SCALE = 0.55

interface Patch {
  nu: number
  nv: number
  offset: number
}

export abstract class PatchGeometry extends BufferGeometry {
  protected pos: Float32Array
  protected nor: Float32Array
  protected uvs: Float32Array
  private patches: Patch[] = []

  constructor(sizes: [nu: number, nv: number][]) {
    super()
    let offset = 0
    for (const [nu, nv] of sizes) {
      this.patches.push({ nu, nv, offset })
      offset += nu * nv
    }
    this.pos = new Float32Array(offset * 3)
    this.nor = new Float32Array(offset * 3)
    this.uvs = new Float32Array(offset * 2)
    this.setAttribute('position', new BufferAttribute(this.pos, 3))
    this.setAttribute('normal', new BufferAttribute(this.nor, 3))
    this.setAttribute('uv', new BufferAttribute(this.uvs, 2))
  }

  abstract update(dims: StageDims): void

  /** First vertex index of patch `p`, row `v`, column `u`. */
  protected at(p: number, u: number, v: number) {
    const patch = this.patches[p]
    return patch.offset + v * patch.nu + u
  }

  protected put(vi: number, x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) {
    const i3 = vi * 3
    this.pos[i3] = x
    this.pos[i3 + 1] = y
    this.pos[i3 + 2] = z
    this.nor[i3] = nx
    this.nor[i3 + 1] = ny
    this.nor[i3 + 2] = nz
    this.uvs[vi * 2] = u * UV_SCALE
    this.uvs[vi * 2 + 1] = v * UV_SCALE
  }

  /** After every vertex is written: upload, and bound the stage for culling. */
  protected commit(center: Vector3, radius: number) {
    this.attributes.position.needsUpdate = true
    this.attributes.normal.needsUpdate = true
    this.attributes.uv.needsUpdate = true
    this.boundingSphere = new Sphere(center, radius)
  }

  /** Write the first frame, then index each patch so its front faces match its normals. */
  protected build(dims: StageDims) {
    this.update(dims)
    const a = new Vector3()
    const b = new Vector3()
    const c = new Vector3()
    const n = new Vector3()
    const indices: number[] = []
    for (const patch of this.patches) {
      // Probe the middle row and trust its largest quad: fans and ribbons have degenerate ones.
      const row = Math.floor((patch.nv - 1) / 2)
      let best = 0
      for (let u = 0; u < patch.nu - 1; u++) {
        const i0 = patch.offset + row * patch.nu + u
        a.fromArray(this.pos, i0 * 3)
        b.fromArray(this.pos, (i0 + 1) * 3).sub(a)
        c.fromArray(this.pos, (i0 + patch.nu) * 3).sub(a)
        n.fromArray(this.nor, i0 * 3)
        const facing = b.cross(c).dot(n)
        if (Math.abs(facing) > Math.abs(best)) best = facing
      }
      const flip = best < 0
      for (let v = 0; v < patch.nv - 1; v++) {
        for (let u = 0; u < patch.nu - 1; u++) {
          const v00 = patch.offset + v * patch.nu + u
          const v10 = v00 + 1
          const v01 = v00 + patch.nu
          const v11 = v01 + 1
          if (flip) indices.push(v00, v01, v10, v10, v01, v11)
          else indices.push(v00, v10, v01, v10, v11, v01)
        }
      }
    }
    this.setIndex(indices)
  }
}
