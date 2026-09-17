import * as THREE from 'three/webgpu';
import type { RoomDims } from '../model/room-params';

/**
 * Thick-walled open-front chamber shell.
 *
 * Layers:
 *   1. Interior  — rounded-box SDF projection (floor, ceil, L/R, back)
 *   2. Exterior  — parallel expanded shell (radius + thickness)
 *   3. Front rim — continuous ribbon from interior opening profile to
 *                  exterior opening profile. Corner arcs of this ribbon
 *                  are the proper curved corner fillers: a quarter-annulus
 *                  between r and r+t at each of the four open-front corners.
 *
 * Topology is fixed; resize only rewrites vertex buffers.
 */

const E = 14; // cove arc samples
const MX = 24;
const MY = 16;
const MZ = 20;
const RT = 6; // samples across wall thickness on the rim
const ARC = 12; // samples per front-corner arc on the rim

const NX = 2 * E + MX + 1;
const NY = 2 * E + MY + 1;
const NZ = E + MZ + 1;

// Front rim path: 4 straight spans + 4 corner arcs
// bottom mid, BR arc, right mid, TR arc, top mid, TL arc, left mid, BL arc
const RIM_BOTTOM = MX + 1;
const RIM_RIGHT = MY + 1;
const RIM_TOP = MX + 1;
const RIM_LEFT = MY + 1;
const RIM_U =
  RIM_BOTTOM + ARC + RIM_RIGHT + ARC + RIM_TOP + ARC + RIM_LEFT + ARC; // along path
const RIM_V = RT + 1; // across thickness

const UV_SCALE = 0.55;

interface FaceDef {
  nu: number;
  nv: number;
  offset: number;
  flip: boolean;
  /** if set, force winding instead of probing */
  forceFlip?: boolean;
}

export class RoomShellGeometry extends THREE.BufferGeometry {
  private faces: FaceDef[] = [];
  private pos: Float32Array;
  private nor: Float32Array;
  private uv: Float32Array;

  private xs = new Float64Array(NX);
  private ys = new Float64Array(NY);
  private zs = new Float64Array(NZ);
  // exterior sample lines
  private xso = new Float64Array(NX);
  private yso = new Float64Array(NY);
  private zso = new Float64Array(NZ);

