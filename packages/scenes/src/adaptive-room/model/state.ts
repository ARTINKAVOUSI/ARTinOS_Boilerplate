import { coerceState } from '../../core/param-schema';
import { getContent, CONTENTS } from './contents';
import {
  DEFAULT_LIGHT,
  DEFAULT_STAGING,
  LIGHT_CHANNELS,
  type LightChannelId,
  type LightParams,
  type StagingParams,
} from './lighting';
import type { Preset } from './presets';
import { QUALITIES } from './quality';
import { DEFAULT_ROOM, DEFAULT_SIM, type RoomParams, type SimOpts } from './room-params';
import { LIGHT_SCHEMA, ROOM_SCHEMA, SIM_SCHEMA, STAGING_SCHEMA } from './schema';
import { getSpace, SPACES } from './spaces';
import { THEMES, type Theme } from './themes';

/** The complete editable recipe of an adaptive room. */
export interface AdaptiveRoomState {
  contentId: string;
  themeId: string;
  spaceId: string;
  qualityId: string;
  room: RoomParams;
  sim: SimOpts;
  light: LightParams;
  staging: StagingParams;
}

export const RING_SLOTS = 6;

export const findTheme = (themes: readonly Theme[], id: string) =>
  themes.find((t) => t.id === id) ?? THEMES[0];

/** Room fields a theme controls. */
export const themeRoomPatch = (t: Theme): Partial<RoomParams> => ({
  color: t.room,
  roughness: t.roughness,
  lightIntensity: t.lightIntensity,
});

export function createDefaultState(themes: readonly Theme[] = THEMES): AdaptiveRoomState {
  const theme = findTheme(themes, 'studio');
  return {
    contentId: 'sculpture',
    themeId: theme.id,
    spaceId: 'cyclo',
    qualityId: 'balanced',
    room: { ...DEFAULT_ROOM, ...themeRoomPatch(theme) },
    sim: { ...DEFAULT_SIM },
    light: { ...DEFAULT_LIGHT, colorRingColors: [...DEFAULT_LIGHT.colorRingColors], mute: {} },
    staging: { ...DEFAULT_STAGING },
  };
}

/** Pad / trim ring colors to exactly `RING_SLOTS` valid entries. */
export function normalizeRingColors(colors: unknown): string[] {
  const src = Array.isArray(colors) ? colors : [];
  const out: string[] = [];
  for (let i = 0; i < RING_SLOTS; i++) {
    const c = src[i];
    out.push(typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : DEFAULT_LIGHT.colorRingColors[i] ?? '#ffffff');
  }
  return out;
}

const CHANNEL_IDS = new Set<string>(LIGHT_CHANNELS.map((c) => c.id));

function normalizeLight(raw: unknown): LightParams {
  const light = coerceState(LIGHT_SCHEMA, DEFAULT_LIGHT, raw);
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<LightParams>;
  const mute: LightParams['mute'] = {};
  if (input.mute && typeof input.mute === 'object') {
    for (const [id, muted] of Object.entries(input.mute)) {
      if (CHANNEL_IDS.has(id) && muted === true) mute[id as LightChannelId] = true;
    }
  }
  return {
    ...light,
    colorRingColors: normalizeRingColors(input.colorRingColors),
    mute,
    solo: typeof input.solo === 'string' && CHANNEL_IDS.has(input.solo) ? input.solo : null,
  };
}

