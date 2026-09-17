import type { ReactNode } from 'react';
import type { SimOpts } from '../../model/room-params';
import type { Theme } from '../../model/themes';
import { BallSim } from './BallSim';
import { FloatingStage } from './FloatingStage';
import { Kinetic } from './Kinetic';
import { PendulumWave } from './PendulumWave';
import { Sculpture } from './Sculpture';

export { BallSim, FloatingStage, Kinetic, PendulumWave, Sculpture };

/** Renders a built-in content piece. See `model/contents.ts` for the catalog. */
export type ContentRenderer = (theme: Theme, opts: SimOpts) => ReactNode;

/** fitted — measured into the safe area; free — tracks the scene bounds itself. */
export const CONTENT_RENDERERS: Record<string, { fitted?: ContentRenderer; free?: ContentRenderer }> = {
  void: {},
  sculpture: { fitted: (t) => <Sculpture palette={t.palette} /> },
  stage: { free: (t, o) => <FloatingStage palette={t.palette} speed={o.speed} /> },
  wave: { free: (t, o) => <PendulumWave palette={t.palette} speed={o.speed} density={o.density} /> },
  kinetic: { free: (t, o) => <Kinetic palette={t.palette} speed={o.speed} /> },
  pool: {
    free: (t, o) => <BallSim mode="pool" palette={t.palette} speed={o.speed} count={Math.round(84 * o.density)} />,
  },
  drift: {
    free: (t, o) => <BallSim mode="drift" palette={t.palette} speed={o.speed} count={Math.round(24 * o.density)} />,
  },
};
