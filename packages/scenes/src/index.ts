/**
 * @artinos/scenes — preset, fully configured, ready-to-use 3D scenes for
 * React Three Fiber + three/webgpu. Framework-independent: nothing here
 * imports ARTINOS. The ARTINOS integration lives in `@artinos/scenes/artinos`.
 */
import { SceneRegistry } from './core/registry';
import { adaptiveRoom } from './adaptive-room/definition';

export * from './core';
export * from './react';
export * from './adaptive-room';

/** Every scene this package ships. */
export const scenes = new SceneRegistry();
scenes.register(adaptiveRoom);