/** Validate an untrusted (persisted / imported) state. Unknown ids fall back. */
export function coerceRoomState(raw: unknown, themes: readonly Theme[] = THEMES): AdaptiveRoomState {
  const base = createDefaultState(themes);
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Record<string, unknown>;
  // the original stand-alone app stored `envId` and `params`
  const s: Partial<Record<keyof AdaptiveRoomState, unknown>> = {
    ...input,
    contentId: input.contentId ?? input.envId,
    room: input.room ?? input.params,
  };
  const pick = (value: unknown, valid: (id: string) => boolean, fallback: string) =>
    typeof value === 'string' && valid(value) ? value : fallback;
  return {
    contentId: pick(s.contentId, (id) => CONTENTS.some((c) => c.id === id), base.contentId),
    themeId: pick(s.themeId, (id) => themes.some((t) => t.id === id), base.themeId),
    spaceId: pick(s.spaceId, (id) => SPACES.some((x) => x.id === id), base.spaceId),
    qualityId: pick(s.qualityId, (id) => QUALITIES.some((q) => q.id === id), base.qualityId),
    room: coerceState(ROOM_SCHEMA, DEFAULT_ROOM, s.room),
    sim: coerceState(SIM_SCHEMA, DEFAULT_SIM, s.sim),
    light: normalizeLight(s.light),
    staging: coerceState(STAGING_SCHEMA, DEFAULT_STAGING, s.staging),
  };
}

/**
 * Resolve a preset into a full state:
 * `defaults ← theme ← space overrides ← preset.params`.
 * Presets without an explicit light block derive the rig master from their
 * legacy room fields.
 */
export function resolvePreset(
  preset: Preset,
  { themes = THEMES, qualityId = 'balanced' }: { themes?: readonly Theme[]; qualityId?: string } = {}
): AdaptiveRoomState {
  const theme = findTheme(themes, preset.themeId);
  const space = getSpace(preset.spaceId ?? 'cyclo');
  const content = getContent(preset.envId);
  const p = preset.params;

  let light: LightParams;
  if (preset.light) {
    light = normalizeLight({ ...DEFAULT_LIGHT, ...preset.light });
  } else if (p?.lightIntensity != null || p?.keyAzimuth != null) {
    light = normalizeLight({
      ...DEFAULT_LIGHT,
      master: p.lightIntensity ?? DEFAULT_LIGHT.master,
      keyAzimuth: p.keyAzimuth ?? DEFAULT_LIGHT.keyAzimuth,
      fillIntensity: (p.fillIntensity ?? 1) * DEFAULT_LIGHT.fillIntensity,
    });
  } else {
    light = normalizeLight(DEFAULT_LIGHT);
  }

  return {
    contentId: content.id,
    themeId: theme.id,
    spaceId: space.id,
    qualityId: preset.quality && QUALITIES.some((q) => q.id === preset.quality) ? preset.quality : qualityId,
    room: coerceState(ROOM_SCHEMA, DEFAULT_ROOM, {
      ...DEFAULT_ROOM,
      ...themeRoomPatch(theme),
      ...space.overrides,
      ...p,
    }),
    sim: coerceState(SIM_SCHEMA, DEFAULT_SIM, { ...DEFAULT_SIM, ...preset.sim }),
    light,
    staging: coerceState(STAGING_SCHEMA, DEFAULT_STAGING, { ...DEFAULT_STAGING, ...preset.staging }),
  };
}

export const applyTheme = (state: AdaptiveRoomState, theme: Theme): AdaptiveRoomState => ({
  ...state,
  themeId: theme.id,
  room: { ...state.room, ...themeRoomPatch(theme) },
});

/** Select a space and layer its parameter nudges over the current room. */
export function applySpace(state: AdaptiveRoomState, spaceId: string): AdaptiveRoomState {
  const space = getSpace(spaceId);
  return { ...state, spaceId: space.id, room: { ...state.room, ...space.overrides } };
}

/** Back to defaults for everything the theme does not decide. */
export function resetToTheme(state: AdaptiveRoomState, theme: Theme): AdaptiveRoomState {
  const base = createDefaultState([theme]);
  return { ...base, contentId: state.contentId, spaceId: state.spaceId, qualityId: state.qualityId, themeId: theme.id };
}

/** The body of a preset that reproduces `state`. */
export function captureRecipe(state: AdaptiveRoomState): Omit<Preset, 'id' | 'label' | 'blurb'> {
  return {
    envId: state.contentId,
    themeId: state.themeId,
    spaceId: state.spaceId,
    params: { ...state.room },
    sim: { ...state.sim },
    light: { ...state.light, colorRingColors: [...state.light.colorRingColors], mute: { ...state.light.mute } },
    staging: { ...state.staging },
    quality: state.qualityId,
  };
}
