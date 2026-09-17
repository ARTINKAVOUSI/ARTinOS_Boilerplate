import type { ParameterDefinition, ParameterValue, Preset as RuntimePreset } from '@artinos/runtime';
import { coerceValue } from '../../core/param-schema';
import { CONTENTS } from '../../adaptive-room/model/contents';
import { LIGHT_CHANNELS, type LightChannelId } from '../../adaptive-room/model/lighting';
import { COLLECTIONS, type Preset } from '../../adaptive-room/model/presets';
import { LIGHT_SCHEMA, ROOM_SCHEMA, SIM_SCHEMA, STAGING_SCHEMA } from '../../adaptive-room/model/schema';
import { getSpace, SPACES } from '../../adaptive-room/model/spaces';
import { findTheme, RING_SLOTS, resolvePreset, type AdaptiveRoomState } from '../../adaptive-room/model/state';
import { THEMES, type Theme } from '../../adaptive-room/model/themes';
import { descriptorToParameter, schemaKeys, schemaToParameters } from '../schema-to-parameters';

/**
 * Runtime parameter layout of the Adaptive Room.
 *
 * One writer per value: the room's exposure and SSGI strength are not room
 * parameters here — presets write them onto the host's `render.exposure` and
 * `postfx.ssgi.*`, which the shared render pipeline already owns.
 */

export const ROOM_ID = 'scene.room';
export const ROOM_GROUP = 'Room';

export const ids = {
  content: `${ROOM_ID}.content`,
  theme: `${ROOM_ID}.theme`,
  space: `${ROOM_ID}.space`,
  themeSurface: `${ROOM_ID}.themeSurface`,
  showBounds: `${ROOM_ID}.showBounds`,
  solo: `${ROOM_ID}.light.solo`,
  room: (key: string) => `${ROOM_ID}.${key}`,
  sim: (key: string) => `${ROOM_ID}.sim.${key}`,
  light: (key: string) => `${ROOM_ID}.light.${key}`,
  mute: (channel: LightChannelId) => `${ROOM_ID}.light.mute.${channel}`,
  ringColor: (slot: number) => `${ROOM_ID}.light.ringColor${slot + 1}`,
  staging: (key: string) => `${ROOM_ID}.staging.${key}`,
} as const;

/** Host-owned parameters the room's presets write. */
export const HOST_IDS = {
  exposure: 'render.exposure',
  giIntensity: 'postfx.ssgi.giIntensity',
  aoIntensity: 'postfx.ssgi.aoIntensity',
} as const;

const ROOM_EXCLUDE = ['ssgiIntensity', 'exposure'] as const;
const ROOM_KEYS = schemaKeys(ROOM_SCHEMA, ROOM_EXCLUDE);
const SIM_KEYS = schemaKeys(SIM_SCHEMA);
const LIGHT_KEYS = schemaKeys(LIGHT_SCHEMA);
const STAGING_KEYS = schemaKeys(STAGING_SCHEMA);

/** SSGI uniforms equivalent to the room's single `ssgiIntensity` control. */
export const ssgiFromIntensity = (s: number) => ({
  giIntensity: 9 * Math.max(0, s),
  aoIntensity: Math.min(1.4, 0.85 * Math.max(0, s) + 0.15),
});

