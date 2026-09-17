import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useBoundsChannel } from '../../../react/bounds-context';
import { elapsedTime } from '../../../react/r3f-compat';

/** Hovering rounded platform with a still-life; tracks the live room depth. */

function makePuckGeometry(R: number, hgt: number, e: number) {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0));
  const K = 10;
  for (let k = 0; k <= K; k++) {
    const a = (k / K) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - e + e * Math.sin(a), e - e * Math.cos(a)));
  }
  for (let k = 0; k <= K; k++) {
    const a = (k / K) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - e + e * Math.cos(a), hgt - e + e * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0, hgt));
  const geo = new THREE.LatheGeometry(pts, 72);
  return geo;
}

export function FloatingStage({ palette, speed }: { palette: string[]; speed: number }) {
  const group = useRef<THREE.Group>(null);
  const H = 0.26;
  const bounds = useBoundsChannel();
  const puck = useMemo(() => makePuckGeometry(1.55, H, 0.09), []);
  useEffect(() => () => puck.dispose(), [puck]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const b = bounds.current;
    const t = elapsedTime(state) * speed;
    // hover mid-depth of the live adaptive room, gentle bob + slow turn
    g.position.set(0, 0.52 + Math.sin(t * 0.65) * 0.045, (b.back + b.front) / 2 + 0.4);
    g.rotation.y = t * 0.07;
  });

  return (
    <group ref={group}>
      <mesh geometry={puck} castShadow receiveShadow>
        <meshStandardMaterial color={palette[2]} roughness={0.75} metalness={0.05} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.42, H + 0.52, -0.12]}>
        <sphereGeometry args={[0.52, 80, 48]} />
        <meshStandardMaterial color={palette[0]} roughness={0.8} metalness={0.02} />
      </mesh>
      {/* standing egg form */}
      <mesh
        castShadow
        receiveShadow
        position={[0.62, H + 0.46, 0.34]}
        scale={[1, 1.4, 1]}
      >
        <sphereGeometry args={[0.33, 64, 40]} />
        <meshStandardMaterial color={palette[1]} roughness={0.5} metalness={0.04} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.18, H + 0.17, -0.72]}>
        <sphereGeometry args={[0.17, 48, 32]} />
        <meshStandardMaterial color={palette[3]} roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  );
}
