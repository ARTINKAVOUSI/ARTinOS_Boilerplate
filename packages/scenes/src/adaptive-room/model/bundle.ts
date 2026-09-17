import type { Preset } from './presets';
import type { Theme } from './themes';

/**
 * Shareable setup file. The shape is compatible with files exported by the
 * original stand-alone Adaptive Room app.
 */
export interface AdaptiveRoomBundle {
  app: 'adaptive-room';
  version: 1;
  customThemes: Theme[];
  userPresets: Preset[];
}

export function isTheme(t: unknown): t is Theme {
  const o = t as Theme;
  return (
    !!o &&
    typeof o.id === 'string' &&
    typeof o.label === 'string' &&
    typeof o.room === 'string' &&
    typeof o.background === 'string' &&
    Array.isArray(o.palette)
  );
}

export function isPreset(p: unknown): p is Preset {
  const o = p as Preset;
  return (
    !!o &&
    typeof o.id === 'string' &&
    typeof o.label === 'string' &&
    typeof o.envId === 'string' &&
    typeof o.themeId === 'string'
  );
}

export const createBundle = (customThemes: Theme[], userPresets: Preset[]): AdaptiveRoomBundle => ({
  app: 'adaptive-room',
  version: 1,
  customThemes,
  userPresets,
});

export function parseBundle(text: string): { customThemes: Theme[]; userPresets: Preset[] } | null {
  try {
    const b = JSON.parse(text);
    if (b?.app !== 'adaptive-room') return null;
    return {
      customThemes: Array.isArray(b.customThemes) ? b.customThemes.filter(isTheme) : [],
      userPresets: Array.isArray(b.userPresets) ? b.userPresets.filter(isPreset) : [],
    };
  } catch {
    return null;
  }
}

/** Append items whose id is not present yet (import never overwrites). */
export function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const ids = new Set(current.map((x) => x.id));
  return [...current, ...incoming.filter((x) => !ids.has(x.id))];
}
