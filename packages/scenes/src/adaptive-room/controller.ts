import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SceneBounds } from '../core/bounds';
import { localStorageAdapter, readJSON, uid, writeJSON, type StorageAdapter } from '../core/storage';
import { createBundle, isPreset, isTheme, mergeById, parseBundle, type AdaptiveRoomBundle } from './model/bundle';
import { CONTENTS } from './model/contents';
import { applyColorScheme, applyLightMode, type LightChannelId, type LightModeId, type LightParams, type StagingParams } from './model/lighting';
import { ALL_BUILTIN, type Preset } from './model/presets';
import type { RoomParams, SimOpts } from './model/room-params';
import { getSpace, SPACES } from './model/spaces';
import {
  applySpace as applySpaceTo,
  applyTheme as applyThemeTo,
  captureRecipe,
  coerceRoomState,
  findTheme,
  resetToTheme,
  resolvePreset,
  type AdaptiveRoomState,
} from './model/state';
import { THEMES, type Theme } from './model/themes';

export interface AdaptiveRoomControllerOptions {
  /** Where state, custom themes and user presets persist. Default: localStorage. Pass `null` to disable. */
  storage?: StorageAdapter | null;
  /** Preset applied when nothing is persisted. */
  initialPreset?: string;
  /** Mirror content / theme / space into `location.hash` (and read it on start). */
  syncHash?: boolean;
  /** Presentation-mode interval in ms. */
  autoplayInterval?: number;
}

export const STORAGE_KEYS = {
  state: 'adaptive-room-v3',
  themes: 'adaptive-room-themes-v1',
  presets: 'adaptive-room-presets-v1',
} as const;

const describe = (s: AdaptiveRoomState, themes: readonly Theme[]) =>
  `${getSpace(s.spaceId).label} · ${CONTENTS.find((c) => c.id === s.contentId)?.label ?? s.contentId} · ${
    themes.find((t) => t.id === s.themeId)?.label ?? 'Custom'
  }`;

function readHash(state: AdaptiveRoomState, themes: readonly Theme[]): AdaptiveRoomState {
  if (typeof location === 'undefined') return state;
  const hash = new URLSearchParams(location.hash.slice(1));
  const env = hash.get('env');
  const theme = hash.get('theme');
  const space = hash.get('space');
  let next = state;
  if (env && CONTENTS.some((c) => c.id === env)) next = { ...next, contentId: env };
  if (theme && themes.some((t) => t.id === theme)) next = applyThemeTo(next, findTheme(themes, theme));
  if (space && SPACES.some((s) => s.id === space)) next = { ...next, spaceId: space };
  return next;
}

/**
 * Headless state machine for an Adaptive Room: recipe state, themes, spaces,
 * built-in and user presets (save / overwrite / fork / delete), dirty
 * tracking, JSON import/export, persistence and presentation mode.
 *
 * Pass `controller.state` to `<AdaptiveRoomScene state={…} />` and build any
 * UI on the returned actions.
 */