  constructor(dims: RoomDims) {
    super();

    // interior (5) + exterior (5) + front rim (1)
    const counts: [number, number, boolean?][] = [
      [NX, NZ], // 0 floor in
      [NX, NZ], // 1 ceil in
      [NZ, NY], // 2 left in
      [NZ, NY], // 3 right in
      [NX, NY], // 4 back in
      [NX, NZ], // 5 floor out
      [NX, NZ], // 6 ceil out
      [NZ, NY], // 7 left out
      [NZ, NY], // 8 right out
      [NX, NY], // 9 back out
      [RIM_U, RIM_V], // 10 front rim ribbon
    ];

    let offset = 0;
    for (const [nu, nv, forceFlip] of counts) {
      this.faces.push({ nu, nv, offset, flip: false, forceFlip });
      offset += nu * nv;
    }

    this.pos = new Float32Array(offset * 3);
    this.nor = new Float32Array(offset * 3);
    this.uv = new Float32Array(offset * 2);

    this.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    this.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));

    this.update(dims);
    this.resolveWindingAndIndex();
  }

  update(dims: RoomDims) {
    const W = dims.width;
    const H = dims.height;
    const tD = dims.totalDepth;
    const Wsafe = Math.max(0.5, W);
    const Hsafe = Math.max(0.5, H);
    const tDsafe = Math.max(0.5, tD);
    const t = Math.max(0.02, Math.min(1.5, Number(dims.wallThickness) || 0.18));
    const rIn = Math.min(
      Math.max(0.05, Number(dims.radius) || 0.8),
      Wsafe / 2 - 0.05,
      Hsafe / 2 - 0.05,
      tDsafe - 0.05
    );
    const rOut = rIn + t;

    // exterior extents
    const Wo = Wsafe + 2 * t;
    const Ho = Hsafe + 2 * t;
    const tDo = tDsafe + t; // exterior back is further back; front stays at z=0

    fillBothRounded(this.xs, -Wsafe / 2, Wsafe / 2, rIn, MX);
    fillBothRounded(this.ys, 0, Hsafe, rIn, MY);
    fillBackRounded(this.zs, -tDsafe, 0, rIn, MZ);

    fillBothRounded(this.xso, -Wo / 2, Wo / 2, rOut, MX);
    fillBothRounded(this.yso, -t, H + t, rOut, MY);
    fillBackRounded(this.zso, -tDo, 0, rOut, MZ);

    const pos = this.pos;
    const nor = this.nor;
    const uv = this.uv;

    // ---- interior rounded-box writer (normals inward) --------------------
    const writeIn = (
      vi: number,
      px: number,
      py: number,
      pz: number,
      u: number,
      v: number
    ) => {
      mapRounded(
        px,
        py,
        pz,
        0,
        Hsafe / 2,
        -tDsafe / 2,
        Wsafe / 2,
        Hsafe / 2,
        tDsafe / 2,
        rIn,
        true,
        vi,
        pos,
        nor,
        uv,
        u,
        v
      );
    };

    // ---- exterior rounded-box writer (normals outward) -------------------
    const writeOut = (
      vi: number,
      px: number,
      py: number,
      pz: number,
      u: number,
      v: number
    ) => {
      mapRounded(
        px,
        py,
        pz,
        0,
        Hsafe / 2,
        -tDo / 2,
        Wo / 2,
        Ho / 2,
        tDo / 2,
        rOut,
        false,
        vi,
        pos,
        nor,
        uv,
        u,
        v
      );
    };

    const { xs, ys, zs, xso, yso, zso } = this;

    // interior faces
    let f = this.faces[0];
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++)
        writeIn(f.offset + j * NX + i, xs[i], 0, zs[j], xs[i], zs[j]);

    f = this.faces[1];
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++)
        writeIn(f.offset + j * NX + i, xs[i], Hsafe, zs[j], xs[i], zs[j]);

    f = this.faces[2];
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NZ; i++)
        writeIn(f.offset + j * NZ + i, -Wsafe / 2, ys[j], zs[i], zs[i], ys[j]);

    f = this.faces[3];
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NZ; i++)
        writeIn(f.offset + j * NZ + i, Wsafe / 2, ys[j], zs[i], zs[i], ys[j]);

    f = this.faces[4];
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++)
        writeIn(f.offset + j * NX + i, xs[i], ys[j], -tDsafe, xs[i], ys[j]);

    // exterior faces
    f = this.faces[5];
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++)
        writeOut(f.offset + j * NX + i, xso[i], -t, zso[j], xso[i], zso[j]);

    f = this.faces[6];
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++)
        writeOut(f.offset + j * NX + i, xso[i], Hsafe + t, zso[j], xso[i], zso[j]);

    f = this.faces[7];
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NZ; i++)
        writeOut(f.offset + j * NZ + i, -Wo / 2, yso[j], zso[i], zso[i], yso[j]);

    f = this.faces[8];
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NZ; i++)
        writeOut(f.offset + j * NZ + i, Wo / 2, yso[j], zso[i], zso[i], yso[j]);

    f = this.faces[9];
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++)
        writeOut(f.offset + j * NX + i, xso[i], yso[j], -tDo, xso[i], yso[j]);

    // ---- front rim ribbon with corner fillers ----------------------------
    // Build the rounded-rect opening path at a given radius / half-extents,
    // then interpolate across thickness from interior → exterior.
    f = this.faces[10];
    for (let v = 0; v < RIM_V; v++) {
      const tv = v / (RIM_V - 1); // 0 = interior, 1 = exterior
      const rt = rIn + t * tv;
      const hw = Wsafe / 2 + t * tv;
      const y0 = 0 - t * tv;
      const y1 = Hsafe + t * tv;
      // path samples at this thickness level
      const path = buildOpeningPath(hw, y0, y1, rt, RIM_BOTTOM, RIM_RIGHT, ARC);

      for (let u = 0; u < RIM_U; u++) {
        const pt = path[u];
        const vi = f.offset + v * RIM_U + u;
        const i3 = vi * 3;
        pos[i3] = pt.x;
        pos[i3 + 1] = pt.y;
        pos[i3 + 2] = 0; // front plane
        // rim normal faces +Z (out of the opening toward camera)
        nor[i3] = 0;
        nor[i3 + 1] = 0;
        nor[i3 + 2] = 1;
        const i2 = vi * 2;
        uv[i2] = (u / RIM_U) * 4;
        uv[i2 + 1] = tv * UV_SCALE;
      }
    }

    // Smooth rim normals at the thickness edges so they blend toward
    // interior/exterior rather than a hard faceted lip.
    for (let u = 0; u < RIM_U; u++) {
      // interior edge of rim (v=0): blend toward interior opening normal
      // which for a front rim is still mostly +Z but with a slight pull
      // from the wall direction — keep +Z for a clean architectural lip.
      // exterior edge stays +Z.
      // Recompute via central difference for better shading on the lip.
      for (let v = 0; v < RIM_V; v++) {
        const vi = f.offset + v * RIM_U + u;
        const uPrev = f.offset + v * RIM_U + ((u - 1 + RIM_U) % RIM_U);
        const uNext = f.offset + v * RIM_U + ((u + 1) % RIM_U);
        const vPrev = f.offset + Math.max(0, v - 1) * RIM_U + u;
        const vNext = f.offset + Math.min(RIM_V - 1, v + 1) * RIM_U + u;

        const e1x = pos[uNext * 3] - pos[uPrev * 3];
        const e1y = pos[uNext * 3 + 1] - pos[uPrev * 3 + 1];
        const e1z = pos[uNext * 3 + 2] - pos[uPrev * 3 + 2];
        const e2x = pos[vNext * 3] - pos[vPrev * 3];
        const e2y = pos[vNext * 3 + 1] - pos[vPrev * 3 + 1];
        const e2z = pos[vNext * 3 + 2] - pos[vPrev * 3 + 2];
        // cross e1 × e2
        let nx = e1y * e2z - e1z * e2y;
        let ny = e1z * e2x - e1x * e2z;
        let nz = e1x * e2y - e1y * e2x;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        // ensure facing camera (+Z hemisphere)
        if (nz < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        nor[vi * 3] = nx;
        nor[vi * 3 + 1] = ny;
        nor[vi * 3 + 2] = nz;
      }
    }

    this.attributes.position.needsUpdate = true;
    this.attributes.normal.needsUpdate = true;
    this.attributes.uv.needsUpdate = true;
    this.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, Hsafe / 2, -tDsafe / 2),
      Math.sqrt(Wo * Wo + Ho * Ho + tDo * tDo) * 0.5 + rOut + 0.5
    );
  }

  private resolveWindingAndIndex() {
    const pos = this.pos;
    const nor = this.nor;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (const face of this.faces) {
      if (face.forceFlip !== undefined) {
        face.flip = face.forceFlip;
        continue;
      }
      const i0 =
        face.offset + Math.floor(face.nv / 2) * face.nu + Math.floor(face.nu / 2);
      const i1 = i0 + 1;
      const i2 = i0 + face.nu;
      a.fromArray(pos, i0 * 3);
      b.fromArray(pos, i1 * 3);
      c.fromArray(pos, i2 * 3);
      n.fromArray(nor, i0 * 3);
      b.sub(a);
      c.sub(a);
      b.cross(c);
      face.flip = b.dot(n) < 0;
    }

    const indices: number[] = [];
    for (const face of this.faces) {
      const wrapU = face === this.faces[10]; // rim is a closed loop in U
      for (let j = 0; j < face.nv - 1; j++) {
        const iMax = wrapU ? face.nu : face.nu - 1;
        for (let i = 0; i < iMax; i++) {
          const i1 = (i + 1) % face.nu;
          const v00 = face.offset + j * face.nu + i;
          const v10 = face.offset + j * face.nu + i1;
          const v01 = face.offset + (j + 1) * face.nu + i;
          const v11 = face.offset + (j + 1) * face.nu + i1;
          if (face.flip) {
            indices.push(v00, v01, v10, v10, v01, v11);
          } else {
            indices.push(v00, v10, v01, v10, v11, v01);
          }
        }
      }
    }
    this.setIndex(indices);
  }
}

