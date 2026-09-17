import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import type { SceneBounds } from '../../../core/bounds';
import { useBoundsChannel } from '../../../react/bounds-context';
import type { Theme } from '../../model/themes';

/**
 * Space renderers — bounds-tracking architectural elements layered on the
 * adaptive chamber. The catalog (labels, overrides) lives in model/spaces.ts.
 */

/* ---- shared helpers ------------------------------------------------------- */

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Extruded rounded-rect ring (outer rounded rect with rounded hole). */
function makeFrameGeometry(
  outerW: number,
  outerH: number,
  holeW: number,
  holeH: number,
  depth: number
) {
  const outer = roundedRectShape(outerW, outerH, Math.min(outerW, outerH) * 0.16);
  const hole = roundedRectShape(holeW, holeH, Math.min(holeW, holeH) * 0.14);
  outer.holes.push(new THREE.Path(hole.getPoints(24).reverse()));
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.computeVertexNormals();
  return geo;
}

/** Rounded puck (soft-edged cylinder) via lathe. */
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

/** Frees geometries that are swapped by hand inside `useBoundsRebuild`. */
function useDisposeGeometries(refs: readonly { current: THREE.Mesh | null }[]) {
  useEffect(() => {
    const meshes = refs.map((r) => r.current);
    return () => meshes.forEach((m) => m?.geometry.dispose());
    // refs are stable for the component's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Watches bounds, calls rebuild when the room re-composes beyond eps. */
function useBoundsRebuild(rebuild: (b: SceneBounds) => void, eps = 0.05) {
  const bounds = useBoundsChannel();
  const last = useRef({ w: -1, h: -1, d: -1 });
  useFrame(() => {
    const b = bounds.current;
    const w = b.right - b.left;
    const h = b.ceiling - b.floor;
    const d = b.front - b.back;
    const l = last.current;
    if (
      Math.abs(l.w - w) > eps ||
      Math.abs(l.h - h) > eps ||
      Math.abs(l.d - d) > eps
    ) {
      l.w = w;
      l.h = h;
      l.d = d;
      rebuild(b);
    }
  });
}

/* ---- Gallery Niche --------------------------------------------------------- */
/** Recessed exhibition bay: rounded surround on the rear wall, shadowed inner
 *  panel for perceived depth, and a plinth ledge. Aperture tracks the room. */
function NicheSpace({ theme }: { theme: Theme }) {
  const frame = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const plinth = useRef<THREE.Mesh>(null);
  useDisposeGeometries([frame, plinth]);

  useBoundsRebuild((b) => {
    const w = b.right - b.left;
    const h = b.ceiling - b.floor;
    const aw = clampN(w * 0.42, 1.7, 3.6);
    const ah = clampN(h * 0.52, 2.1, 3.4);
    const cy = b.floor + ah / 2 + h * 0.14;
    const z = b.back + 0.02;

    if (frame.current) {
      frame.current.geometry.dispose();
      frame.current.geometry = makeFrameGeometry(aw + 0.55, ah + 0.55, aw, ah, 0.4);
      frame.current.position.set(0, cy, z);
    }
    if (inner.current) {
      inner.current.scale.set(aw, ah, 1);
      inner.current.position.set(0, cy, z + 0.015);
    }
    if (plinth.current) {
      const R = clampN(aw * 0.3, 0.5, 0.85);
      plinth.current.geometry.dispose();
      plinth.current.geometry = makePuck(R, 0.42, 0.06);
      plinth.current.position.set(0, b.floor, z + 0.55);
    }
  });

  return (
    <group>
      <mesh ref={frame} castShadow receiveShadow>
        <meshStandardMaterial color={theme.room} roughness={theme.roughness} metalness={0.02} />
      </mesh>
      <mesh ref={inner} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={new THREE.Color(theme.room).multiplyScalar(0.62)}
          roughness={1}
        />
      </mesh>
      <mesh ref={plinth} castShadow receiveShadow>
        <meshStandardMaterial color={theme.room} roughness={theme.roughness} metalness={0.02} />
      </mesh>
    </group>
  );
}

/* ---- Lightbox Room ---------------------------------------------------------- */
/** Luminous diffuse panels on both side walls and the ceiling. Panel sizes
 *  re-balance with the room; SSGI carries their bounce into the space. */
function LightboxSpace({ theme }: { theme: Theme }) {
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const top = useRef<THREE.Mesh>(null);
  const lightL = useRef<THREE.PointLight>(null);
  const lightR = useRef<THREE.PointLight>(null);

  useBoundsRebuild((b) => {
    const w = b.right - b.left;
    const h = b.ceiling - b.floor;
    const d = b.front - b.back;
    const cz = (b.back + b.front) / 2;
    const panelD = clampN(d * 0.55, 2, 6);
    const panelH = clampN(h * 0.52, 1.8, 3.4);
    if (left.current) {
      left.current.scale.set(panelD, panelH, 1);
      left.current.position.set(b.left + 0.05, h * 0.52, cz);
      left.current.rotation.y = Math.PI / 2;
    }
    if (right.current) {
      right.current.scale.set(panelD, panelH, 1);
      right.current.position.set(b.right - 0.05, h * 0.52, cz);
      right.current.rotation.y = -Math.PI / 2;
    }
    if (top.current) {
      top.current.scale.set(clampN(w * 0.55, 2, 9), clampN(d * 0.5, 2, 5.5), 1);
      top.current.position.set(0, b.ceiling - 0.05, cz);
      top.current.rotation.x = Math.PI / 2;
    }
    lightL.current?.position.set(b.left + 0.7, h * 0.55, cz);
    lightR.current?.position.set(b.right - 0.7, h * 0.55, cz);
  });

  const glow = new THREE.Color(theme.key).lerp(new THREE.Color('#ffffff'), 0.55);

  return (
    <group>
      {[left, right, top].map((r, i) => (
        <mesh key={i} ref={r}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#0c0c0c"
            emissive={glow}
            emissiveIntensity={i === 2 ? 2.4 : 1.7}
            roughness={1}
          />
        </mesh>
      ))}
      <pointLight ref={lightL} color={glow} intensity={9} decay={1.6} />
      <pointLight ref={lightR} color={glow} intensity={9} decay={1.6} />
    </group>
  );
}

/* ---- Interior Slice ---------------------------------------------------------- */
/** Editorial interior vignette: a tall warm window band on the left wall and
 *  a long low bench ledge on the right — both re-proportion with the room. */
function SliceSpace({ theme }: { theme: Theme }) {
  const window_ = useRef<THREE.Mesh>(null);
  const mullion = useRef<THREE.Mesh>(null);
  const bench = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.SpotLight>(null);

  useBoundsRebuild((b) => {
    const h = b.ceiling - b.floor;
    const d = b.front - b.back;
    const cz = (b.back + b.front) / 2 - d * 0.08;
    const winH = clampN(h * 0.62, 2.2, 4);
    const winD = clampN(d * 0.42, 1.6, 4);
    if (window_.current) {
      window_.current.scale.set(winD, winH, 1);
      window_.current.position.set(b.left + 0.04, b.floor + winH / 2 + h * 0.16, cz);
      window_.current.rotation.y = Math.PI / 2;
    }
    if (mullion.current) {
      mullion.current.scale.set(0.05, winH, 0.09);
      mullion.current.position.set(b.left + 0.06, b.floor + winH / 2 + h * 0.16, cz);
    }
    if (bench.current) {
      const benchL = clampN(d * 0.5, 1.8, 4.5);
      bench.current.scale.set(0.55, 0.4, benchL);
      bench.current.position.set(b.right - 0.55, b.floor + 0.2, cz);
    }
    if (sun.current) {
      sun.current.position.set(b.left + 0.4, b.ceiling * 0.72, cz);
      sun.current.target.position.set(b.right * 0.5, b.floor, cz + 0.6);
      sun.current.target.updateMatrixWorld();
    }
  });

  const warm = new THREE.Color(theme.key).lerp(new THREE.Color('#fff3dc'), 0.5);

  return (
    <group>
      <mesh ref={window_}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#111" emissive={warm} emissiveIntensity={3.2} roughness={1} />
      </mesh>
      <mesh ref={mullion} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3c3733" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh ref={bench} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={new THREE.Color(theme.room).multiplyScalar(0.82)}
          roughness={0.7}
        />
      </mesh>
      <spotLight
        ref={sun}
        color={warm}
        intensity={160}
        angle={0.85}
        penumbra={1}
        decay={1.7}
        castShadow
      />
    </group>
  );
}

/* ---- Runway Corridor ---------------------------------------------------------- */
/** Deep procession corridor: ceiling light strips repeat along the depth,
 *  their count adapting to the corridor length. */
const STRIP_MAX = 12;
function RunwaySpace({ theme }: { theme: Theme }) {
  const strips = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useBoundsRebuild((b) => {
    const m = strips.current;
    if (!m) return;
    const w = b.right - b.left;
    const d = b.front - b.back;
    const count = clampN(Math.round(d / 1.35), 4, STRIP_MAX);
    const stripW = clampN(w * 0.42, 1.4, 5);
    for (let i = 0; i < STRIP_MAX; i++) {
      if (i < count) {
        const z = b.back + ((i + 0.5) / count) * (d - 0.8) + 0.2;
        dummy.position.set(0, b.ceiling - 0.035, z);
        dummy.scale.set(stripW, 0.05, 0.16);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.0001);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  const glow = new THREE.Color(theme.key).lerp(new THREE.Color('#ffffff'), 0.4);

  return (
    <instancedMesh ref={strips} args={[undefined, undefined, STRIP_MAX]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#0a0a0a" emissive={glow} emissiveIntensity={3} roughness={1} />
    </instancedMesh>
  );
}

/* ---- Monolith Frame ---------------------------------------------------------- */
/** A sculptural portal standing mid-room. Its aperture re-proportions with
 *  the viewport so the subject stays optically framed at every aspect. */
function MonolithSpace({ theme }: { theme: Theme }) {
  const frame = useRef<THREE.Mesh>(null);
  useDisposeGeometries([frame]);

  useBoundsRebuild((b) => {
    const f = frame.current;
    if (!f) return;
    const w = b.right - b.left;
    const h = b.ceiling - b.floor;
    const d = b.front - b.back;
    const aw = clampN(w * 0.36, 1.7, 4.2);
    const ah = clampN(h * 0.56, 2.2, 3.8);
    const t = clampN(h * 0.075, 0.24, 0.42);
    f.geometry.dispose();
    f.geometry = makeFrameGeometry(aw + t * 2, ah + t * 2, aw, ah, 0.42);
    f.position.set(0, b.floor + ah / 2 + t, b.back + d * 0.42);
  });

  return (
    <mesh ref={frame} castShadow receiveShadow>
      <meshStandardMaterial
        color={new THREE.Color(theme.room).multiplyScalar(0.55)}
        roughness={Math.min(1, theme.roughness * 0.85)}
        metalness={0.06}
      />
    </mesh>
  );
}

/* ---- Tier Deck ---------------------------------------------------------------- */
/** Three concentric soft-edged terraces at the rear — a sculptural retail
 *  display deck whose radius conforms to the adaptive chamber. */
function TierSpace({ theme }: { theme: Theme }) {
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  useDisposeGeometries(refs);

  useBoundsRebuild((b) => {
    const w = b.right - b.left;
    const d = b.front - b.back;
    const R = clampN(Math.min(w * 0.3, d * 0.42), 1.2, 2.8);
    const cz = b.back + d * 0.42;
    const steps = [
      { r: R, h: 0.16 },
      { r: R * 0.68, h: 0.34 },
      { r: R * 0.4, h: 0.52 },
    ];
    steps.forEach((s, i) => {
      const m = refs[i].current;
      if (!m) return;
      m.geometry.dispose();
      m.geometry = makePuck(s.r, s.h, Math.min(0.055, s.h * 0.3));
      m.position.set(0, b.floor, cz);
    });
  });

  return (
    <group>
      {refs.map((r, i) => (
        <mesh key={i} ref={r} castShadow receiveShadow>
          <meshStandardMaterial
            color={new THREE.Color(theme.room).multiplyScalar(1 - i * 0.07)}
            roughness={theme.roughness}
            metalness={0.02}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ---- Atmos Volume ---------------------------------------------------------------- */
/** Space defined by haze rather than walls: exponential fog keyed to the
 *  backdrop, a floor glow field and a wide volumetric-feeling downlight. */
function AtmosSpace({ theme }: { theme: Theme }) {
  const scene = useThree((s) => s.scene);
  const glowDisc = useRef<THREE.Mesh>(null);
  const cone = useRef<THREE.SpotLight>(null);
  const fogColor = useMemo(() => new THREE.Color(theme.background), [theme.background]);

  useEffect(() => {
    const fog = new THREE.FogExp2(fogColor.clone(), 0.048);
    const previous = scene.fog;
    scene.fog = fog;
    return () => {
      if (scene.fog === fog) scene.fog = previous;
    };
  }, [scene, fogColor]);

  useFrame((_, delta) => {
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.lerp(fogColor, 1 - Math.exp(-5 * Math.min(delta, 0.05)));
    }
  });

  useBoundsRebuild((b) => {
    const w = b.right - b.left;
    const d = b.front - b.back;
    const cz = b.back + d * 0.45;
    if (glowDisc.current) {
      const R = clampN(Math.min(w, d) * 0.34, 1.2, 3.2);
      glowDisc.current.scale.set(R, R, 1);
      glowDisc.current.position.set(0, b.floor + 0.012, cz);
    }
    if (cone.current) {
      cone.current.position.set(0, b.ceiling - 0.2, cz);
      cone.current.target.position.set(0, b.floor, cz);
      cone.current.target.updateMatrixWorld();
    }
  });

  const glow = new THREE.Color(theme.key);

  return (
    <group>
      <mesh ref={glowDisc} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial
          color="#000"
          emissive={glow}
          emissiveIntensity={0.55}
          roughness={1}
          transparent
          opacity={0.85}
        />
      </mesh>
      <spotLight
        ref={cone}
        color={glow}
        intensity={120}
        angle={0.62}
        penumbra={1}
        decay={1.8}
        castShadow
      />
    </group>
  );
}

/* ---- Open Pavilion ---------------------------------------------------------------- */
/** Semi-open airy shell: a large ceiling skylight aperture pouring soft sky
 *  light, plus faint distance haze — indoor/outdoor hybrid serenity. */
function PavilionSpace({ theme }: { theme: Theme }) {
  const scene = useThree((s) => s.scene);
  const sky = useRef<THREE.Mesh>(null);
  const shaft = useRef<THREE.SpotLight>(null);
  const fogColor = useMemo(() => new THREE.Color(theme.background), [theme.background]);

  useEffect(() => {
    const fog = new THREE.FogExp2(fogColor.clone(), 0.02);
    const previous = scene.fog;
    scene.fog = fog;
    return () => {
      if (scene.fog === fog) scene.fog = previous;
    };
  }, [scene, fogColor]);

  useBoundsRebuild((b) => {
    const w = b.right - b.left;
    const d = b.front - b.back;
    const cz = b.back + d * 0.48;
    if (sky.current) {
      sky.current.scale.set(clampN(w * 0.42, 1.6, 6), clampN(d * 0.4, 1.6, 4.5), 1);
      sky.current.position.set(0, b.ceiling - 0.04, cz);
      sky.current.rotation.x = Math.PI / 2;
    }
    if (shaft.current) {
      shaft.current.position.set(0, b.ceiling + 1.2, cz);
      shaft.current.target.position.set(0, b.floor, cz + d * 0.1);
      shaft.current.target.updateMatrixWorld();
    }
  });

  const skyCol = new THREE.Color(theme.hemiSky).lerp(new THREE.Color('#dfeeff'), 0.5);

  return (
    <group>
      <mesh ref={sky}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#0a0c10"
          emissive={skyCol}
          emissiveIntensity={2.6}
          roughness={1}
        />
      </mesh>
      <spotLight
        ref={shaft}
        color={skyCol}
        intensity={220}
        angle={0.75}
        penumbra={0.9}
        decay={1.6}
        castShadow
      />
    </group>
  );
}

/* ---- renderers ------------------------------------------------------------------- */

/** Space id → extras component. `cyclo` is the bare chamber and has none. */
export const SPACE_RENDERERS: Record<string, ComponentType<{ theme: Theme }>> = {
  niche: NicheSpace,
  lightbox: LightboxSpace,
  slice: SliceSpace,
  runway: RunwaySpace,
  monolith: MonolithSpace,
  tiers: TierSpace,
  atmos: AtmosSpace,
  pavilion: PavilionSpace,
};
