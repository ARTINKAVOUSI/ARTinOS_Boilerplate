import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useBoundsChannel } from '../../react/bounds-context';
import type { StagingParams } from '../model/lighting';
import type { Theme } from '../model/themes';

/**
 * Staging props that live inside the adaptive chamber and track
 * the live scene bounds so they re-compose with the room:
 *
 *   · rounded plinth / pedestal
 *   · contact shadow catcher
 *   · vertical backdrop card
 *   · optional floor sheen plane
 *   · turntable spin driver (reports angle via callback / shared ref)
 */

function makePuck(R: number, hgt: number, e: number) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  const K = 8;
  for (let k = 0; k <= K; k++) {
    const a = (k / K) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - e + e * Math.sin(a), e - e * Math.cos(a)));
  }
  for (let k = 0; k <= K; k++) {
    const a = (k / K) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - e + e * Math.cos(a), hgt - e + e * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0, hgt));
  return new THREE.LatheGeometry(pts, 64);
}

export function StagingRig({
  staging,
  theme,
  turntableRef,
}: {
  staging: StagingParams;
  theme?: Theme;
  /** Shared ref: current turntable yaw (radians). AdaptiveRoom reads this. */
  turntableRef: MutableRefObject<number>;
}) {
  const bounds = useBoundsChannel();
  const S = useRef(staging);
  S.current = staging;

  const plinth = useRef<THREE.Mesh>(null);
  const catcher = useRef<THREE.Mesh>(null);
  const backdrop = useRef<THREE.Mesh>(null);
  const sheen = useRef<THREE.Mesh>(null);

  const plinthGeo = useMemo(
    () => makePuck(1, 1, 0.08),
    []
  );

  const last = useRef({ r: -1, h: -1 });

  // the plinth geometry is swapped by hand below, so it is also freed by hand
  useEffect(() => {
    const mesh = plinth.current;
    return () => mesh?.geometry.dispose();
  }, []);

  useFrame((_, delta) => {
    const st = S.current;
    const b = bounds.current;
    const depth = b.front - b.back;
    const cz = b.back + depth * 0.48;

    // turntable angle
    if (st.turntable) {
      turntableRef.current += (st.turntableSpeed * Math.PI * 2 * delta) / 60;
    }

    // plinth
    if (plinth.current) {
      plinth.current.visible = st.plinth;
      if (st.plinth) {
        const R = st.plinthRadius;
        const H = st.plinthHeight;
        if (Math.abs(last.current.r - R) > 0.001 || Math.abs(last.current.h - H) > 0.001) {
          plinth.current.geometry.dispose();
          plinth.current.geometry = makePuck(R, H, Math.min(0.08, H * 0.25));
          last.current = { r: R, h: H };
        }
        plinth.current.position.set(0, b.floor, cz);
        const mat = plinth.current.material as THREE.MeshStandardMaterial;
        const col = st.plinthColor || theme?.room || '#e9e4dc';
        if ('#' + mat.color.getHexString() !== col.toLowerCase()) mat.color.set(col);
      }
    }

    // shadow catcher
    if (catcher.current) {
      catcher.current.visible = st.shadowCatcher;
      if (st.shadowCatcher) {
        const sc = st.shadowCatcherScale;
        catcher.current.position.set(0, b.floor + 0.004, cz);
        catcher.current.scale.set(sc, sc, 1);
        const mat = catcher.current.material as THREE.ShadowMaterial;
        mat.opacity = st.shadowCatcherOpacity;
      }
    }

    // backdrop card
    if (backdrop.current) {
      backdrop.current.visible = st.backdrop;
      if (st.backdrop) {
        const z = cz - st.backdropOffset;
        backdrop.current.position.set(0, b.floor + st.backdropHeight * 0.5, z);
        backdrop.current.scale.set(st.backdropWidth, st.backdropHeight, 1);
        const mat = backdrop.current.material as THREE.MeshStandardMaterial;
        const col = st.backdropColor || theme?.room || '#e9e4dc';
        if ('#' + mat.color.getHexString() !== col.toLowerCase()) mat.color.set(col);
      }
    }

    // floor sheen
    if (sheen.current) {
      const on = st.floorSheen > 0.01;
      sheen.current.visible = on;
      if (on) {
        const w = (b.right - b.left) * 0.9;
        const d = depth * 0.7;
        sheen.current.position.set(0, b.floor + 0.006, cz);
        sheen.current.scale.set(w, d, 1);
        const mat = sheen.current.material as THREE.MeshStandardMaterial;
        mat.opacity = Math.min(0.7, st.floorSheen * 0.55);
        mat.metalness = 0.6 + st.floorSheen * 0.3;
        mat.roughness = Math.max(0.05, 0.35 - st.floorSheen * 0.25);
      }
    }
  });

  return (
    <group>
      <mesh ref={plinth} geometry={plinthGeo} castShadow receiveShadow visible={false}>
        <meshStandardMaterial color="#e9e4dc" roughness={0.9} metalness={0.02} />
      </mesh>

      <mesh ref={catcher} rotation-x={-Math.PI / 2} receiveShadow visible={false}>
        <circleGeometry args={[1.2, 48]} />
        <shadowMaterial transparent opacity={0.22} />
      </mesh>

      <mesh ref={backdrop} receiveShadow castShadow visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#e9e4dc" roughness={0.95} metalness={0.01} side={THREE.DoubleSide} />
      </mesh>

      <mesh ref={sheen} rotation-x={-Math.PI / 2} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.2}
          metalness={0.7}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
