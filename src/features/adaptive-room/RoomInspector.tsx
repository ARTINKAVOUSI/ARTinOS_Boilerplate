import type { FeatureInspector, FeatureInspectorProps } from '../../app/feature'
import { useSignalSnapshot } from '../../app/signals'
import { Button } from '../../ui/Button/Button'
import './RoomInspector.css'

/** Features that overlap the stage while they are on. */
const OVERLAPS = [
  { id: 'scene.lighting', name: 'Lighting', note: 'A second rig over the stage’s own.', whenRig: true },
  { id: 'scene.ground', name: 'Ground', note: 'Lies on the stage floor and flickers against it.', whenRig: false },
]

/**
 * The stage's Inspector section: its live size and shape, and the features
 * that overlap it while they are on. Effects that suit it (SSGI, TRAA) are
 * components of their own, added from the Library.
 */
export function RoomInspector({ values, peer, setEnabled }: FeatureInspectorProps) {
  const signals = useSignalSnapshot(6)
  const read = (name: string) => signals.find(([key]) => key === name)?.[1]
  const size = [read('room.width'), read('room.height'), read('room.depth')]
  const fitting = values.framing !== 'free'
  const overlaps = OVERLAPS.filter(row => peer(row.id)?.enabled && (!row.whenRig || values.rig !== false))
  const navigationPaused = fitting && peer('scene.controls')?.enabled

  return (
    <details className="artinos-room-inspector" open>
      <summary>Adaptive stage</summary>
      <dl className="artinos-room-size" aria-label="Live stage size">
        <div>
          <dt>Stage</dt>
          <dd>{typeof values.stage === 'string' ? values.stage : 'room'}</dd>
        </div>
        {(['Width', 'Height', 'Depth'] as const).map((label, index) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{size[index]?.toFixed(2) ?? '—'}</dd>
          </div>
        ))}
        <div>
          <dt>Camera</dt>
          <dd>{fitting ? 'fitted' : 'free'}</dd>
        </div>
      </dl>
      {overlaps.length > 0 && (
        <ul className="artinos-room-peers">
          {overlaps.map(row => (
            <li key={row.id} data-overlap>
              <span>
                <b>{row.name}</b>
                {row.note}
              </span>
              <Button size="sm" onClick={() => setEnabled(row.id, false)}>
                Turn off
              </Button>
            </li>
          ))}
        </ul>
      )}
      {navigationPaused && <p>Navigation is paused while the stage frames the camera. Set Camera to free to orbit.</p>}
    </details>
  )
}

export default RoomInspector

/** Studio-only; lives in the stage's folder, so deleting the folder removes it. */
export const inspector: FeatureInspector = {
  id: 'adaptive-room',
  features: ['scene.adaptive-room'],
  component: RoomInspector,
}