export function roomParameters(defaults: AdaptiveRoomState, themes: readonly Theme[] = THEMES): ParameterDefinition[] {
  const scene = `${ROOM_GROUP} / Scene`;
  const choice = (id: string, label: string, value: string, options: { id: string; label: string }[], order: number): ParameterDefinition => ({
    id,
    label,
    type: 'enum',
    defaultValue: value,
    group: scene,
    order,
    options: options.map((o) => ({ label: o.label, value: o.id })),
  });
  const channels = LIGHT_CHANNELS.map((c) => ({ id: c.id, label: c.label }));
  return [
    choice(ids.content, 'Content', defaults.contentId, [...CONTENTS], 0),
    choice(ids.theme, 'Theme', defaults.themeId, [...themes], 1),
    choice(ids.space, 'Space', defaults.spaceId, [...SPACES], 2),
    {
      id: ids.themeSurface,
      label: 'Theme Surface',
      description: 'Take plaster color and roughness from the theme.',
      type: 'boolean',
      defaultValue: true,
      group: `${ROOM_GROUP} / Surface`,
      order: -1,
    },
    { id: ids.showBounds, label: 'Show Bounds', type: 'boolean', defaultValue: false, group: scene, order: 3, advanced: true, persist: false },
    ...schemaToParameters(ROOM_SCHEMA, { prefix: ROOM_ID, group: ROOM_GROUP, defaults: defaults.room, exclude: ROOM_EXCLUDE, order: 10 }),
    ...schemaToParameters(SIM_SCHEMA, { prefix: `${ROOM_ID}.sim`, group: ROOM_GROUP, defaults: defaults.sim, order: 100 }),
    ...schemaToParameters(LIGHT_SCHEMA, { prefix: `${ROOM_ID}.light`, group: ROOM_GROUP, defaults: defaults.light, order: 200 }),
    {
      id: ids.solo,
      label: 'Solo Channel',
      type: 'enum',
      defaultValue: defaults.light.solo ?? 'none',
      group: `${ROOM_GROUP} / Light / Channels`,
      order: 300,
      options: [{ label: 'None', value: 'none' }, ...channels.map((c) => ({ label: c.label, value: c.id }))],
    },
    ...channels.map<ParameterDefinition>((c, i) => ({
      id: ids.mute(c.id as LightChannelId),
      label: `Mute ${c.label}`,
      type: 'boolean',
      defaultValue: defaults.light.mute[c.id as LightChannelId] === true,
      group: `${ROOM_GROUP} / Light / Channels`,
      order: 301 + i,
      advanced: true,
    })),
    ...Array.from({ length: RING_SLOTS }, (_, i) =>
      descriptorToParameter(
        ids.ringColor(i),
        { type: 'color', label: `Gel ${i + 1}`, group: 'Light / Ring', advanced: true },
        defaults.light.colorRingColors[i],
        `${ROOM_GROUP} / Light / Ring`,
        320 + i
      )
    ),
    ...schemaToParameters(STAGING_SCHEMA, { prefix: `${ROOM_ID}.staging`, group: ROOM_GROUP, defaults: defaults.staging, order: 400 }),
  ];
}

/**
 * Parameter values that reproduce `state`. `themeSurface` is true when the
 * surface equals the theme's, so theme switches keep driving it.
 */
export function roomStateToValues(
  state: AdaptiveRoomState,
  { themes = THEMES, host = true }: { themes?: readonly Theme[]; host?: boolean } = {}
): Record<string, ParameterValue> {
  const theme = findTheme(themes, state.themeId);
  const values: Record<string, ParameterValue> = {
    [ids.content]: state.contentId,
    [ids.theme]: state.themeId,
    [ids.space]: state.spaceId,
    [ids.themeSurface]: state.room.color.toLowerCase() === theme.room.toLowerCase() && state.room.roughness === theme.roughness,
    [ids.solo]: state.light.solo ?? 'none',
  };
  for (const key of ROOM_KEYS) values[ids.room(key)] = state.room[key] as ParameterValue;
  for (const key of SIM_KEYS) values[ids.sim(key)] = state.sim[key];
  for (const key of LIGHT_KEYS) values[ids.light(key)] = state.light[key] as ParameterValue;
  for (const key of STAGING_KEYS) values[ids.staging(key)] = state.staging[key];
  for (const c of LIGHT_CHANNELS) values[ids.mute(c.id)] = state.light.mute[c.id] === true;
  state.light.colorRingColors.forEach((color, i) => (values[ids.ringColor(i)] = color));
  if (host) {
    const ssgi = ssgiFromIntensity(state.room.ssgiIntensity);
    values[HOST_IDS.exposure] = state.room.exposure;
    values[HOST_IDS.giIntensity] = ssgi.giIntensity;
    values[HOST_IDS.aoIntensity] = ssgi.aoIntensity;
  }
  return values;
}

type Read = (id: string) => unknown;

