import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useBoundsChannel } from '../../../react/bounds-context';
import { elapsedTime, useRenderer } from '../../../react/r3f-compat';

/**
 * Instanced ball simulation that collides against the *live* adaptive room
 * scene bounds using the exact same rounded-interior
 * clamp/offset map as the visual shell — walls, coves and the invisible
 * open-front plane all agree with the rendered architecture. Resize the
 * viewport and the simulation domain re-composes with the room.
 *
 * Modes:
 *   pool  — gravity ball pool (SSGI ball-pit homage). Click to stir.
 *   drift — zero-G spheres drifting and bouncing elastically.
 */

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface BallSimProps {
  mode: 'pool' | 'drift';
  palette: string[];
  count?: number;
  speed?: number;
}

const MAX_BALLS = 420;

export function BallSim({ mode, palette, count, speed = 1 }: BallSimProps) {
  const n = Math.min(MAX_BALLS, Math.max(4, count ?? (mode === 'pool' ? 84 : 24)));
  const spd = useRef(speed);
  spd.current = speed;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const gl = useRenderer();
  const bounds = useBoundsChannel();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const burst = useRef(false);

  const sim = useMemo(() => {
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const rad = new Float32Array(n);
    const phase = new Float32Array(n);
    const b = bounds.current;
    const rand = mulberry32(mode === 'pool' ? 1234 : 987);
    for (let i = 0; i < n; i++) {
      rad[i] = mode === 'pool' ? 0.15 + rand() * 0.2 : 0.22 + rand() * 0.28;
      phase[i] = rand() * Math.PI * 2;
      const mx = rad[i] + 0.3;
      pos[i * 3] = lerp(b.left + mx, b.right - mx, rand());
      pos[i * 3 + 2] = lerp(b.back + mx, b.front - mx, rand());
      if (mode === 'pool') {
        // rain in from above, staggered
        pos[i * 3 + 1] = b.ceiling * (0.5 + (i / n) * 2.2) + rand();
        vel[i * 3] = (rand() - 0.5) * 0.6;
        vel[i * 3 + 1] = -rand() * 0.5;
        vel[i * 3 + 2] = (rand() - 0.5) * 0.6;
      } else {
        pos[i * 3 + 1] = lerp(b.floor + mx, b.ceiling - mx, rand());
        const a = rand() * Math.PI * 2;
        const e = rand() * Math.PI - Math.PI / 2;
        const s = 0.5 + rand() * 0.4;
        vel[i * 3] = Math.cos(a) * Math.cos(e) * s;
        vel[i * 3 + 1] = Math.sin(e) * s;
        vel[i * 3 + 2] = Math.sin(a) * Math.cos(e) * s;
      }
    }
    return { pos, vel, rad, phase };
  }, [n, mode, bounds]);

  // per-instance colors from the theme palette (updates live on theme change)
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < n; i++) {
      _color.set(palette[i % palette.length]);
      _color.offsetHSL(0, 0, (((i * 0.61803) % 1) - 0.5) * 0.1);
      mesh.setColorAt(i, _color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [palette, n, sim]);

  // click / tap = stir burst
  useEffect(() => {
    const el = gl.domElement;
    const fn = () => (burst.current = true);
    el.addEventListener('pointerdown', fn);
    return () => el.removeEventListener('pointerdown', fn);
  }, [gl]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 1 / 30) * Math.max(0, Math.min(4, spd.current));
    if (dt === 0) return; // paused
    const { pos, vel, rad, phase } = sim;
    const b = bounds.current;
    const t = elapsedTime(state);

    raycaster.setFromCamera(state.pointer, state.camera as THREE.PerspectiveCamera);
    const ro = raycaster.ray.origin;
    const rd = raycaster.ray.direction;
    const doBurst = burst.current;
    burst.current = false;

    const gravity = mode === 'pool' ? -13 : 0;
    const wallRest = mode === 'pool' ? 0.45 : 1.0;
    const pairRest = mode === 'pool' ? 0.25 : 0.95;
    const repelK = mode === 'pool' ? 3.2 : 1.8;
    const repelR = mode === 'pool' ? 1.15 : 1.5;

    const steps = 2;
    const h = dt / steps;

    for (let s = 0; s < steps; s++) {
      // integrate + external forces
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        vel[i3 + 1] += gravity * h;

        if (mode === 'drift') {
          // gentle per-ball current so drift never dies
          vel[i3] += Math.sin(t * 0.4 + phase[i]) * 0.18 * h;
          vel[i3 + 1] += Math.cos(t * 0.33 + phase[i] * 1.7) * 0.18 * h;
        } else {
          const k = 1 / (1 + 0.18 * h); // mild drag
          vel[i3] *= k;
          vel[i3 + 1] *= k;
          vel[i3 + 2] *= k;
        }

        // pointer repulsion along the view ray
        const px = pos[i3] - ro.x;
        const py = pos[i3 + 1] - ro.y;
        const pz = pos[i3 + 2] - ro.z;
        const proj = px * rd.x + py * rd.y + pz * rd.z;
        if (proj > 0) {
          let dx = px - rd.x * proj;
          let dy = py - rd.y * proj;
          let dz = pz - rd.z * proj;
          const dist = Math.hypot(dx, dy, dz);
          const reach = doBurst && s === 0 ? repelR * 2.2 : repelR;
          if (dist < reach && dist > 1e-4) {
            dx /= dist;
            dy /= dist;
            dz /= dist;
            const f = (1 - dist / reach) * repelK;
            const imp = doBurst && s === 0 ? f * 2.4 : f * h * 6;
            vel[i3] += dx * imp;
            vel[i3 + 1] += dy * imp;
            vel[i3 + 2] += dz * imp;
          }
        }

        pos[i3] += vel[i3] * h;
        pos[i3 + 1] += vel[i3 + 1] * h;
        pos[i3 + 2] += vel[i3 + 2] * h;
      }

      // sphere-sphere
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const ri = rad[i];
        const mi = ri * ri * ri;
        for (let j = i + 1; j < n; j++) {
          const j3 = j * 3;
          const minD = ri + rad[j];
          let dx = pos[j3] - pos[i3];
          let dy = pos[j3 + 1] - pos[i3 + 1];
          let dz = pos[j3 + 2] - pos[i3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= minD * minD || d2 < 1e-9) continue;
          const dist = Math.sqrt(d2);
          dx /= dist;
          dy /= dist;
          dz /= dist;
          const mj = rad[j] * rad[j] * rad[j];
          const wI = mj / (mi + mj);
          const wJ = mi / (mi + mj);
          const overlap = (minD - dist) * 0.85;
          pos[i3] -= dx * overlap * wI;
          pos[i3 + 1] -= dy * overlap * wI;
          pos[i3 + 2] -= dz * overlap * wI;
          pos[j3] += dx * overlap * wJ;
          pos[j3 + 1] += dy * overlap * wJ;
          pos[j3 + 2] += dz * overlap * wJ;
          const rvx = vel[i3] - vel[j3];
          const rvy = vel[i3 + 1] - vel[j3 + 1];
          const rvz = vel[i3 + 2] - vel[j3 + 2];
          const vn = rvx * dx + rvy * dy + rvz * dz;
          if (vn > 0) {
            const jimp = (1 + pairRest) * vn;
            vel[i3] -= dx * jimp * wI;
            vel[i3 + 1] -= dy * jimp * wI;
            vel[i3 + 2] -= dz * jimp * wI;
            vel[j3] += dx * jimp * wJ;
            vel[j3 + 1] += dy * jimp * wJ;
            vel[j3 + 2] += dz * jimp * wJ;
          }
        }
      }

      // rounded-interior wall collision — identical map to the room shell
      const cx = (b.left + b.right) / 2;
      const cy = (b.floor + b.ceiling) / 2;
      const cz = (b.back + b.front) / 2;
      const ex = (b.right - b.left) / 2;
      const ey = (b.ceiling - b.floor) / 2;
      const ez = (b.front - b.back) / 2;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const rb = rad[i];

        // invisible open-front plane
        if (pos[i3 + 2] + rb > b.front - 0.02) {
          pos[i3 + 2] = b.front - 0.02 - rb;
          if (vel[i3 + 2] > 0) vel[i3 + 2] *= -wallRest;
        }

        const r = Math.max(b.radius, rb + 0.02);
        const ix = Math.max(ex - r, 0);
        const iy = Math.max(ey - r, 0);
        const izMin = -(ez - r);
        const izMax = ez; // open front: no inset
        const rx = pos[i3] - cx;
        const ry = pos[i3 + 1] - cy;
        const rz = pos[i3 + 2] - cz;
        const qx = rx < -ix ? -ix : rx > ix ? ix : rx;
        const qy = ry < -iy ? -iy : ry > iy ? iy : ry;
        const qz = rz < izMin ? izMin : rz > izMax ? izMax : rz;
        let dx = rx - qx;
        let dy = ry - qy;
        let dz = rz - qz;
        const len = Math.hypot(dx, dy, dz);
        const maxD = r - rb;
        if (len > maxD && len > 1e-9) {
          dx /= len;
          dy /= len;
          dz /= len;
          pos[i3] = cx + qx + dx * maxD;
          pos[i3 + 1] = cy + qy + dy * maxD;
          pos[i3 + 2] = cz + qz + dz * maxD;
          const vn = vel[i3] * dx + vel[i3 + 1] * dy + vel[i3 + 2] * dz;
          if (vn > 0) {
            const jimp = (1 + wallRest) * vn;
            vel[i3] -= dx * jimp;
            vel[i3 + 1] -= dy * jimp;
            vel[i3 + 2] -= dz * jimp;
          }
        }
      }
    }

    // drift: cap speed so elastic bounces stay serene
    if (mode === 'drift') {
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const sp = Math.hypot(vel[i3], vel[i3 + 1], vel[i3 + 2]);
        if (sp > 1.4) {
          const k = 1.4 / sp;
          vel[i3] *= k;
          vel[i3 + 1] *= k;
          vel[i3 + 2] *= k;
        }
      }
    }

    // write instance matrices
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      _dummy.position.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      _dummy.scale.setScalar(rad[i]);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      key={`${mode}-${n}`}
      ref={meshRef}
      args={[undefined, undefined, n]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 40, 28]} />
      <meshStandardMaterial color="#ffffff" roughness={0.55} metalness={0.04} />
    </instancedMesh>
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
