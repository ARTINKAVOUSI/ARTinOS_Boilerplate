import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { createBoundsChannel, type BoundsChannel, type SceneBounds } from '../../core/bounds';
import { clamp, damp, dampFactor, frameDelta } from '../../core/math';
import { SceneBoundsProvider } from '../../react/bounds-context';
import { acquirePlasterMaps } from '../geometry/plaster-maps';
import { RoomShellGeometry } from '../geometry/RoomShellGeometry';
import { cameraComposition, fitFrustum, targetRadius, type FrustumFit } from '../model/frustum';
import { DEFAULT_LIGHT, type LightChannelId, type LightParams, type StagingParams } from '../model/lighting';
import type { RoomDims, RoomParams } from '../model/room-params';
import { SUBJECT_DEPTH, subjectScale, type SubjectSize } from '../model/subject-fit';
import type { Theme } from '../model/themes';
import { LightingRig } from './LightingRig';
import { StagingRig } from './StagingRig';
import { measureLocalBounds } from './measure';

/**
 * AdaptiveRoom — an open-front architectural chamber that conforms to the
 * camera frustum instead of forcing the camera into a fixed room.
 *
 *   viewport → aspect → frustum → visible world size → room dimensions
 *
 * Height & depth stay stable; width is the primary responsive dimension.
 * All transitions are critically damped so resizing feels like the room is
 * being re-composed, not rebuilt.
 *
 * Children are the fitted subject; `free` content reads the live bounds.
 * Everything below this component sees the room's bounds channel.
 */
export interface AdaptiveRoomProps {
  params: RoomParams;
  theme?: Theme;
  /** Light rig parameters, or `false` to leave lighting to the host. */
  light?: LightParams | false;
  staging?: StagingParams;
  /** Drive the camera (level view, fit distance, parallax). Default true. */
  camera?: boolean;
  activeLightChannel?: LightChannelId | null;
  onSelectLightChannel?: (id: LightChannelId) => void;
  /** Change it whenever the fitted subject changes identity → re-measure. */
  fitKey?: string | number;
  /** Content that manages itself against the bounds (sims, stages). */
  free?: ReactNode;
  /** Use an external bounds channel instead of an internal one. */
  bounds?: BoundsChannel;
  onBoundsChange?: (bounds: SceneBounds) => void;
  /** Also publish the bounds on `window.environment.bounds` (legacy consumers). */
  exposeGlobalBounds?: boolean;
  children?: ReactNode;
}

const DAMP = 6.5;
const MEASURE_RETRY_S = 0.25;
const _color = new THREE.Color();

