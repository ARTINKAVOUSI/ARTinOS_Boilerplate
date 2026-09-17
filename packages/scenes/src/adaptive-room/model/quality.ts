/** Rendering quality tiers: SSGI sampling density + device pixel ratio cap. */
export interface QualityDef {
  id: string;
  label: string;
  dpr: number;
  /** SSGI hemisphere slices (1-4) */
  slices: number;
  /** SSGI steps per slice side */
  steps: number;
}

export const QUALITIES: QualityDef[] = [
  { id: 'low', label: 'Low', dpr: 1.0, slices: 1, steps: 8 },
  { id: 'balanced', label: 'Balanced', dpr: 1.25, slices: 2, steps: 8 },
  { id: 'high', label: 'High', dpr: 1.6, slices: 3, steps: 12 },
  { id: 'ultra', label: 'Ultra', dpr: 2.0, slices: 4, steps: 16 },
];

export const getQuality = (id: string): QualityDef =>
  QUALITIES.find((q) => q.id === id) ?? QUALITIES[1];
