import { useEffect, useMemo, type ReactNode } from 'react';
import { useArtinosRuntime } from '@artinos/runtime';
import { createBoundsChannel, type SceneBounds } from '../../core/bounds';
import { AdaptiveRoomScene } from '../../adaptive-room/AdaptiveRoomScene';
import type { AdaptiveRoomState } from '../../adaptive-room/model/state';
import { THEMES, type Theme } from '../../adaptive-room/model/themes';
import { useParameterValues } from '../use-parameter-values';
import { ids, readRoomState, roomReadIds } from './parameters';

export const BOUNDS_RESOURCE = 'scene.room.bounds';
const BOUND_KEYS = ['left', 'right', 'floor', 'ceiling', 'back', 'front', 'radius'] as const;

export interface ArtinosAdaptiveRoomProps {
  /** State used for any value the runtime does not (yet) provide. */
  fallback: AdaptiveRoomState;
  themes?: readonly Theme[];
  /** Fitted host subject. */
  children?: ReactNode;
  fitKey?: string | number;
  free?: ReactNode;
}

/**
 * The Adaptive Room driven by ARTINOS runtime parameters. It builds the world
 * only: the host pipeline renders, `RenderSettings` owns DPR and tone mapping.
 * Live bounds are published as `scene.bounds.*` signals and as the
 * `scene.room.bounds` resource (the channel object).
 */
export function ArtinosAdaptiveRoom({ fallback, themes = THEMES, children, fitKey, free }: ArtinosAdaptiveRoomProps) {
  const runtime = useArtinosRuntime();
  const readIds = useMemo(() => roomReadIds(), []);
  const read = useParameterValues(readIds);
  const state = useMemo(() => readRoomState(read, fallback, themes), [read, fallback, themes]);

  const bounds = useMemo(() => createBoundsChannel(), []);
  useEffect(() => runtime.resources.set(BOUNDS_RESOURCE, bounds, { kind: 'scene-bounds', owner: 'scene.room' }), [runtime, bounds]);
  useEffect(() => {
    const publish = (b: SceneBounds) => {
      for (const key of BOUND_KEYS) runtime.signals.set(`scene.bounds.${key}`, b[key]);
      runtime.signals.set('scene.bounds.size', [b.right - b.left, b.ceiling - b.floor, b.front - b.back]);
    };
    publish(bounds.snapshot());
    return bounds.subscribe(publish);
  }, [runtime, bounds]);

  return (
    <AdaptiveRoomScene
      state={state}
      themes={themes === THEMES ? undefined : themes.filter((t) => !THEMES.includes(t))}
      render="host"
      bounds={bounds}
      showBounds={read(ids.showBounds) === true}
      fitKey={fitKey}
      free={free}
    >
      {children}
    </AdaptiveRoomScene>
  );
}
