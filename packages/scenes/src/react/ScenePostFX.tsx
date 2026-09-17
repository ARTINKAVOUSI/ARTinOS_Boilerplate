import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {
  pass,
  mrt,
  output,
  normalView,
  diffuseColor,
  velocity,
  add,
  vec4,
  packNormalToRGB,
  unpackRGBToNormal,
  sample,
} from 'three/tsl';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { useRenderer } from './r3f-compat';

export interface PostFXQuality {
  /** SSGI hemisphere slices (1-4) */
  slices: number;
  /** SSGI steps per slice side */
  steps: number;
}

export interface ScenePostFXProps {
  /** SSGI contribution (0 hides the GI composite; AO stays mild). */
  ssgiIntensity?: number;
  quality: PostFXQuality;
}

type Built = {
  pipeline: THREE.RenderPipeline;
  gi: ReturnType<typeof ssgi> | null;
  gtao: ReturnType<typeof ao> | null;
};

/**
 * Stand-alone progressive post pipeline:
 *   SSGI + TRAA (WebGPU) → GTAO + FXAA → FXAA → plain.
 *
 * It owns the frame through R3F's `render` phase, so mount it only when no
 * other render pipeline exists (inside ARTINOS the host pipeline renders and
 * the scene requests effects instead). Until a tier builds, it renders the
 * scene directly so the canvas is never blank.
 */
export function ScenePostFX({ ssgiIntensity = 1, quality }: ScenePostFXProps) {
  const renderer = useRenderer() as THREE.WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const live = useRef({ ssgiIntensity, quality });
  live.current = { ssgiIntensity, quality };
  const fx = useRef<Built | null>(null);

  useEffect(() => {
    let disposed = false;
    fx.current = null;
    if (!(renderer as { isWebGPURenderer?: boolean })?.isWebGPURenderer) return;

    const tryBuild = () => {
      if (disposed) return;
      const backend = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
      const tiers: Array<() => Built> = [];

      if (backend?.isWebGPUBackend === true) {
        tiers.push(() => {
          const pipeline = new THREE.RenderPipeline(renderer);
          const scenePass = pass(scene, camera);
          scenePass.setMRT(mrt({ output, diffuseColor, normal: packNormalToRGB(normalView), velocity }));
          const beauty = scenePass.getTextureNode('output');
          const diffuse = scenePass.getTextureNode('diffuseColor');
          const depth = scenePass.getTextureNode('depth');
          const normalTex = scenePass.getTextureNode('normal');
          const vel = scenePass.getTextureNode('velocity');
          try {
            scenePass.getTexture('diffuseColor').type = THREE.UnsignedByteType;
            scenePass.getTexture('normal').type = THREE.UnsignedByteType;
          } catch {
            /* optional precision reduction */
          }
          const sceneNormal = sample((uv) => unpackRGBToNormal(normalTex.sample(uv)));
          const gi = ssgi(beauty, depth, sceneNormal, camera);
          gi.sliceCount.value = 2;
          gi.stepCount.value = 8;
          gi.radius.value = 10;
          const composite = vec4(
            // AO is a single-channel attachment: use .r, not the vec4
            add(beauty.rgb.mul(gi.getAONode().r), diffuse.rgb.mul(gi.getGINode().rgb)),
            beauty.a
          );
          pipeline.outputNode = traa(composite, depth, vel, camera);
          return { pipeline, gi, gtao: null };
        });
      }

      tiers.push(() => {
        const pipeline = new THREE.RenderPipeline(renderer);
        const scenePass = pass(scene, camera);
        scenePass.setMRT(mrt({ output, normal: packNormalToRGB(normalView) }));
        const beauty = scenePass.getTextureNode('output');
        const depth = scenePass.getTextureNode('depth');
        const normalTex = scenePass.getTextureNode('normal');
        const sceneNormal = sample((uv) => unpackRGBToNormal(normalTex.sample(uv)));
        const gtao = ao(depth, sceneNormal, camera);
        gtao.radius.value = 1.2;
        pipeline.outputNode = fxaa(vec4(beauty.rgb.mul(gtao.getTextureNode().r), beauty.a));
        return { pipeline, gi: null, gtao };
      });

      tiers.push(() => {
        const pipeline = new THREE.RenderPipeline(renderer);
        pipeline.outputNode = fxaa(pass(scene, camera).getTextureNode('output'));
        return { pipeline, gi: null, gtao: null };
      });

      tiers.push(() => {
        const pipeline = new THREE.RenderPipeline(renderer);
        pipeline.outputNode = pass(scene, camera).getTextureNode('output');
        return { pipeline, gi: null, gtao: null };
      });

      for (const tier of tiers) {
        try {
          const built = tier();
          if (disposed) {
            built.pipeline.dispose();
            return;
          }
          fx.current = built;
          return;
        } catch (e) {
          console.warn('[scenes] post tier failed, trying next…', e);
        }
      }
      console.warn('[scenes] post-processing unavailable — rendering directly.');
    };

    // wait two frames so the WebGPU backend finishes configuring
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(tryBuild);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      try {
        fx.current?.pipeline.dispose();
      } catch {
        /* already gone */
      }
      fx.current = null;
    };
  }, [renderer, scene, camera]);

  useFrame(
    (state) => {
      const f = fx.current;
      if (!f) {
        renderer?.render(state.scene, state.camera);
        return;
      }
      try {
        const { ssgiIntensity: s0, quality: q } = live.current;
        const s = Math.max(0, s0);
        if (f.gi) {
          f.gi.giIntensity.value = 9 * s;
          f.gi.aoIntensity.value = Math.min(1.4, 0.85 * s + 0.15);
          f.gi.sliceCount.value = q.slices;
          f.gi.stepCount.value = q.steps;
        }
        if (f.gtao) f.gtao.scale.value = Math.min(1.5, Math.max(0.1, s));
        f.pipeline.render();
      } catch (e) {
        console.warn('[scenes] post render error — direct fallback.', e);
        try {
          f.pipeline.dispose();
        } catch {
          /* ignore */
        }
        fx.current = null;
        try {
          renderer?.render(state.scene, state.camera);
        } catch (e2) {
          console.error(e2);
        }
      }
    },
    { phase: 'render' }
  );

  return null;
}
