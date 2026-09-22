import { useMemo, useState, useSyncExternalStore } from 'react'
import { useArtinosRuntime, type AutomationTrack, type EasingName } from '@artinos/runtime'
import { Button, NumberField, Select, Toggle, Toolbar } from '@artinos/ui'
import { useParameterIds } from '../react/use-parameter'
import { PanelEmpty } from '@artinos/ui'
const EASINGS: EasingName[] = ['linear', 'smooth', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-in-out', 'back', 'bounce', 'spring']
export function TimelinePanel() {
  const runtime = useArtinosRuntime()
  const ids = useParameterIds()
  const revision = useSyncExternalStore(callback => runtime.automation.subscribe(callback), () => runtime.automation.revision, () => 0)
  const tracks = useMemo(() => runtime.automation.list(), [runtime, revision])
  const numeric = ids.map(id => runtime.parameters.state(id)).filter(state => state && state.definition.type === 'number' && !state.definition.presentation?.readOnly)
  const [target, setTarget] = useState(''), [time, setTime] = useState(0)
  const selected = numeric.some(state => state?.definition.id === target) ? target : numeric[0]?.definition.id ?? ''
  const update = (track: AutomationTrack, patch: Partial<AutomationTrack>) => runtime.automation.add({ ...track, ...patch })
  return <div className="artinos-timeline-panel">
    <Toolbar><Select label="Parameter" value={selected} onChange={setTarget} options={numeric.map(state => ({ value: state!.definition.id, label: state!.definition.label ?? state!.definition.id }))} /><NumberField label="Key time (s)" value={time} min={0} step={.01} onChange={setTime} /><Button disabled={!selected} onClick={() => {
      const value = Number(runtime.parameters.getBase(selected) ?? 0)
      runtime.automation.add({ id: `track-${crypto.randomUUID()}`, target: selected, duration: 5, enabled: true, loop: true, keyframes: [{ time: 0, value }, { time: 5, value }] })
    }}>Add track</Button></Toolbar>
    <div className="artinos-panel-summary"><span>{tracks.length} automation tracks</span><span>Playback follows runtime time</span></div>
    {!tracks.length && <PanelEmpty title="Make a parameter move" description="Choose a parameter and add a track. Edit its keyframes to shape the animation over time." />}
    <div className="artinos-timeline-tracks">{tracks.map(track => {
      const definition = runtime.parameters.state(track.target)?.definition
      const label = definition?.label ?? track.target
      return <article className="artinos-track" key={track.id}>
        <header className="artinos-track-head"><b>{label}</b><Toggle label={`Enable ${label}`} value={track.enabled !== false} onChange={enabled => update(track, { enabled })} /><Button title={`Remove ${label} track`} onClick={() => runtime.automation.remove(track.id)}>Remove track</Button></header>
        <div className="artinos-track-settings"><NumberField label="Duration (s)" value={track.duration} min={.01} step={.1} onChange={duration => update(track, { duration: Math.max(.01, duration), keyframes: track.keyframes.map(key => ({ ...key, time: key.time * Math.max(.01, duration) / Math.max(.01, track.duration) })) })} /><Toggle label={`Loop ${label}`} value={track.loop ?? false} onChange={loop => update(track, { loop })} /><Button onClick={() => {
          const keyTime = Math.min(track.duration, Math.max(0, time)), value = Number(runtime.parameters.getBase(track.target) ?? 0)
          update(track, { keyframes: [...track.keyframes.filter(key => key.time !== keyTime), { time: keyTime, value }] })
        }}>Set key at {Math.min(track.duration, time).toFixed(2)}s</Button></div>
        <details><summary>{track.keyframes.length} keyframes · edit values & easing</summary><div className="artinos-track-keys">{track.keyframes.map((key, index) => <div className="artinos-track-key" key={index}>
          <NumberField label={`Key ${index + 1} time`} value={key.time} min={0} max={track.duration} step={.01} onChange={nextTime => update(track, { keyframes: track.keyframes.map((item, i) => i === index ? { ...item, time: nextTime } : item).filter((item, i, all) => all.findIndex(other => other.time === item.time) === i) })} />
          <NumberField label={`Key ${index + 1} value`} value={key.value} min={definition?.min} max={definition?.max} step={definition?.step ?? .01} onChange={value => update(track, { keyframes: track.keyframes.map((item, i) => i === index ? { ...item, value } : item) })} />
          <Select label={`Key ${index + 1} easing`} value={key.easing ?? 'linear'} options={EASINGS} onChange={easing => update(track, { keyframes: track.keyframes.map((item, i) => i === index ? { ...item, easing } : item) })} />
          <Button disabled={track.keyframes.length <= 1} title={`Remove key ${index + 1}`} onClick={() => update(track, { keyframes: track.keyframes.filter((_, i) => i !== index) })}>Remove</Button>
        </div>)}</div></details>
      </article>
    })}</div>
  </div>
}

