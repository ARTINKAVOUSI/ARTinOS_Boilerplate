import { useMemo, type ReactNode } from 'react';
import type { BoundsChannel, SceneBounds } from '../core/bounds';
import { BoundsHelper } from '../react/BoundsHelper';
import { ExposureController, PixelRatioController, SceneBackground } from '../react/render-controls';
import { ScenePostFX } from '../react/ScenePostFX';
import { AdaptiveRoom } from './components/AdaptiveRoom';
import { CONTENT_RENDERERS } from './components/contents';
import { SPACE_RENDERERS } from './components/spaces';
import type { LightChannelId } from './model/lighting';
import { ALL_BUILTIN, type Preset } from './model/presets';
import { getQuality } from './model/quality';
import { createDefaultState, findTheme, resolvePreset, type AdaptiveRoomState } from './model/state';
import { THEMES, type Theme } from './model/themes';

export interface AdaptiveRoomSceneProps {
  /** Built-in (or `presets`) preset id. Used when `state` is not given. */
  preset?: string;
  /** Controlled recipe. Wins over `preset`. */
  state?: AdaptiveRoomState;
  /** Additional themes (e.g. user-made) that state / presets may reference. */
  themes?: readonly Theme[];
  /** Additional presets `preset` may name. */
  presets?: readonly Preset[];
  /** Override the recipe's content: an id from the content catalog, or `null` for none. */
  content?: string | null;
  /** Fitted subject, measured into the composition safe area. */
  children?: ReactNode;
  /** Change when the fitted subject changes identity. */
  fitKey?: string | number;
  /** Extra free content that reads the bounds itself. */
  free?: ReactNode;
  /**
   * `standalone`: the scene renders itself (post pipeline, exposure, DPR).
   * `host`: a host pipeline renders; the scene only builds the world.
   */
  render?: 'standalone' | 'host';
  /** Drive the camera. Default true. */
  camera?: boolean;
  /** Mount the light rig. Default true. */
  lights?: boolean;
  /** Manage `scene.background` from the theme. Default true. */
  background?: boolean;
  /** Draw the live bounds box. */
  showBounds?: boolean;
  bounds?: BoundsChannel;
  onBoundsChange?: (bounds: SceneBounds) => void;
  exposeGlobalBounds?: boolean;
  activeLightChannel?: LightChannelId | null;
  onSelectLightChannel?: (id: LightChannelId) => void;
}

/**
 * The complete Adaptive Room: shell, camera, lighting, staging, space
 * architecture, content and (stand-alone) post-processing from one recipe.
 */
export function AdaptiveRoomScene({
  preset = 'atelier',
  state: controlled,
  themes: extraThemes,
  presets: extraPresets,
  content,
  children,
  fitKey,
  free,
  render = 'standalone',
  camera = true,
  lights = true,
  background = true,
  showBounds = false,
  bounds,
  onBoundsChange,
  exposeGlobalBounds,
  activeLightChannel,
  onSelectLightChannel,
}: AdaptiveRoomSceneProps) {
  const themes = useMemo(() => (extraThemes?.length ? [...THEMES, ...extraThemes] : THEMES), [extraThemes]);
  const uncontrolled = useMemo(() => {
    if (controlled) return null;
    const p = extraPresets?.find((x) => x.id === preset) ?? ALL_BUILTIN.find((x) => x.id === preset);
    return p ? resolvePreset(p, { themes }) : createDefaultState(themes);
  }, [controlled, preset, extraPresets, themes]);
  const state = controlled ?? uncontrolled!;

  const theme = findTheme(themes, state.themeId);
  const quality = getQuality(state.qualityId);
  const contentId = content === undefined ? state.contentId : content;
  const renderer = contentId ? CONTENT_RENDERERS[contentId] : undefined;
  const Space = SPACE_RENDERERS[state.spaceId];

  return (
    <>
      {background && <SceneBackground color={theme.background} />}
      {render === 'standalone' && (
        <>
          <PixelRatioController dpr={quality.dpr} />
          <ExposureController exposure={state.room.exposure} />
        </>
      )}
      <AdaptiveRoom
        params={state.room}
        theme={theme}
        light={lights ? state.light : false}
        staging={state.staging}
        camera={camera}
        activeLightChannel={activeLightChannel}
        onSelectLightChannel={onSelectLightChannel}
        fitKey={`${contentId ?? ''}|${fitKey ?? ''}`}
        bounds={bounds}
        onBoundsChange={onBoundsChange}
        exposeGlobalBounds={exposeGlobalBounds}
        free={
          <>
            {renderer?.free?.(theme, state.sim)}
            {Space && <Space theme={theme} />}
            {free}
            {showBounds && <BoundsHelper visible />}
          </>
        }
      >
        {renderer?.fitted?.(theme, state.sim)}
        {children}
      </AdaptiveRoom>
      {render === 'standalone' && <ScenePostFX ssgiIntensity={state.room.ssgiIntensity} quality={quality} />}
    </>
  );
}
