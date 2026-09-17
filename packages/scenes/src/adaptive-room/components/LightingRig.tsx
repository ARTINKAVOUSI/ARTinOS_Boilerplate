import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import type { RoomDims } from '../model/room-params';
import type { Theme } from '../model/themes';
import {
  channelColor,
  channelGain,
  type LightChannelId,
  type LightParams,
} from '../model/lighting';

/**
 * Multi-light studio rig (three.js WebGPU).
 *
 * Softboxes use SpotLights (reliable everywhere) sized like area panels.
 * RectAreaLight is optional — enabled only after LTC textures init cleanly.
 */

let rectAreaReady = false;
let rectAreaAttempted = false;

async function ensureRectArea(): Promise<boolean> {
  if (rectAreaReady) return true;
  if (rectAreaAttempted) return false;
  rectAreaAttempted = true;
  try {
    const mod = await import('three/addons/lights/RectAreaLightTexturesLib.js');
    // WebGPU shades rect-area lights only once the LTC tables are set on the node class.
    THREE.RectAreaLightNode.setLTC(mod.RectAreaLightTexturesLib.init());
    rectAreaReady = true;
    return true;
  } catch (e) {
    console.warn('RectAreaLight unavailable, using spot softboxes.', e);
    return false;
  }
}

const _keyCol = new THREE.Color();
const _fillCol = new THREE.Color();
const _rimCol = new THREE.Color();
const _topCol = new THREE.Color();
const _softCol = new THREE.Color();
const _softRCol = new THREE.Color();
const _accCol = new THREE.Color();
const _skyCol = new THREE.Color();
const _gndCol = new THREE.Color();
const _look = new THREE.Vector3();
const _white = new THREE.Color(0xffffff);
const _gelTmp = new THREE.Color();
const RING_MAX = 6;
const DEFAULT_RING_COLORS = [
  '#ff4d6d',
  '#ffd166',
  '#06d6a0',
  '#4cc9f0',
  '#b5179e',
  '#f72585',
];
const showHelpersLive = (par: LightParams) => !!par.showHelpers;

/** Apply gel saturation + wash toward white. */
function applyGel(out: THREE.Color, hex: string, sat: number, wash: number) {
  out.set(hex || '#ffffff');
  const s = Math.max(0, Math.min(2, sat));
  if (s !== 1) {
    const h = { h: 0, s: 0, l: 0 };
    out.getHSL(h);
    h.s = Math.max(0, Math.min(1, h.s * s));
    out.setHSL(h.h, h.s, h.l);
  }
  if (wash > 0.001) out.lerp(_white, Math.max(0, Math.min(1, wash)));
}

