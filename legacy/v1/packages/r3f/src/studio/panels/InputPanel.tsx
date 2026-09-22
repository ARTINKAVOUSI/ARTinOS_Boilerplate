import { useRef, useState, useSyncExternalStore } from 'react'
import { useInputs } from '@artinos/inputflow'
import { Button, FileField, KeyValue, Meter, Section, useSignals } from '../foundation'

export function InputPanel() {
  const input = useInputs(), signals = useSignals(), rec = input.recorder
  useSyncExternalStore(callback => rec.subscribe(callback), () => rec.revision, () => 0)
  const snapshot = rec.snapshot(), fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')
  const n = (id: string) => Number(signals.find(signal => signal.id === id)?.value ?? 0)
  const run = async (action: () => unknown) => { try { await action(); setNotice('') } catch (error) { setNotice(error instanceof Error ? error.message : 'The input could not be started. Check device access and try again.') } }
  const download = () => {
    const url = URL.createObjectURL(new Blob([rec.export()], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'artinos-signals.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return <>
    {notice && <div className="artinos-panel-notice is-error" role="alert">{notice}</div>}
    <div className="artinos-input-grid">
      <Section title="Connected devices" description="Start a source, then inspect its output in Signals.">
        <Device name="Pointer / Touch / Pen" state={input.status.pointer} />
        <Device name="Keyboard" state={input.status.keyboard} />
        <Device name="Gamepads" state={input.status.gamepad} />
        <Device name="Microphone / Audio" state={input.status.audio} on={() => run(() => input.enableAudio())} off={() => input.disableAudio()} />
        <FileField label="Use an audio file" accept="audio/*" onFiles={files => { if (files[0]) void run(() => input.enableAudioFile(files[0])) }} />
        <Device name="Webcam / Vision" state={input.status.camera} on={() => run(() => input.enableCamera())} off={() => input.disableCamera()} />
        <Device name="Hand / Face / Pose tracking" state={input.status.advancedVision} on={() => run(() => input.enableAdvancedVision())} off={() => input.disableAdvancedVision()} />
        <Device name="MIDI" state={input.status.midi} on={() => run(() => input.enableMidi())} />
        <Device name="Orientation" state={input.status.orientation} on={() => run(() => input.enableOrientation())} off={() => input.disableOrientation()} />
      </Section>
      <Section title="Audio monitor" description={input.status.audio === 'on' ? 'Live frequency bands and energy.' : 'Enable a microphone or choose a file to see live levels.'}>
        {['rms', 'peak', 'envelope', 'sub', 'bass', 'lowMid', 'mid', 'highMid', 'high', 'beat'].map(band => <Meter key={band} label={band.replace(/([A-Z])/g, ' $1').toUpperCase()} value={n(`audio.${band}`)} />)}
      </Section>
      <Section title="Vision monitor" description={input.status.camera === 'on' || input.status.advancedVision === 'on' ? 'Live movement and tracking features.' : 'Enable webcam or tracking to begin.'}>
        <Meter label="Motion" value={n('vision.motion.energy')} /><Meter label="Luminance" value={n('vision.luminance')} />
        <KeyValue label="Hands / faces / poses" value={`${n('vision.hand.count')} / ${n('vision.face.count')} / ${n('vision.pose.count')}`} />
        <Meter label="Left pinch" value={n('vision.hand.left.pinch')} /><Meter label="Right pinch" value={n('vision.hand.right.pinch')} />
        <Meter label="Smile" value={n('vision.face.smile')} /><Meter label="Mouth open" value={n('vision.face.mouthOpen')} />
      </Section>
      <Section title="Record & replay" description="Capture input values and replay the same session.">
        <KeyValue label="Samples" value={snapshot.samples.length} /><KeyValue label="Duration" value={`${snapshot.duration.toFixed(2)} s`} />
        <p className="artinos-device-note">{rec.isRecording() ? 'Recording live signals…' : rec.isReplaying() ? 'Replaying recorded signals…' : snapshot.samples.length ? 'Recording ready to replay or export.' : 'Start recording to capture incoming signals.'}</p>
        <div className="artinos-button-row">
          <Button active={rec.isRecording()} onClick={() => rec.isRecording() ? rec.stop() : rec.start()}>{rec.isRecording() ? 'Stop recording' : 'Record'}</Button>
          <Button disabled={!snapshot.samples.length || rec.isRecording()} active={rec.isReplaying()} onClick={() => rec.isReplaying() ? rec.stopReplay() : rec.play(snapshot)}>{rec.isReplaying() ? 'Stop replay' : 'Replay'}</Button>
          <Button disabled={!snapshot.samples.length || rec.isRecording()} onClick={download}>Export</Button>
          <Button disabled={rec.isRecording()} onClick={() => fileInput.current?.click()}>Import</Button>
          <Button disabled={!snapshot.samples.length || rec.isRecording()} onClick={() => rec.clear()}>Clear</Button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(async () => rec.import(await file.text())) }} />
      </Section>
    </div>
  </>
}
function Device({ name, state, on, off }: { name: string; state: string; on?: () => unknown; off?: () => unknown }) {
  const active = state === 'on', pending = state === 'requesting'
  return <div className="artinos-device"><span><b>{name}</b><small className={`state-${state}`}>{pending ? 'Waiting for device access…' : active ? 'Connected' : state === 'off' ? 'Not connected' : state === 'error' ? 'Connection failed. Check device permissions and retry.' : state}</small></span>{on && <Button disabled={pending || (active && !off)} active={active} onClick={() => { if (active && off) off(); else on() }}>{pending ? 'Connecting…' : active ? off ? 'Disconnect' : 'Connected' : 'Connect'}</Button>}</div>
}
