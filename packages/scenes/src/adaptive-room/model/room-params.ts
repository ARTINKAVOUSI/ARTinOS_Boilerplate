/** Shell, camera and composition parameters of the adaptive room. */
export interface RoomParams {
  /** Interior height of the chamber (world units). Relatively stable. */
  height: number;
  /** Interior depth of the chamber (world units). Relatively stable. */
  depth: number;
  /** Cove / corner radius. Responds moderately to room scale. */
  radius: number;
  /** Extra recess pushed behind the nominal rear-wall plane. */
  rearInset: number;

  /** Vertical camera FOV in degrees. Keep restrained. */
  fov: number;
  /** Multiplier on the computed frustum-fit camera distance. */
  distanceBias: number;

  /** Base albedo of the plaster shell. */
  color: string;
  /** Material roughness. */
  roughness: number;

  /** Legacy master light multiplier (mapped onto `LightParams.master` by presets). */
  lightIntensity: number;
  /** SSGI contribution (0 disables the GI composite visually). */
  ssgiIntensity: number;

  /** Composition safe-area margin as a fraction of the viewport (0..0.2). */
  margin: number;

  /** Tone-mapping exposure. */
  exposure: number;
  /** Plaster micro-relief strength (bump map scale). */
  bumpScale: number;

  /** Vertical composition bias: -0.5 (floor-heavy) .. +0.5 (ceiling-heavy).
   *  Internally clamped to the available frustum margin so the enclosure
   *  guarantee is never violated. */
  targetBias: number;
  /** Multiplier on the auto-fitted subject scale (hard-capped by the shell). */
  subjectScale: number;
  /** Legacy key light azimuth in degrees (mapped onto `LightParams` by presets). */
  keyAzimuth: number;
  /** Legacy fill multiplier (mapped onto `LightParams` by presets). */
  fillIntensity: number;

  /** Physical wall thickness — exterior shell offset + front-rim depth. */
  wallThickness: number;

  /** Subtle pointer parallax on the camera (stays inside the safe margins). */
  parallax: boolean;
}

export const DEFAULT_ROOM: RoomParams = {
  height: 5,
  depth: 6,
  radius: 0.8,
  rearInset: 0.4,

  fov: 35,
  distanceBias: 1.0,

  color: '#e9e4dc',
  roughness: 0.95,

  lightIntensity: 1.0,
  ssgiIntensity: 1.0,

  margin: 0.06,

  exposure: 1.05,
  bumpScale: 0.35,

  targetBias: 0,
  subjectScale: 1,
  keyAzimuth: -28,
  fillIntensity: 1,

  wallThickness: 0.18,
  parallax: true,
};

/** Options consumed by simulation / kinetic content. */
export interface SimOpts {
  /** Population multiplier (balls, pendulums…). */
  density: number;
  /** Time multiplier for kinetic content. */
  speed: number;
}

export const DEFAULT_SIM: SimOpts = { density: 1, speed: 1 };

/** Current interior dimensions actually applied to the geometry. */
export interface RoomDims {
  width: number;
  height: number;
  /** nominal depth (composition plane) */
  depth: number;
  /** depth + rearInset (actual rear wall) */
  totalDepth: number;
  radius: number;
  wallThickness: number;
}
