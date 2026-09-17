import * as THREE from 'three/webgpu';

/**
 * Tiny tileable value-noise canvas textures for the plaster shell:
 * a bump map (very fine mineral grain) and a roughness map (subtle sheen
 * variation). Deliberately low contrast — the material should read as one
 * continuous architectural plaster, not a "textured" surface.
 */

function makeValueNoise(size: number, octaves: number, seed: number): Float32Array {
  // tileable multi-octave value noise
  const data = new Float32Array(size * size);
  let rngState = seed;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0xffffffff;
  };

  for (let o = 0; o < octaves; o++) {
    const freq = 2 ** (o + 2); // 4, 8, 16, ...
    const amp = 0.6 ** o;
    const grid = new Float32Array(freq * freq);
    for (let i = 0; i < grid.length; i++) grid[i] = rng();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * freq;
        const gy = (y / size) * freq;
        const x0 = Math.floor(gx) % freq;
        const y0 = Math.floor(gy) % freq;
        const x1 = (x0 + 1) % freq;
        const y1 = (y0 + 1) % freq;
        const fx = smooth(gx - Math.floor(gx));
        const fy = smooth(gy - Math.floor(gy));
        const v =
          lerp(
            lerp(grid[y0 * freq + x0], grid[y0 * freq + x1], fx),
            lerp(grid[y1 * freq + x0], grid[y1 * freq + x1], fx),
            fy
          ) - 0.5;
        data[y * size + x] += v * amp;
      }
    }
  }
  return data;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function toTexture(
  values: Float32Array,
  size: number,
  base: number,
  span: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < values.length; i++) {
    const g = Math.max(0, Math.min(255, Math.round(base + values[i] * span)));
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export interface PlasterMaps {
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

let cached: PlasterMaps | null = null;
let users = 0;

function createPlasterMaps(): PlasterMaps {
  const size = 256;
  const grain = makeValueNoise(size, 5, 20240817);
  const clouds = makeValueNoise(size, 3, 90051312);
  return {
    // fine mineral grain, extremely subtle relief
    bumpMap: toTexture(grain, size, 128, 110),
    // slow, cloudy roughness drift (values stay high: matte plaster)
    roughnessMap: toTexture(clouds, size, 236, 34),
  };
}

/**
 * Shared plaster maps. Every `acquire` must be paired with the returned
 * `release`; the textures are disposed when the last user releases them.
 */
export function acquirePlasterMaps(): { maps: PlasterMaps; release: () => void } {
  cached ??= createPlasterMaps();
  users++;
  const maps = cached;
  let released = false;
  return {
    maps,
    release() {
      if (released) return;
      released = true;
      if (--users > 0 || cached !== maps) return;
      maps.bumpMap.dispose();
      maps.roughnessMap.dispose();
      cached = null;
    },
  };
}
