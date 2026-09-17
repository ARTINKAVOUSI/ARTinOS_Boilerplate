import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useBoundsChannel } from '../../../react/bounds-context';

/**
 * Pendulum wave — a row of ceiling-hung pendulums with graded periods that
 * drift in and out of phase (the classic museum piece). The *number* of
 * pendulums is derived live from the adaptive room width: widen the viewport
 * and pendulums are added; go portrait and the row condenses. Pivots track
 * the live ceiling, lengths track the live height. Pure kinematics.
 */

const MAX = 33; // instance capacity
const CYCLE = 42; // seconds for a full wave cycle
const BASE_OSC = 16; // oscillations of the slowest pendulum per cycle
const AMP = 0.5; // swing amplitude (radians)

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

export function PendulumWave({
  palette,
  speed = 1,
  density = 1,
}: {
  palette: string[];
  speed?: number;
  density?: number;
}) {
  const bounds = useBoundsChannel();
  const bobs = useRef<THREE.InstancedMesh>(null);
  const cables = useRef<THREE.InstancedMesh>(null);
  const smoothCount = useRef(9);
  const simTime = useRef(0);
  const opts = useRef({ speed, density });
  opts.current = { speed, density };

  // gradient of instance colors across the theme palette
  useEffect(() => {
    const mesh = bobs.current;
    if (!mesh) return;
    const stops = palette.map((c) => new THREE.Color(c));
    for (let i = 0; i < MAX; i++) {
      const t = (i / (MAX - 1)) * (stops.length - 1);
      const a = Math.floor(t);
      const b = Math.min(a + 1, stops.length - 1);
      _color.copy(stops[a]).lerp(stops[b], t - a);
      mesh.setColorAt(i, _color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [palette]);

  const phase = useMemo(() => Math.random() * 5, []);

  useFrame((_, delta) => {
    const bobMesh = bobs.current;
    const cableMesh = cables.current;
    if (!bobMesh || !cableMesh) return;

    const b = bounds.current;
    simTime.current += Math.min(delta, 0.1) * opts.current.speed;
    const t = simTime.current + phase;

    // adaptive pendulum count from live room width × density option
    const width = b.right - b.left;
    const usable = Math.max(width - 1.9, 1.2);
    const spacing = 0.5 / Math.max(0.15, Math.min(4, opts.current.density));
    const target = Math.min(MAX, Math.max(5, Math.round(usable / spacing) + 1));
    // smooth so single pendulums pop in/out gently during resize
    smoothCount.current += (target - smoothCount.current) * 0.08;
    const count = Math.round(smoothCount.current);

    const H = b.ceiling - b.floor;
    const L = H * 0.44;
    const bobR = Math.min(0.15, (usable / count) * 0.42);
    const pivotY = b.ceiling - 0.01;
    const pivotZ = (b.back + b.front) / 2;
    const x0 = -usable / 2;
    const dx = count > 1 ? usable / (count - 1) : 0;

    for (let i = 0; i < MAX; i++) {
      if (i >= count) {
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.quaternion.identity();
        _dummy.updateMatrix();
        bobMesh.setMatrixAt(i, _dummy.matrix);
        cableMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      // graded frequencies: pendulum i completes BASE_OSC + i oscillations/cycle
      const omega = (2 * Math.PI * (BASE_OSC + i)) / CYCLE;
      const theta = AMP * Math.cos(omega * t);
      const px = x0 + dx * i;
      const bx = px;
      const by = pivotY - L * Math.cos(theta);
      const bz = pivotZ + L * Math.sin(theta);

      _dummy.position.set(bx, by, bz);
      _dummy.scale.setScalar(bobR);
      _dummy.quaternion.identity();
      _dummy.updateMatrix();
      bobMesh.setMatrixAt(i, _dummy.matrix);

      // cable: thin cylinder from pivot to bob
      _dir.set(0, by - pivotY, bz - pivotZ);
      const len = _dir.length();
      _dir.normalize();
      _quat.setFromUnitVectors(_up, _dir);
      _dummy.position.set(px, (pivotY + by) / 2, (pivotZ + bz) / 2);
      _dummy.quaternion.copy(_quat);
      _dummy.scale.set(0.0065, len, 0.0065);
      _dummy.updateMatrix();
      cableMesh.setMatrixAt(i, _dummy.matrix);
    }
    bobMesh.instanceMatrix.needsUpdate = true;
    cableMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={bobs}
        args={[undefined, undefined, MAX]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 36, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.45} metalness={0.08} />
      </instancedMesh>
      <instancedMesh ref={cables} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 6, 1, true]} />
        <meshStandardMaterial color="#57534e" roughness={0.8} metalness={0.2} />
      </instancedMesh>
    </group>
  );
}
