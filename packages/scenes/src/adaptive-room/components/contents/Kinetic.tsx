import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useBoundsChannel } from '../../../react/bounds-context';

/**
 * Kinetic mobile — three slowly precessing orbital rings of spheres around a
 * still center. The whole constellation derives its radius from the live
 * adaptive bounds: it breathes wider on ultrawide viewports and condenses in
 * portrait, always keeping clearance from the coves.
 */

interface Ring {
  n: number;
  r: number; // fraction of base radius
  size: number;
  speed: number;
  tilt: number;
  precess: number;
}

const RINGS: Ring[] = [
  { n: 6, r: 0.42, size: 0.13, speed: 0.3, tilt: 0.5, precess: 0.05 },
  { n: 10, r: 0.7, size: 0.095, speed: -0.19, tilt: 1.05, precess: -0.035 },
  { n: 14, r: 1.0, size: 0.07, speed: 0.115, tilt: 1.62, precess: 0.024 },
];
const TOTAL = RINGS.reduce((s, r) => s + r.n, 0);

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _pos = new THREE.Vector3();
const _euler = new THREE.Euler();
const _rot = new THREE.Matrix4();

export function Kinetic({ palette, speed = 1 }: { palette: string[]; speed?: number }) {
  const bounds = useBoundsChannel();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const radius = useRef(1.6);
  const simTime = useRef(0);
  const spd = useRef(speed);
  spd.current = speed;

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    let idx = 0;
    RINGS.forEach((ring, ri) => {
      for (let j = 0; j < ring.n; j++) {
        _color.set(palette[(ri + j) % palette.length]);
        _color.offsetHSL(0, 0, (((j * 0.618) % 1) - 0.5) * 0.08);
        m.setColorAt(idx++, _color);
      }
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [palette]);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const b = bounds.current;
    simTime.current += Math.min(delta, 0.1) * spd.current;
    const t = simTime.current;

    const halfW = (b.right - b.left) / 2;
    const halfH = (b.ceiling - b.floor) / 2;
    const halfD = (b.front - b.back) / 2;
    const targetR = Math.max(
      0.9,
      Math.min(halfW - b.radius - 0.55, halfH - 0.55, halfD - 0.3)
    );
    radius.current = THREE.MathUtils.damp(radius.current, targetR, 5, Math.min(delta, 0.05));
    const R = radius.current;

    const cx = 0;
    const cy = (b.floor + b.ceiling) / 2 + Math.sin(t * 0.4) * 0.06;
    const cz = (b.back + b.front) / 2 + 0.2;

    let idx = 0;
    for (const ring of RINGS) {
      _euler.set(
        ring.tilt + Math.sin(t * ring.precess * 2) * 0.22,
        t * ring.precess * 3,
        Math.cos(t * ring.precess * 1.6) * 0.15
      );
      _rot.makeRotationFromEuler(_euler);
      const rr = ring.r * R;
      for (let j = 0; j < ring.n; j++) {
        const a = (j / ring.n) * Math.PI * 2 + t * ring.speed;
        _pos.set(Math.cos(a) * rr, Math.sin(a) * rr, 0).applyMatrix4(_rot);
        _dummy.position.set(cx + _pos.x, cy + _pos.y, cz + _pos.z);
        _dummy.scale.setScalar(ring.size * (0.8 + R * 0.12));
        _dummy.updateMatrix();
        m.setMatrixAt(idx++, _dummy.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;

    if (core.current) core.current.position.set(cx, cy, cz);
  });

  return (
    <group>
      <mesh ref={core} castShadow receiveShadow>
        <sphereGeometry args={[0.34, 64, 40]} />
        <meshStandardMaterial color="#2f2c29" roughness={0.25} metalness={0.15} />
      </mesh>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, TOTAL]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 32, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} metalness={0.06} />
      </instancedMesh>
    </group>
  );
}
