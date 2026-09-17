import type { SceneDefinition } from './scene-definition';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScene = SceneDefinition<any, any>;

/** Registry of available scene definitions, for pickers and hosts. */
export class SceneRegistry {
  private scenes = new Map<string, AnyScene>();

  register(scene: AnyScene): () => void {
    if (this.scenes.has(scene.id)) throw new Error(`Scene "${scene.id}" is already registered`);
    this.scenes.set(scene.id, scene);
    return () => {
      if (this.scenes.get(scene.id) === scene) this.scenes.delete(scene.id);
    };
  }

  get(id: string): AnyScene | undefined {
    return this.scenes.get(id);
  }

  list(): AnyScene[] {
    return [...this.scenes.values()];
  }
}
