import { defineScene } from '../core/scene-definition';
import { CONTENTS } from './model/contents';
import { COLLECTIONS, type Preset } from './model/presets';
import { QUALITIES } from './model/quality';
import { LIGHT_SCHEMA, ROOM_SCHEMA, SIM_SCHEMA, STAGING_SCHEMA } from './model/schema';
import { SPACES } from './model/spaces';
import { createDefaultState, type AdaptiveRoomState } from './model/state';
import { THEMES } from './model/themes';

const option = ({ id, label, blurb }: { id: string; label: string; blurb?: string }) => ({
  id,
  label,
  description: blurb,
});

export const adaptiveRoom = defineScene<AdaptiveRoomState, Preset>({
  id: 'adaptive-room',
  label: 'Adaptive Room',
  description:
    'Open-front architectural chamber that re-composes itself to the camera frustum — studio lighting, staging, spaces and SSGI included.',
  version: '1.0.0',
  defaults: createDefaultState(),
  sections: {
    room: ROOM_SCHEMA,
    sim: SIM_SCHEMA,
    light: LIGHT_SCHEMA,
    staging: STAGING_SCHEMA,
  },
  choices: {
    contentId: CONTENTS.map(option),
    themeId: THEMES.map((t) => ({ id: t.id, label: t.label })),
    spaceId: SPACES.map(option),
    qualityId: QUALITIES.map((q) => ({ id: q.id, label: q.label })),
  },
  collections: COLLECTIONS.map((c) => ({ id: c.id, label: c.label, description: c.blurb, presets: c.presets })),
  capabilities: {
    bounds: true,
    subjectFit: true,
    ownsCamera: true,
    ownsLights: true,
    postfx: [
      { type: 'ssgi', minTier: 'balanced', fallback: 'gtao' },
      { type: 'traa', fallback: 'fxaa' },
    ],
    requires: ['shadows', 'mrt-velocity'],
  },
});