export function AdaptiveRoom({
  params,
  theme,
  light = DEFAULT_LIGHT,
  staging,
  camera: driveCamera = true,
  activeLightChannel = null,
  onSelectLightChannel,
  fitKey,
  free,
  bounds: externalBounds,
  onBoundsChange,
  exposeGlobalBounds = false,
  children,
}: AdaptiveRoomProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  const internalBounds = useMemo(() => createBoundsChannel(), []);
  const bounds = externalBounds ?? internalBounds;

  const live = useRef(params);
  live.current = params;

  // ---- damped state -------------------------------------------------------
  const dims = useRef<RoomDims>({
    width: params.height * 1.6,
    height: params.height,
    depth: params.depth,
    totalDepth: params.depth + params.rearInset,
    radius: params.radius,
    wallThickness: params.wallThickness,
  });
  const cam = useRef({ dist: 7, fov: params.fov });
  const applied = useRef({ w: -1, h: -1, td: -1, r: -1, t: -1 });

  const geometry = useMemo(() => new RoomShellGeometry(dims.current), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const plaster = useMemo(() => acquirePlasterMaps(), []);
  useEffect(() => () => plaster.release(), [plaster]);
  const material = useRef<THREE.MeshStandardMaterial>(null);

  // ---- bounds consumers ----------------------------------------------------
  useEffect(() => (onBoundsChange ? bounds.subscribe(onBoundsChange) : undefined), [bounds, onBoundsChange]);
  useEffect(() => {
    if (!exposeGlobalBounds || typeof window === 'undefined') return;
    const w = window as unknown as { environment?: { bounds: SceneBounds } };
    const previous = w.environment;
    const exposed = { bounds: bounds.current };
    w.environment = exposed;
    return () => {
      if (w.environment === exposed) w.environment = previous;
    };
  }, [bounds, exposeGlobalBounds]);

  // ---- subject fitting ------------------------------------------------------
  const subjectOuter = useRef<THREE.Group>(null);
  const subjectInner = useRef<THREE.Group>(null);
  const subject = useRef<{ raw: SubjectSize | null; scale: number; retryAt: number }>({
    raw: null,
    scale: 1,
    retryAt: 0,
  });
  const turntable = useRef(0);
  const stagingLive = useRef(staging);
  stagingLive.current = staging;

  // a new subject identity → measure again on the next frame (retried while
  // async content such as loaded models is still empty)
  useEffect(() => {
    subject.current.raw = null;
    subject.current.retryAt = 0;
  }, [fitKey]);

  const measureSubject = (time: number) => {
    const s = subject.current;
    const inner = subjectInner.current;
    if (!inner || time < s.retryAt) return;
    s.retryAt = time + MEASURE_RETRY_S;
    inner.position.set(0, 0, 0);
    const box = measureLocalBounds(inner);
    if (!box) return;
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    // center on x/z, rest on the floor
    inner.position.set(-c.x, -box.min.y, -c.z);
    s.raw = { w: sz.x, h: sz.y, d: sz.z };
    s.scale = 1;
  };

  const fitRef = useRef<FrustumFit | null>(null);

  useFrame(
    (state, delta) => {
      const dt = frameDelta(delta);
      const par = live.current;
      const aspect = size.width / Math.max(1, size.height);

      // 1. frustum fit from live viewport + params
      const fit = fitFrustum(par, aspect);
      fitRef.current = fit;

      // 2. damp room dimensions toward targets
      const d = dims.current;
      d.width = damp(d.width, fit.width, DAMP, dt);
      d.height = damp(d.height, par.height, DAMP, dt);
      d.depth = damp(d.depth, par.depth, DAMP, dt);
      d.totalDepth = damp(d.totalDepth, par.depth + par.rearInset, DAMP, dt);
      d.radius = damp(d.radius, targetRadius(par.radius, d), DAMP, dt);
      d.wallThickness = damp(d.wallThickness, clamp(par.wallThickness, 0.02, 1.5), DAMP, dt);

      // 3. rewrite geometry only when something actually moved
      const a = applied.current;
      const moved =
        Math.abs(a.w - d.width) +
        Math.abs(a.h - d.height) +
        Math.abs(a.td - d.totalDepth) +
        Math.abs(a.r - d.radius) +
        Math.abs(a.t - d.wallThickness);
      if (moved > 0.0012) {
        geometry.update(d);
        a.w = d.width;
        a.h = d.height;
        a.td = d.totalDepth;
        a.r = d.radius;
        a.t = d.wallThickness;
        // 4. publish bounds — identical to the visible interior
        bounds.set({
          left: -d.width / 2,
          right: d.width / 2,
          floor: 0,
          ceiling: d.height,
          back: -d.totalDepth,
          front: 0,
          radius: d.radius,
        });
      }

      // 5. restrained camera rig: level view, damped distance / fov and a tiny
      //    parallax that stays inside the safe margins
      if (driveCamera) {
        const c = cam.current;
        c.dist = damp(c.dist, fit.dist, DAMP, dt);
        c.fov = damp(c.fov, par.fov, DAMP, dt);
        const far = Math.max(60, c.dist + d.totalDepth + 20);
        if (Math.abs(camera.fov - c.fov) > 0.01 || Math.abs(camera.far - far) > 0.5 || camera.near !== 0.1) {
          camera.fov = c.fov;
          camera.near = 0.1;
          camera.far = far;
          camera.updateProjectionMatrix();
        }
        const comp = cameraComposition(par, d, fit);
        const px = par.parallax ? state.pointer.x * comp.ampX : 0;
        const py = par.parallax ? state.pointer.y * comp.ampY : 0;
        const cy = comp.centerY + py;
        camera.position.set(px, cy, c.dist);
        camera.lookAt(px, cy, c.dist - 1); // stays level
      }

      // 6. subject safe-area fitting (uniform scale only)
      const s = subject.current;
      if (!s.raw) measureSubject(performance.now() / 1000);
      const outer = subjectOuter.current;
      if (s.raw && outer) {
        const target = subjectScale(s.raw, par, d, fit);
        s.scale = damp(s.scale, target, DAMP, dt);
        const st = stagingLive.current;
        outer.scale.setScalar(s.scale);
        // the plinth lifts the fitted subject when staging shows it
        outer.position.set(0, st?.plinth ? st.plinthHeight : 0, -d.depth * SUBJECT_DEPTH);
        outer.rotation.y = turntable.current;
      }

      // 7. smooth color / roughness transitions on theme change
      const m = material.current;
      if (m) {
        const k = dampFactor(6, dt);
        m.roughness += (par.roughness - m.roughness) * k;
        m.bumpScale += (par.bumpScale - m.bumpScale) * k;
        m.color.lerp(_color.set(par.color), k);
      }
    },
    { phase: 'start' }
  );

  return (
    <SceneBoundsProvider channel={bounds}>
      <group name="adaptive-room">
        {/* safety fill so the scene is never pure black if the rig is off or fails */}
        <ambientLight intensity={0.15} color="#ffffff" />
        <mesh geometry={geometry} receiveShadow name="adaptive-room-shell">
          <meshStandardMaterial
            ref={material}
            color={params.color}
            roughness={params.roughness}
            metalness={0.02}
            bumpMap={plaster.maps.bumpMap}
            bumpScale={params.bumpScale}
            roughnessMap={plaster.maps.roughnessMap}
            side={THREE.DoubleSide}
          />
        </mesh>
        <group ref={subjectOuter} name="adaptive-room-subject">
          <group ref={subjectInner}>{children}</group>
        </group>
        {free}
        {light && (
          <LightingRig
            light={light}
            dimsRef={dims}
            theme={theme}
            activeChannel={activeLightChannel}
            onSelectChannel={onSelectLightChannel}
          />
        )}
        {staging && <StagingRig staging={staging} theme={theme} turntableRef={turntable} />}
      </group>
    </SceneBoundsProvider>
  );
}
