import { defineArtinosProject } from '@artinos/r3f'
import { adaptiveRoomKit } from '@artinos/scenes/artinos'

/**
 * Adaptive Room template — a preset scene from @artinos/scenes. The room owns
 * camera, lights and backdrop, so the shared stage keeps only render settings.
 * Pick looks from the "Room / …" presets (Ctrl/Cmd+K) or edit the Room groups
 * in the Inspector. To stage your own subject, render it inside the scene:
 *
 *   Content: () => <room.Scene fitKey="model"><MyModel/></room.Scene>
 *
 * and create the kit with `content: null` so the built-in still life steps aside.
 */
const room = adaptiveRoomKit({ preset: 'atelier' })

export default defineArtinosProject({
  id: 'adaptive-room',
  name: 'Adaptive Room',
  version: '1.0.0',
  description: 'Preset open-front room scene that recomposes to the viewport',
  shell: 'studio',
  renderer: { backend: 'auto', dpr: [.75, 2], shadows: true, postfx: true, alpha: false, antialias: false, powerPreference: 'high-performance', threeInspector: true, threeInspectorVisible: false },
  ...room.project,
  Content: room.Content,
})