/** Project a point onto a rounded box; write position + normal. */
function mapRounded(
  px: number,
  py: number,
  pz: number,
  cx: number,
  cy: number,
  cz: number,
  ex: number,
  ey: number,
  ez: number,
  r: number,
  inward: boolean,
  vi: number,
  pos: Float32Array,
  nor: Float32Array,
  uv: Float32Array,
  u: number,
  v: number
) {
  const ix = ex - r;
  const iy = ey - r;
  const izMin = -(ez - r);
  const izMax = ez; // open front
  const rx = px - cx;
  const ry = py - cy;
  const rz = pz - cz;
  const qx = rx < -ix ? -ix : rx > ix ? ix : rx;
  const qy = ry < -iy ? -iy : ry > iy ? iy : ry;
  const qz = rz < izMin ? izMin : rz > izMax ? izMax : rz;
  let dx = rx - qx;
  let dy = ry - qy;
  let dz = rz - qz;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= len;
  dy /= len;
  dz /= len;
  const i3 = vi * 3;
  pos[i3] = cx + qx + r * dx;
  pos[i3 + 1] = cy + qy + r * dy;
  pos[i3 + 2] = cz + qz + r * dz;
  // inward: -d, outward: +d
  const s = inward ? -1 : 1;
  nor[i3] = s * dx;
  nor[i3 + 1] = s * dy;
  nor[i3 + 2] = s * dz;
  const i2 = vi * 2;
  uv[i2] = u * UV_SCALE;
  uv[i2 + 1] = v * UV_SCALE;
}

