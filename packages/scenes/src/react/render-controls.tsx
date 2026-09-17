import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { dampFactor, frameDelta } from '../core/math';
import { useRenderer } from './r3f-compat';

/** Smoothly lerps `scene.background` toward `color`; restores the previous background on unmount. */
export function SceneBackground({ color }: { color: string }) {
  const scene = useThree((s) => s.scene);
  const target = useMemo(() => new THREE.Color(color), [color]);
  useEffect(() => {
    const previous = scene.background;
    return () => {
      scene.background = previous;
    };
  }, [scene]);
  useFrame((_, delta) => {
    if (!(scene.background instanceof THREE.Color)) {
      scene.background = target.clone();
      return;
    }
    scene.background.lerp(target, dampFactor(5, frameDelta(delta)));
  });
  return null;
}

/** Damped tone-mapping exposure. Mount only where the scene owns tone mapping. */
export function ExposureController({ exposure }: { exposure: number }) {
  const renderer = useRenderer();
  useFrame((_, delta) => {
    if (!renderer) return;
    const r = renderer as { toneMappingExposure: number };
    r.toneMappingExposure += (exposure - r.toneMappingExposure) * dampFactor(6, frameDelta(delta));
  });
  return null;
}

/** Caps the device pixel ratio. Mount only where the scene owns resolution. */
export function PixelRatioController({ dpr }: { dpr: number }) {
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    setDpr(Math.min(dpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  }, [dpr, setDpr]);
  return null;
}
