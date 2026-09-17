import type { ReactNode } from 'react';
import type { ArtinosRuntime, ModuleManifest, ParameterValue, Unsubscribe } from '@artinos/runtime';
import { ALL_BUILTIN, type Preset } from '../../adaptive-room/model/presets';
import { SPACES } from '../../adaptive-room/model/spaces';
import { createDefaultState, resolvePreset } from '../../adaptive-room/model/state';
import { THEMES, type Theme } from '../../adaptive-room/model/themes';
import { ArtinosAdaptiveRoom } from './ArtinosAdaptiveRoom';
import { HOST_IDS, ids, roomParameters, roomRuntimePresets, roomStateToValues } from './parameters';

export interface AdaptiveRoomKitOptions {
  /** Built-in preset that provides the parameter defaults. */
  preset?: string;
  /** Override the preset's content (`null` = empty room, e.g. when the project brings its own subject). */
  content?: string | null;
  /** Extra themes and presets to offer. */
  themes?: readonly Theme[];
  presets?: readonly Preset[];
  /** Turn on the host pipeline's SSGI + TRAA on install. Default true. */
  postfx?: boolean;
}

/** Stage sections the room replaces (render settings stay with the host). */
export const ADAPTIVE_ROOM_STAGE = {
  environment: false,
  camera: false,
  controls: false,
  lighting: false,
  shadows: false,
  fog: false,
  grid: false,
} as const;

/** Host post-processing the room is designed for. */
const HOST_POSTFX: Record<string, ParameterValue> = {
  'postfx.ssgi.enabled': true,
  'postfx.traa.enabled': true,
  'postfx.fxaa.enabled': false,
  'postfx.bloom.enabled': false,
  'postfx.vignette.enabled': false,
  'render.toneMapping': 'aces',
};

/** Apply values as a single undoable step. */
export function applyValues(runtime: ArtinosRuntime, values: Record<string, ParameterValue>, label: string) {
  runtime.history.begin(label, 'preset');
  try {
    for (const [id, value] of Object.entries(values)) {
      if (runtime.parameters.state(id)) runtime.setParameter(id, value, label, { source: 'preset' });
    }
  } finally {
    runtime.history.commit();
  }
}

/**
 * Everything an ARTINOS project needs to host the Adaptive Room:
 *
 * ```tsx
 * const room = adaptiveRoomKit({ preset: 'atelier' })
 * export default defineArtinosProject({ id, name, ...room.project, Content: room.Content })
 * ```
 */