/**
 * Rounded-rectangle opening path in the front plane (z = 0).
 * Order (CCW from outside looking +Z→−Z, i.e. looking into the room):
 *   bottom L→R, BR arc, right B→T, TR arc, top R→L, TL arc, left T→B, BL arc.
 * Corner arcs are the curved corner fillers.
 */
function buildOpeningPath(
  hw: number,
  y0: number,
  y1: number,
  r: number,
  nBottom: number,
  nRight: number,
  nArc: number
): { x: number; y: number }[] {
  const rr = Math.min(r, hw - 0.01, (y1 - y0) / 2 - 0.01);
  const path: { x: number; y: number }[] = [];

  const xL = -hw + rr;
  const xR = hw - rr;
  const yB = y0 + rr;
  const yT = y1 - rr;

  // bottom straight (left → right)
  for (let i = 0; i < nBottom; i++) {
    const t = nBottom === 1 ? 0.5 : i / (nBottom - 1);
    path.push({ x: xL + (xR - xL) * t, y: y0 });
  }
  // bottom-right arc (from down to right: angle π/2 → 0)
  for (let i = 0; i < nArc; i++) {
    const a = Math.PI / 2 - ((i + 1) / nArc) * (Math.PI / 2);
    path.push({ x: xR + rr * Math.cos(a), y: yB - rr * Math.sin(a) });
  }
  // right straight (bottom → top)
  for (let i = 0; i < nRight; i++) {
    const t = nRight === 1 ? 0.5 : i / (nRight - 1);
    path.push({ x: hw, y: yB + (yT - yB) * t });
  }
  // top-right arc (from right to up: angle 0 → -π/2)
  for (let i = 0; i < nArc; i++) {
    const a = 0 - ((i + 1) / nArc) * (Math.PI / 2);
    path.push({ x: xR + rr * Math.cos(a), y: yT - rr * Math.sin(a) });
  }
  // top straight (right → left)
  for (let i = 0; i < nBottom; i++) {
    const t = nBottom === 1 ? 0.5 : i / (nBottom - 1);
    path.push({ x: xR + (xL - xR) * t, y: y1 });
  }
  // top-left arc (from up to left: angle -π/2 → -π)
  for (let i = 0; i < nArc; i++) {
    const a = -Math.PI / 2 - ((i + 1) / nArc) * (Math.PI / 2);
    path.push({ x: xL + rr * Math.cos(a), y: yT - rr * Math.sin(a) });
  }
  // left straight (top → bottom)
  for (let i = 0; i < nRight; i++) {
    const t = nRight === 1 ? 0.5 : i / (nRight - 1);
    path.push({ x: -hw, y: yT + (yB - yT) * t });
  }
  // bottom-left arc (from left to down: angle π → π/2)
  for (let i = 0; i < nArc; i++) {
    const a = Math.PI - ((i + 1) / nArc) * (Math.PI / 2);
    path.push({ x: xL + rr * Math.cos(a), y: yB - rr * Math.sin(a) });
  }

  return path;
}

function fillBothRounded(
  out: Float64Array,
  a0: number,
  a1: number,
  r: number,
  mid: number
) {
  let k = 0;
  for (let i = 0; i < E; i++) out[k++] = a0 + r * arcEase(i / E);
  const m0 = a0 + r;
  const m1 = a1 - r;
  for (let j = 0; j <= mid; j++) out[k++] = m0 + ((m1 - m0) * j) / mid;
  for (let i = 1; i <= E; i++) out[k++] = a1 - r + r * (1 - arcEase(1 - i / E));
}

function fillBackRounded(
  out: Float64Array,
  a0: number,
  a1: number,
  r: number,
  mid: number
) {
  let k = 0;
  for (let i = 0; i < E; i++) out[k++] = a0 + r * arcEase(i / E);
  const m0 = a0 + r;
  for (let j = 0; j <= mid; j++) out[k++] = m0 + ((a1 - m0) * j) / mid;
}

function arcEase(t: number) {
  return Math.sin((t * Math.PI) / 2) ** 1.35;
}
