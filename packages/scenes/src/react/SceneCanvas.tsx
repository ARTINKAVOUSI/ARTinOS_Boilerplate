import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three/webgpu';

export interface SceneCanvasProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Force the WebGL2 backend of WebGPURenderer. */
  forceWebGL?: boolean;
  /** Initial tone-mapping exposure (scenes may damp it afterwards). */
  exposure?: number;
  clearColor?: THREE.ColorRepresentation;
  dpr?: number | [number, number];
  camera?: { fov?: number; near?: number; far?: number; position?: [number, number, number] };
}

/**
 * A ready-to-use full-bleed canvas for scenes used outside a host framework:
 * `WebGPURenderer` (falls back to its WebGL2 backend), soft shadow maps and
 * ACES tone mapping.
 */
export function SceneCanvas({
  children,
  className,
  style,
  forceWebGL = false,
  exposure = 1.05,
  clearColor = 0x101012,
  dpr = [1, 1.5],
  camera = { fov: 35, near: 0.1, far: 200, position: [0, 2.5, 7] },
}: SceneCanvasProps) {
  const renderer = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => async (props: any) => {
      const instance = new THREE.WebGPURenderer({
        ...props,
        antialias: false,
        powerPreference: 'high-performance',
        alpha: false,
        depth: true,
        stencil: false,
        forceWebGL,
      });
      await instance.init();
      instance.shadowMap.enabled = true;
      instance.shadowMap.type = THREE.PCFSoftShadowMap;
      instance.toneMapping = THREE.ACESFilmicToneMapping;
      instance.toneMappingExposure = exposure;
      instance.setClearColor(clearColor, 1);
      return instance;
    },
    // renderer settings are read once at creation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forceWebGL]
  );
  // R3F v10 takes the renderer factory as `renderer`
  const AnyCanvas = Canvas as unknown as (p: Record<string, unknown>) => ReactNode;
  return (
    <div className={className} style={{ position: 'absolute', inset: 0, ...style }}>
      <AnyCanvas renderer={renderer} shadows dpr={dpr} camera={camera} frameloop="always">
        {children}
      </AnyCanvas>
    </div>
  );
}