export function adaptiveRoomKit(options: AdaptiveRoomKitOptions = {}) {
  const { preset: presetId = 'atelier', content, postfx = true } = options;
  const themes = options.themes?.length ? [...THEMES, ...options.themes] : THEMES;
  const presetList = [...(options.presets ?? []), ...ALL_BUILTIN];
  const initialPreset = presetList.find((p) => p.id === presetId);
  const base = initialPreset ? resolvePreset(initialPreset, { themes }) : createDefaultState(themes);
  const defaults = content === undefined ? base : { ...base, contentId: content ?? 'void' };

  const parameters = roomParameters(defaults, themes);
  const presets = roomRuntimePresets(themes, options.presets ?? []);

  const module: ModuleManifest = {
    id: 'scene.adaptive-room',
    name: 'Adaptive Room',
    category: 'scene',
    description: 'Open-front chamber that re-composes itself to the camera frustum, with studio lighting, staging, spaces and SSGI.',
    runtime: 'r3f',
    provider: 'artinos',
    version: '1.0.0',
    tags: ['scene', 'preset', 'room', 'studio', 'ssgi'],
    canonicalImport: '@artinos/scenes/artinos',
    capabilities: ['scene.bounds', 'subject-fit', 'camera', 'lighting'],
    outputs: [
      { id: 'scene.bounds.left', label: 'Bounds Left', type: 'number' },
      { id: 'scene.bounds.right', label: 'Bounds Right', type: 'number' },
      { id: 'scene.bounds.ceiling', label: 'Bounds Ceiling', type: 'number' },
      { id: 'scene.bounds.back', label: 'Bounds Back', type: 'number' },
    ] as ModuleManifest['outputs'],
  };

  const setup = ({ runtime }: { runtime: ArtinosRuntime }): Unsubscribe[] => {
    // host defaults; persisted values load afterwards and win
    const hostDefaults: Record<string, ParameterValue> = {
      ...(postfx ? HOST_POSTFX : {}),
      ...Object.fromEntries(Object.values(HOST_IDS).map((id) => [id, roomStateToValues(defaults)[id]])),
    };
    for (const [id, value] of Object.entries(hostDefaults)) {
      if (runtime.parameters.state(id)) runtime.parameters.write(id, value, { source: 'preset' });
    }

    const cycle = (id: string, list: readonly { id: string }[], dir: number, label: string) => {
      const current = runtime.parameters.getBase<string>(id);
      const index = list.findIndex((x) => x.id === current);
      const next = list[(index + dir + list.length) % list.length];
      if (id === ids.theme) applyValues(runtime, { [ids.theme]: next.id, [ids.themeSurface]: true }, label);
      else runtime.presets.get(`room-space:${next.id}`) && applyValues(runtime, runtime.presets.get(`room-space:${next.id}`)!.values, label);
    };
    let presetIndex = Math.max(0, presetList.findIndex((p) => p.id === presetId));
    const applyPreset = (id: string) => {
      const p = runtime.presets.get(id.startsWith('room') ? id : `room:${id}`);
      if (p) applyValues(runtime, p.values, `Room preset: ${p.label}`);
    };

    return [
      runtime.commands.register({ id: 'scene.room.preset.apply', label: 'Room: Apply Preset', execute: (c) => applyPreset(String(c.value ?? '')) }),
      runtime.commands.register({
        id: 'scene.room.preset.next',
        label: 'Room: Next Preset',
        execute: () => {
          presetIndex = (presetIndex + 1) % presetList.length;
          applyPreset(presetList[presetIndex].id);
        },
      }),
      runtime.commands.register({ id: 'scene.room.theme.next', label: 'Room: Next Theme', execute: () => cycle(ids.theme, themes, 1, 'Room: next theme') }),
      runtime.commands.register({ id: 'scene.room.theme.previous', label: 'Room: Previous Theme', execute: () => cycle(ids.theme, themes, -1, 'Room: previous theme') }),
      runtime.commands.register({ id: 'scene.room.space.next', label: 'Room: Next Space', execute: () => cycle(ids.space, SPACES, 1, 'Room: next space') }),
      runtime.commands.register({ id: 'scene.room.space.previous', label: 'Room: Previous Space', execute: () => cycle(ids.space, SPACES, -1, 'Room: previous space') }),
      runtime.commands.register({
        id: 'scene.room.bounds.toggle',
        label: 'Room: Toggle Bounds',
        execute: () => {
          runtime.setParameter(ids.showBounds, runtime.parameters.getBase(ids.showBounds) !== true, 'Room: toggle bounds');
        },
      }),
    ];
  };

  /** The room with an optional host subject fitted inside it. */
  function Scene({ children, fitKey, free }: { children?: ReactNode; fitKey?: string | number; free?: ReactNode }) {
    return (
      <ArtinosAdaptiveRoom fallback={defaults} themes={themes} fitKey={fitKey} free={free}>
        {children}
      </ArtinosAdaptiveRoom>
    );
  }

  return {
    defaults,
    parameters,
    presets,
    modules: [module],
    stage: ADAPTIVE_ROOM_STAGE,
    setup,
    Scene,
    Content: () => <Scene />,
    /** Spread into `defineArtinosProject({...})`. */
    project: { stage: ADAPTIVE_ROOM_STAGE, parameters, presets, modules: [module], setup },
  };
}

export type AdaptiveRoomKit = ReturnType<typeof adaptiveRoomKit>;
