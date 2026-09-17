import type { ParamSchema } from './param-schema';

/** A named, described choice within a scene (a theme, a space, a content piece …). */
export interface SceneOption {
  id: string;
  label: string;
  description?: string;
}

export interface ScenePresetCollection<P> {
  id: string;
  label: string;
  description: string;
  presets: P[];
}

/** Post-processing a scene asks its host for when it does not render itself. */
export interface ScenePostFXRequest {
  type: string;
  minTier?: 'low' | 'balanced' | 'high' | 'ultra';
  fallback?: string;
  params?: Record<string, number | boolean>;
}

export interface SceneCapabilities {
  /** Publishes live `SceneBounds`. */
  bounds?: boolean;
  /** Children are measured and fitted into a safe area. */
  subjectFit?: boolean;
  ownsCamera?: boolean;
  ownsLights?: boolean;
  postfx?: ScenePostFXRequest[];
  requires?: ('webgpu' | 'shadows' | 'mrt-velocity')[];
}

/**
 * Declarative description of a preset scene. Hosts (standalone apps, the
 * ARTINOS adapter, generated UIs) only depend on this shape.
 *
 * `S` is the scene's complete editable state; `P` its preset type.
 */
export interface SceneDefinition<S extends object, P extends { id: string; label: string }> {
  id: string;
  label: string;
  description: string;
  version: string;
  defaults: S;
  /** Schemas for each editable state section, keyed by section name. */
  sections: { [K in keyof S]?: S[K] extends object ? ParamSchema<S[K]> : never };
  /** Discrete choices, keyed by the state field they select (e.g. `themeId`). */
  choices: Record<string, readonly SceneOption[]>;
  collections: readonly ScenePresetCollection<P>[];
  capabilities: SceneCapabilities;
}

export function defineScene<S extends object, P extends { id: string; label: string }>(
  definition: SceneDefinition<S, P>
): SceneDefinition<S, P> {
  return definition;
}

/** Every preset of a definition, in collection order. */
export function allPresets<P extends { id: string; label: string }>(
  definition: Pick<SceneDefinition<object, P>, 'collections'>
): P[] {
  return definition.collections.flatMap((c) => c.presets);
}