/** Rebuild the scene state from resolved parameter values (invalid values fall back to `fallback`). */
export function readRoomState(
  read: Read,
  fallback: AdaptiveRoomState,
  themes: readonly Theme[] = THEMES
): AdaptiveRoomState {
  const str = (id: string, valid: (v: string) => boolean, def: string) => {
    const v = read(id);
    return typeof v === 'string' && valid(v) ? v : def;
  };
  const section = <T extends object>(schema: Record<string, unknown>, keys: string[], idOf: (k: string) => string, base: T): T => {
    const out = { ...base } as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = schema[key] as Parameters<typeof coerceValue>[0];
      out[key] = coerceValue(descriptor, read(idOf(key)), (base as Record<string, unknown>)[key]);
    }
    return out as T;
  };

  const themeId = str(ids.theme, (v) => themes.some((t) => t.id === v), fallback.themeId);
  const theme = findTheme(themes, themeId);
  const room = section(ROOM_SCHEMA, ROOM_KEYS, ids.room, fallback.room);
  if (read(ids.themeSurface) !== false) {
    room.color = theme.room;
    room.roughness = theme.roughness;
  }
  const exposure = read(HOST_IDS.exposure);
  if (typeof exposure === 'number') room.exposure = exposure;
  const gi = read(HOST_IDS.giIntensity);
  if (typeof gi === 'number') room.ssgiIntensity = Math.round((gi / 9) * 1e4) / 1e4;

  const light = section(LIGHT_SCHEMA, LIGHT_KEYS, ids.light, fallback.light);
  const mute: AdaptiveRoomState['light']['mute'] = {};
  for (const c of LIGHT_CHANNELS) if (read(ids.mute(c.id)) === true) mute[c.id] = true;
  const solo = read(ids.solo);
  light.mute = mute;
  light.solo = LIGHT_CHANNELS.some((c) => c.id === solo) ? (solo as LightChannelId) : null;
  light.colorRingColors = Array.from({ length: RING_SLOTS }, (_, i) =>
    coerceValue({ type: 'color', label: '', group: '' }, read(ids.ringColor(i)), fallback.light.colorRingColors[i]) as string
  );

  return {
    contentId: str(ids.content, (v) => CONTENTS.some((c) => c.id === v), fallback.contentId),
    themeId,
    spaceId: str(ids.space, (v) => SPACES.some((s) => s.id === v), fallback.spaceId),
    qualityId: fallback.qualityId,
    room,
    sim: section(SIM_SCHEMA, SIM_KEYS, ids.sim, fallback.sim),
    light,
    staging: section(STAGING_SCHEMA, STAGING_KEYS, ids.staging, fallback.staging),
  };
}

/** Every parameter id the room component reads. */
export function roomReadIds(): string[] {
  return [
    ...Object.keys(roomStateToValues(resolvePreset(COLLECTIONS[0].presets[0]))),
    ids.showBounds,
  ];
}

/** Built-in presets, themes and spaces as runtime presets. */
export function roomRuntimePresets(themes: readonly Theme[] = THEMES, extra: readonly Preset[] = []): RuntimePreset[] {
  const out: RuntimePreset[] = [];
  for (const collection of COLLECTIONS) {
    for (const preset of collection.presets) {
      out.push({
        id: `room:${preset.id}`,
        label: preset.label,
        group: `Room / ${collection.label}`,
        description: preset.blurb,
        tags: ['adaptive-room', collection.id],
        values: roomStateToValues(resolvePreset(preset, { themes }), { themes }),
      });
    }
  }
  for (const preset of extra) {
    out.push({
      id: `room:${preset.id}`,
      label: preset.label,
      group: 'Room / Custom',
      description: preset.blurb,
      tags: ['adaptive-room'],
      values: roomStateToValues(resolvePreset(preset, { themes }), { themes }),
    });
  }
  for (const theme of themes) {
    out.push({
      id: `room-theme:${theme.id}`,
      label: theme.label,
      group: 'Room / Themes',
      tags: ['adaptive-room', 'theme'],
      values: { [ids.theme]: theme.id, [ids.themeSurface]: true },
    });
  }
  for (const space of SPACES) {
    const values: Record<string, ParameterValue> = { [ids.space]: space.id };
    for (const [key, value] of Object.entries(getSpace(space.id).overrides ?? {})) {
      if (key === 'exposure') values[HOST_IDS.exposure] = value as number;
      else if (key === 'ssgiIntensity') Object.assign(values, {
        [HOST_IDS.giIntensity]: ssgiFromIntensity(value as number).giIntensity,
        [HOST_IDS.aoIntensity]: ssgiFromIntensity(value as number).aoIntensity,
      });
      else if ((ROOM_KEYS as string[]).includes(key)) values[ids.room(key)] = value as ParameterValue;
    }
    out.push({
      id: `room-space:${space.id}`,
      label: space.label,
      group: 'Room / Spaces',
      description: space.blurb,
      tags: ['adaptive-room', 'space'],
      values,
    });
  }
  return out;
}
