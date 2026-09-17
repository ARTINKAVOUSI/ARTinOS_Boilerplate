/**
 * @artinos/scenes without ARTINOS: the Adaptive Room with its own renderer,
 * post-processing and controller. Serve with the workspace dev server at
 * /packages/scenes/examples/standalone.html (`?preset=<id>` picks a preset).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdaptiveRoomScene, SceneCanvas, useAdaptiveRoomController, useAdaptiveRoomShortcuts } from '../src';

function App() {
  const preset = new URLSearchParams(location.search).get('preset') ?? 'atelier';
  const room = useAdaptiveRoomController({ storage: null, initialPreset: preset });
  useAdaptiveRoomShortcuts(room);
  return (
    <SceneCanvas>
      <AdaptiveRoomScene {...room.sceneProps} />
    </SceneCanvas>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
