import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useBoundsChannel } from './bounds-context';

/**
 * Debug overlay: draws the live scene bounds as a live wireframe box so the
 * visual-room / simulation-domain contract can be inspected while resizing.
 */

// 12 edges of a unit box as corner-index pairs
const CORNERS: [number, number, number][] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export function BoundsHelper({ visible }: { visible: boolean }) {
  const bounds = useBoundsChannel();
  const ref = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(EDGES.length * 2 * 3), 3)
    );
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const line = ref.current;
    if (!line || !visible) return;
    const b = bounds.current;
    const attr = geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    let k = 0;
    for (const [a, c] of EDGES) {
      for (const idx of [a, c]) {
        const [ux, uy, uz] = CORNERS[idx];
        arr[k++] = ux ? b.right : b.left;
        arr[k++] = uy ? b.ceiling : b.floor;
        arr[k++] = uz ? b.front - 0.02 : b.back;
      }
    }
    attr.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return (
    <lineSegments ref={ref} geometry={geometry} visible={visible} frustumCulled={false}>
      <lineBasicMaterial color="#67d3f0" transparent opacity={0.55} depthTest={false} />
    </lineSegments>
  );
}
