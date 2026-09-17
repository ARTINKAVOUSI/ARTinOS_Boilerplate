import * as THREE from 'three/webgpu';

const _inverse = new THREE.Matrix4();
const _matrix = new THREE.Matrix4();
const _box = new THREE.Box3();

/**
 * Bounds of `root`'s visible geometry expressed in `root`'s local space, so
 * ancestor transforms (the fitting scale, host groups) never skew the result.
 * Returns null when there is nothing measurable yet (e.g. a model still loading).
 */
export function measureLocalBounds(root: THREE.Object3D): THREE.Box3 | null {
  root.updateWorldMatrix(true, true);
  _inverse.copy(root.matrixWorld).invert();
  const result = new THREE.Box3();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.geometry || !mesh.visible) return;
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return;
    _matrix.multiplyMatrices(_inverse, mesh.matrixWorld);
    result.union(_box.copy(geometry.boundingBox).applyMatrix4(_matrix));
  });
  return result.isEmpty() ? null : result;
}