export function useAdaptiveRoomController(options: AdaptiveRoomControllerOptions = {}) {
  const { initialPreset = 'atelier', syncHash = false, autoplayInterval = 12000 } = options;
  const storage = useMemo(
    () => (options.storage === undefined ? localStorageAdapter('') : options.storage),
    [options.storage]
  );

  const [customThemes, setCustomThemes] = useState<Theme[]>(() =>
    storage ? (readJSON<unknown[]>(storage, STORAGE_KEYS.themes) ?? []).filter(isTheme) : []
  );
  const [userPresets, setUserPresets] = useState<Preset[]>(() =>
    storage ? (readJSON<unknown[]>(storage, STORAGE_KEYS.presets) ?? []).filter(isPreset) : []
  );
  const themes = useMemo(() => [...THEMES, ...customThemes], [customThemes]);

  const [state, setState] = useState<AdaptiveRoomState>(() => {
    const all = [...THEMES, ...customThemes];
    const persisted = storage ? readJSON<unknown>(storage, STORAGE_KEYS.state) : undefined;
    const preset = ALL_BUILTIN.find((p) => p.id === initialPreset);
    let s = persisted
      ? coerceRoomState(persisted, all)
      : preset
        ? resolvePreset(preset, { themes: all })
        : coerceRoomState(null, all);
    if (syncHash) s = readHash(s, all);
    return s;
  });
  const [activePresetId, setActivePresetId] = useState<string | null>(() =>
    storage && readJSON(storage, STORAGE_KEYS.state) ? null : initialPreset
  );
  const [dirty, setDirty] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [bounds, setBounds] = useState<SceneBounds | null>(null);
  const [activeLightChannel, setActiveLightChannel] = useState<LightChannelId | null>(null);

  const live = useRef({ state, themes, activePresetId });
  live.current = { state, themes, activePresetId };

  /** Any manual edit keeps the active preset attached but marks it dirty. */
  const edit = useCallback((fn: (s: AdaptiveRoomState) => AdaptiveRoomState) => {
    setState(fn);
    if (live.current.activePresetId) setDirty(true);
  }, []);

  // ---- persistence --------------------------------------------------------
  useEffect(() => {
    if (storage) writeJSON(storage, STORAGE_KEYS.state, state);
    if (syncHash && typeof history !== 'undefined') {
      history.replaceState(null, '', `#env=${state.contentId}&theme=${state.themeId}&space=${state.spaceId}`);
    }
  }, [state, storage, syncHash]);
  useEffect(() => {
    if (storage) writeJSON(storage, STORAGE_KEYS.themes, customThemes);
  }, [customThemes, storage]);
  useEffect(() => {
    if (storage) writeJSON(storage, STORAGE_KEYS.presets, userPresets);
  }, [userPresets, storage]);

  // ---- recipe edits -------------------------------------------------------
  const setRoom = useCallback((patch: Partial<RoomParams>) => edit((s) => ({ ...s, room: { ...s.room, ...patch } })), [edit]);
  const setSim = useCallback((patch: Partial<SimOpts>) => edit((s) => ({ ...s, sim: { ...s.sim, ...patch } })), [edit]);
  const setLight = useCallback((patch: Partial<LightParams>) => edit((s) => ({ ...s, light: { ...s.light, ...patch } })), [edit]);
  const setStaging = useCallback((patch: Partial<StagingParams>) => edit((s) => ({ ...s, staging: { ...s.staging, ...patch } })), [edit]);
  const setContent = useCallback((contentId: string) => edit((s) => ({ ...s, contentId })), [edit]);
  const setQuality = useCallback((qualityId: string) => edit((s) => ({ ...s, qualityId })), [edit]);
  const applyTheme = useCallback(
    (id: string) => edit((s) => applyThemeTo(s, findTheme(live.current.themes, id))),
    [edit]
  );
  const applySpace = useCallback((id: string) => edit((s) => applySpaceTo(s, id)), [edit]);
  const applyLightModeTo = useCallback((id: LightModeId) => edit((s) => ({ ...s, light: applyLightMode(s.light, id) })), [edit]);
  const applyColorSchemeTo = useCallback((id: string) => edit((s) => ({ ...s, light: applyColorScheme(s.light, id) })), [edit]);
  const reset = useCallback(
    () => setState((s) => resetToTheme(s, findTheme(live.current.themes, s.themeId))),
    []
  );

  // ---- presets ------------------------------------------------------------
  const applyPreset = useCallback((preset: Preset | string) => {
    const p = typeof preset === 'string' ? findPreset(preset) : preset;
    if (!p) return;
    setState((s) => resolvePreset(p, { themes: live.current.themes, qualityId: s.qualityId }));
    setActivePresetId(p.id);
    setDirty(false);
  }, []);

  const presetsRef = useRef(userPresets);
  presetsRef.current = userPresets;
  const findPreset = (id: string) => presetsRef.current.find((p) => p.id === id) ?? ALL_BUILTIN.find((p) => p.id === id);

  const savePreset = useCallback((label: string) => {
    const { state: s, themes: t } = live.current;
    const preset: Preset = { id: uid(), label, blurb: describe(s, t), ...captureRecipe(s) };
    setUserPresets((prev) => [preset, ...prev]);
    setActivePresetId(preset.id);
    setDirty(false);
    return preset;
  }, []);

  const overwritePreset = useCallback((id: string) => {
    const { state: s, themes: t } = live.current;
    setUserPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...captureRecipe(s), blurb: p.blurb || describe(s, t) } : p)));
    setActivePresetId(id);
    setDirty(false);
  }, []);

  /** Forking the active preset captures the live (possibly edited) state. */
  const forkPreset = useCallback(
    (source: Preset, label = `${source.label} Copy`) => {
      const body =
        source.id === live.current.activePresetId
          ? captureRecipe(live.current.state)
          : (({ id: _id, label: _label, blurb: _blurb, builtin: _builtin, ...rest }) => rest)(source);
      const preset: Preset = { ...structuredClone(body), id: uid(), label, blurb: source.blurb };
      setUserPresets((prev) => [preset, ...prev]);
      applyPreset(preset);
      return preset;
    },
    [applyPreset]
  );

  const updatePresetMeta = useCallback((id: string, meta: { label?: string; blurb?: string }) => {
    setUserPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...meta } : p)));
  }, []);

  const deletePreset = useCallback((id: string) => {
    setUserPresets((prev) => prev.filter((p) => p.id !== id));
    if (live.current.activePresetId === id) {
      setActivePresetId(null);
      setDirty(false);
    }
  }, []);

  // ---- custom themes ------------------------------------------------------
  const saveTheme = useCallback((theme: Theme) => {
    setCustomThemes((prev) =>
      prev.some((t) => t.id === theme.id) ? prev.map((t) => (t.id === theme.id ? theme : t)) : [...prev, theme]
    );
    // editing the active theme re-applies it live
    if (theme.id === live.current.state.themeId) setState((s) => applyThemeTo(s, theme));
  }, []);
  const deleteTheme = useCallback((id: string) => setCustomThemes((prev) => prev.filter((t) => t.id !== id)), []);

  // ---- import / export ----------------------------------------------------
  const exportBundle = useCallback((): AdaptiveRoomBundle => createBundle(customThemes, userPresets), [customThemes, userPresets]);
  const importBundle = useCallback((text: string) => {
    const b = parseBundle(text);
    if (!b) return false;
    setCustomThemes((prev) => mergeById(prev, b.customThemes));
    setUserPresets((prev) => mergeById(prev, b.userPresets));
    return true;
  }, []);

  // ---- presentation mode --------------------------------------------------
  useEffect(() => {
    if (!autoplay) return;
    let i = Math.max(0, ALL_BUILTIN.findIndex((p) => p.id === live.current.activePresetId));
    const timer = setInterval(() => {
      i = (i + 1) % ALL_BUILTIN.length;
      applyPreset(ALL_BUILTIN[i]);
    }, autoplayInterval);
    return () => clearInterval(timer);
  }, [autoplay, autoplayInterval, applyPreset]);

  const cycleTheme = useCallback(
    (dir: 1 | -1) => {
      const { themes: t, state: s } = live.current;
      const i = t.findIndex((x) => x.id === s.themeId);
      applyTheme(t[(i + dir + t.length) % t.length].id);
    },
    [applyTheme]
  );
  const cycleSpace = useCallback(
    (dir: 1 | -1) => {
      const i = SPACES.findIndex((x) => x.id === live.current.state.spaceId);
      applySpace(SPACES[(i + dir + SPACES.length) % SPACES.length].id);
    },
    [applySpace]
  );

  return {
    state,
    setState: edit,
    themes,
    customThemes,
    userPresets,
    builtinPresets: ALL_BUILTIN,
    activePresetId,
    dirty,
    autoplay,
    setAutoplay,
    bounds,
    setBounds,
    activeLightChannel,
    setActiveLightChannel,
    setRoom,
    setSim,
    setLight,
    setStaging,
    setContent,
    setQuality,
    applyTheme,
    applySpace,
    applyLightMode: applyLightModeTo,
    applyColorScheme: applyColorSchemeTo,
    reset,
    applyPreset,
    savePreset,
    overwritePreset,
    forkPreset,
    updatePresetMeta,
    deletePreset,
    saveTheme,
    deleteTheme,
    exportBundle,
    importBundle,
    cycleTheme,
    cycleSpace,
    /** Props for `<AdaptiveRoomScene {...controller.sceneProps} />`. */
    sceneProps: {
      state,
      themes: customThemes,
      onBoundsChange: setBounds,
      activeLightChannel,
      onSelectLightChannel: setActiveLightChannel,
    },
  };
}

export type AdaptiveRoomController = ReturnType<typeof useAdaptiveRoomController>;
