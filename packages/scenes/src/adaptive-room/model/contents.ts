/**
 * Built-in content catalog. Each piece is either
 *   fitted — measured and kept inside the composition safe area, or
 *   free   — manages itself against the live scene bounds.
 * Rendering lives in `components/contents`.
 */

export interface ContentInfo {
  id: string;
  label: string;
  blurb: string;
  mode: 'none' | 'fitted' | 'free';
  /** Responds to the density / speed simulation options. */
  simulated?: boolean;
}

export const CONTENTS: readonly ContentInfo[] = [
  { id: 'void', label: 'Empty', blurb: 'The room itself is the design.', mode: 'none' },
  { id: 'sculpture', label: 'Sculpture', blurb: 'Safe-area fitted matte composition.', mode: 'fitted' },
  {
    id: 'stage',
    label: 'Stage',
    blurb: 'Floating platform tracking the adaptive depth.',
    mode: 'free',
    simulated: true,
  },
  {
    id: 'wave',
    label: 'Pendulum',
    blurb: 'Pendulum wave — the pendulum count adapts to the live room width.',
    mode: 'free',
    simulated: true,
  },
  {
    id: 'kinetic',
    label: 'Kinetic',
    blurb: 'Orbital mobile — ring radius conforms to the adaptive chamber.',
    mode: 'free',
    simulated: true,
  },
  {
    id: 'pool',
    label: 'Ball Pool',
    blurb: 'Gravity physics inside the room bounds — click to stir.',
    mode: 'free',
    simulated: true,
  },
  {
    id: 'drift',
    label: 'Zero-G',
    blurb: 'Weightless drift, elastic cove collisions.',
    mode: 'free',
    simulated: true,
  },
];

export const getContent = (id: string): ContentInfo =>
  CONTENTS.find((c) => c.id === id) ?? CONTENTS[0];