export function LightingRig({
  light,
  dimsRef,
  theme,
  onSelectChannel,
  activeChannel,
}: {
  light: LightParams;
  dimsRef: MutableRefObject<RoomDims>;
  theme?: Theme;
  onSelectChannel?: (id: LightChannelId) => void;
  activeChannel?: LightChannelId | null;
}) {
  const L = useRef(light);
  L.current = light;

  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.SpotLight>(null);
  const topRef = useRef<THREE.SpotLight>(null);
  const softLRef = useRef<THREE.Light>(null);
  const softRRef = useRef<THREE.Light>(null);
  const accentRef = useRef<THREE.PointLight>(null);
  const ringRef = useRef<THREE.PointLight[]>([]);
  const ringGroup = useRef<THREE.Group>(null);
  const ringPhase = useRef(0);

  const helpKey = useRef<THREE.Mesh>(null);
  const helpSoftL = useRef<THREE.Mesh>(null);
  const helpSoftR = useRef<THREE.Mesh>(null);
  const helpRim = useRef<THREE.Mesh>(null);
  const helpAccent = useRef<THREE.Mesh>(null);
  const helpRing = useRef<THREE.Mesh[]>([]);

  const select = (id: LightChannelId) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectChannel?.(id);
  };

  const useRect = useRef(false);
  const applied = useRef({ w: -1, h: -1, d: -1, az: -999, el: -999 });

  const themeCols = useMemo(
    () => ({
      sky: new THREE.Color(theme?.hemiSky ?? '#fdf6ea'),
      ground: new THREE.Color(theme?.hemiGround ?? '#b8b0a4'),
      keyFallback: new THREE.Color(theme?.key ?? '#fff5e8'),
      fillFallback: new THREE.Color(theme?.fill ?? '#e7ecf5'),
    }),
    [theme]
  );

  useEffect(() => {
    let alive = true;
    ensureRectArea().then((ok) => {
      if (alive) useRect.current = ok;
    });
    return () => {
      alive = false;
    };
  }, []);

  useFrame((_, delta) => {
    const dims = dimsRef.current;
    const par = L.current;
    const dt = Math.min(delta, 1 / 20);
    const k = 1 - Math.exp(-6 * dt);
    const M = Math.max(0, par.master);

    const hemi = hemiRef.current;
    const key = keyRef.current;
    const fill = fillRef.current;
    const rim = rimRef.current;
    const top = topRef.current;
    const softL = softLRef.current;
    const softR = softRRef.current;
    const accent = accentRef.current;
    if (!hemi || !key || !fill || !rim || !top) return;

    const g = (ch: LightChannelId) => channelGain(par, ch);
    const targetKey = par.keyIntensity * M * g('key');
    const targetFill = par.fillIntensity * M * g('fill');
    const targetRim = par.rimIntensity * M * g('rim');
    const targetTop = par.topIntensity * M * g('top');
    const targetSoft = par.softboxIntensity * M * g('softbox');
    const targetAcc = par.accentIntensity * M * g('accent');
    const targetAmb = par.ambient * M * g('ambient');

    key.intensity += (targetKey - key.intensity) * k;
    fill.intensity += (targetFill - fill.intensity) * k;
    rim.intensity += (targetRim - rim.intensity) * k;
    top.intensity += (targetTop - top.intensity) * k;
    hemi.intensity += (targetAmb - hemi.intensity) * k;
    if (softL) softL.intensity += (targetSoft - softL.intensity) * k;
    if (softR) softR.intensity += (targetSoft - softR.intensity) * k;
    if (accent) accent.intensity += (targetAcc - accent.intensity) * k;

    const sat = par.gelSaturation ?? 1;
    const wash = par.gelWash ?? 0;
    applyGel(_keyCol, channelColor(par, 'key') || '#fff5e8', sat, wash);
    applyGel(_fillCol, channelColor(par, 'fill') || '#e7ecf5', sat, wash);
    applyGel(_rimCol, par.rimColor || '#fff0e0', sat, wash);
    applyGel(_topCol, par.topColor || '#fff8f0', sat * 0.7, wash);
    applyGel(_softCol, par.softboxColor || '#ffffff', sat, wash);
    applyGel(
      _softRCol,
      par.softboxColorR || par.softboxColor || '#ffffff',
      sat,
      wash
    );
    applyGel(_accCol, par.accentColor || '#a8c4ff', sat, wash);
    // Neutral modes still pick up a little theme warmth
    if (par.mode === 'studio' || par.mode === 'gallery') {
      if (wash > 0.5) {
        _keyCol.lerp(themeCols.keyFallback, 0.25);
        _fillCol.lerp(themeCols.fillFallback, 0.25);
      }
    }
    _skyCol.copy(themeCols.sky);
    _gndCol.copy(themeCols.ground);

    key.color.lerp(_keyCol, k);
    fill.color.lerp(_fillCol, k);
    rim.color.lerp(_rimCol, k);
    top.color.lerp(_topCol, k);
    hemi.color.lerp(_skyCol, k);
    hemi.groundColor.lerp(_gndCol, k);
    if (softL) softL.color.lerp(_softCol, k);
    if (softR) softR.color.lerp(_softRCol, k);
    if (accent) accent.color.lerp(_accCol, k);

    const soft = Math.max(0, Math.min(1, (par.keySoftness + par.shadowSoftness) * 0.5));
    key.shadow.radius = 1 + soft * 12;
    key.shadow.bias = -0.00015 - soft * 0.0001;
    key.shadow.normalBias = 0.02 + soft * 0.02;

    rim.angle = 0.25 + par.rimSpread * 0.55;
    rim.penumbra = 0.4 + par.keySoftness * 0.5;

    const W = Math.max(0.5, dims.width);
    const H = Math.max(0.5, dims.height);
    const D = Math.max(0.5, dims.totalDepth);
    const cx = 0;
    const cy = H * 0.35;
    const cz = -D * 0.45;

    const kaz = (par.keyAzimuth * Math.PI) / 180;
    const kel = (par.keyElevation * Math.PI) / 180;
    const keyR = (Math.max(W, D) * 0.55 + 3.5) * Math.max(0.45, par.keyDistance || 1);
    key.position.set(
      cx + Math.sin(kaz) * Math.cos(kel) * keyR,
      cy + Math.sin(kel) * keyR + H * 0.15,
      cz + Math.cos(kaz) * Math.cos(kel) * keyR + D * 0.5
    );
    key.target.position.set(cx, cy * 0.6, cz);
    key.target.updateMatrixWorld();

    const faz = (par.fillAzimuth * Math.PI) / 180;
    const fel = ((par.fillElevation ?? 25) * Math.PI) / 180;
    const fillR = Math.max(W, D) * 0.45 + 2.5;
    fill.position.set(
      cx + Math.sin(faz) * Math.cos(fel) * fillR,
      cy + Math.sin(fel) * fillR + H * 0.1,
      cz + Math.cos(faz) * Math.cos(fel) * fillR + D * 0.35
    );
    fill.target.position.set(cx, H * 0.35, cz);
    fill.target.updateMatrixWorld();

    const raz = (par.rimAzimuth * Math.PI) / 180;
    const rimR = D * 0.55 + 1.5;
    rim.position.set(
      cx + Math.sin(raz) * rimR * 0.6,
      H * 0.85,
      cz - Math.abs(Math.cos(raz)) * rimR
    );
    rim.target.position.set(cx, H * 0.4, cz + 0.3);
    rim.target.updateMatrixWorld();
    rim.distance = Math.max(8, D + H + 6);

    top.position.set(0, H + 0.8, cz);
    top.target.position.set(0, 0, cz);
    top.target.updateMatrixWorld();
    top.distance = H * 3 + 4;
    top.angle = 0.7;
    top.penumbra = 0.85;

    // Softboxes — RectArea if available, else wide spots
    const sbZ = 0.6;
    const sbX = W * 0.55 + 0.8;
    const sbY = H * 0.55;
    _look.set(0, H * 0.4, cz);

    if (softL && softR) {
      if (useRect.current && softL instanceof THREE.RectAreaLight) {
        const panelH = H * 0.7 * par.softboxSize;
        const panelW = Math.max(1.2, D * 0.35) * par.softboxSize;
        softL.width = panelW;
        softL.height = panelH;
        (softR as THREE.RectAreaLight).width = panelW;
        (softR as THREE.RectAreaLight).height = panelH;
        softL.position.set(-sbX, sbY, sbZ);
        softR.position.set(sbX, sbY, sbZ);
        softL.lookAt(_look);
        softR.lookAt(_look);
      } else if (softL instanceof THREE.SpotLight && softR instanceof THREE.SpotLight) {
        softL.position.set(-sbX, sbY, sbZ);
        softR.position.set(sbX, sbY, sbZ);
        softL.target.position.copy(_look);
        softR.target.position.copy(_look);
        softL.target.updateMatrixWorld();
        softR.target.updateMatrixWorld();
        softL.angle = 0.55 + par.softboxSize * 0.15;
        softR.angle = softL.angle;
        softL.penumbra = 0.9;
        softR.penumbra = 0.9;
        softL.distance = Math.max(10, W + D + 6);
        softR.distance = softL.distance;
      }
    }

    if (accent) {
      accent.position.set(W * 0.35, 0.35, -D * 0.25);
      accent.distance = Math.max(6, W + 4);
      accent.decay = 1.6;
    }

    // ---- multi-color accent ring ----------------------------------------
    const ringOn = par.colorRing && par.colorRingIntensity > 0.01;
    const ringCount = Math.max(2, Math.min(RING_MAX, Math.round(par.colorRingCount || 4)));
    if (par.colorRingSpeed > 0.01) {
      ringPhase.current += (par.colorRingSpeed * Math.PI * 2 * dt) / 60;
    }
    const ringR = Math.min(W, D) * 0.5 * Math.max(0.15, par.colorRingRadius || 0.55);
    const ringY = H * Math.max(0.05, Math.min(0.95, par.colorRingHeight ?? 0.35));
    const ringI = ringOn ? par.colorRingIntensity * M * g('ring') : 0;
    const colors = par.colorRingColors?.length
      ? par.colorRingColors
      : DEFAULT_RING_COLORS;

    for (let i = 0; i < RING_MAX; i++) {
      const pl = ringRef.current[i];
      if (!pl) continue;
      const active = ringOn && i < ringCount;
      const targetI = active ? ringI : 0;
      pl.intensity += (targetI - pl.intensity) * k;
      if (!active && pl.intensity < 0.01) {
        pl.visible = false;
        if (helpRing.current[i]) helpRing.current[i].visible = false;
        continue;
      }
      pl.visible = true;
      const ang = ringPhase.current + (i / ringCount) * Math.PI * 2;
      pl.position.set(Math.cos(ang) * ringR, ringY, cz + Math.sin(ang) * ringR * 0.85);
      pl.distance = Math.max(5, ringR * 3 + 2);
      pl.decay = 1.7;
      applyGel(_gelTmp, colors[i % colors.length], sat, wash);
      pl.color.lerp(_gelTmp, k);

      const hm = helpRing.current[i];
      if (hm) {
        hm.visible = showHelpersLive(par) && active;
        if (hm.visible) {
          hm.position.copy(pl.position);
          hm.scale.setScalar(0.1);
          (hm.material as THREE.MeshBasicMaterial).color.copy(pl.color);
        }
      }
    }

    const a = applied.current;
    if (
      Math.abs(a.w - W) > 0.01 ||
      Math.abs(a.h - H) > 0.01 ||
      Math.abs(a.d - D) > 0.01 ||
      Math.abs(a.az - par.keyAzimuth) > 0.2 ||
      Math.abs(a.el - par.keyElevation) > 0.2
    ) {
      a.w = W;
      a.h = H;
      a.d = D;
      a.az = par.keyAzimuth;
      a.el = par.keyElevation;
      const cam = key.shadow.camera as THREE.OrthographicCamera;
      const span = Math.max(W, D) * 0.8 + 2.5;
      cam.left = -span;
      cam.right = span;
      cam.top = span;
      cam.bottom = -span;
      cam.near = 0.5;
      cam.far = keyR * 2.5 + H + D;
      cam.updateProjectionMatrix();
    }

    // helpers
    const show = par.showHelpers;
    const place = (
      mesh: THREE.Mesh | null,
      x: number,
      y: number,
      z: number,
      s: number,
      col: THREE.Color,
      channel?: LightChannelId
    ) => {
      if (!mesh) return;
      mesh.visible = show;
      if (!show) return;
      mesh.position.set(x, y, z);
      const boost = activeChannel && channel === activeChannel ? 1.35 : 1;
      mesh.scale.setScalar(s * boost);
      (mesh.material as THREE.MeshBasicMaterial).color.copy(col);
    };
    place(helpKey.current, key.position.x, key.position.y, key.position.z, 0.18, key.color, 'key');
    place(helpRim.current, rim.position.x, rim.position.y, rim.position.z, 0.12, rim.color, 'rim');
    place(
      helpAccent.current,
      accent?.position.x ?? 0,
      accent?.position.y ?? 0,
      accent?.position.z ?? 0,
      0.1,
      accent?.color ?? _accCol,
      'accent'
    );
    if (helpSoftL.current && softL) {
      helpSoftL.current.visible = show && par.softboxIntensity > 0.01;
      if (helpSoftL.current.visible) {
        helpSoftL.current.position.copy(softL.position);
        helpSoftL.current.lookAt(_look);
        const sc = 1.5 * par.softboxSize;
        helpSoftL.current.scale.set(sc * 0.6, sc, 1);
        (helpSoftL.current.material as THREE.MeshBasicMaterial).color.copy(softL.color);
      }
    }
    if (helpSoftR.current && softR) {
      helpSoftR.current.visible = show && par.softboxIntensity > 0.01;
      if (helpSoftR.current.visible) {
        helpSoftR.current.position.copy(softR.position);
        helpSoftR.current.lookAt(_look);
        const sc = 1.5 * par.softboxSize;
        helpSoftR.current.scale.set(sc * 0.6, sc, 1);
        (helpSoftR.current.material as THREE.MeshBasicMaterial).color.copy(softR.color);
      }
    }
  }, -0.5);

  return (
    <group>
      <hemisphereLight ref={hemiRef} args={['#fdf6ea', '#b8b0a4', 0.42]} />

      <directionalLight
        ref={keyRef}
        castShadow
        intensity={2.6}
        color="#fff5e8"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      />

      <directionalLight ref={fillRef} intensity={0.55} color="#e7ecf5" />

      <spotLight
        ref={rimRef}
        intensity={0}
        color="#fff0e0"
        angle={0.5}
        penumbra={0.7}
        distance={20}
        decay={1.5}
      />

      <spotLight
        ref={topRef}
        intensity={0}
        color="#fff8f0"
        angle={0.7}
        penumbra={0.85}
        distance={20}
        decay={1.4}
      />

      {/* Softboxes: wide spots (always work). RectArea swapped in if LTC loads. */}
      <spotLight
        ref={softLRef as React.RefObject<THREE.SpotLight>}
        intensity={0}
        color="#ffffff"
        angle={0.7}
        penumbra={0.9}
        distance={20}
        decay={1.4}
      />
      <spotLight
        ref={softRRef as React.RefObject<THREE.SpotLight>}
        intensity={0}
        color="#ffffff"
        angle={0.7}
        penumbra={0.9}
        distance={20}
        decay={1.4}
      />

      <pointLight ref={accentRef} intensity={0} color="#a8c4ff" distance={10} decay={1.6} />

      {/* Multi-color accent ring */}
      <group ref={ringGroup}>
        {Array.from({ length: RING_MAX }, (_, i) => (
          <group key={`ring-${i}`}>
            <pointLight
              ref={(el: THREE.PointLight | null) => {
                if (el) ringRef.current[i] = el;
              }}
              intensity={0}
              distance={8}
              decay={1.7}
              color="#ffffff"
            />
            <mesh
              ref={(el: THREE.Mesh | null) => {
                if (el) helpRing.current[i] = el;
              }}
              visible={false}
            >
              <sphereGeometry args={[1, 10, 8]} />
              <meshBasicMaterial color="#fff" depthTest={false} />
            </mesh>
          </group>
        ))}
      </group>

      <mesh
        ref={helpKey}
        visible={false}
        onClick={select('key')}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#fff" depthTest={false} />
      </mesh>
      <mesh
        ref={helpRim}
        visible={false}
        onClick={select('rim')}
      >
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#fff" depthTest={false} />
      </mesh>
      <mesh
        ref={helpAccent}
        visible={false}
        onClick={select('accent')}
      >
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#fff" depthTest={false} />
      </mesh>
      <mesh
        ref={helpSoftL}
        visible={false}
        onClick={select('softbox')}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#fff"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
      <mesh
        ref={helpSoftR}
        visible={false}
        onClick={select('softbox')}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#fff"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
