import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  ChangeLog,
  ColorArea,
  ColorSlider,
  ColorSwatches,
  CurveControl,
  Dial,
  Empty,
  Envelope,
  GradientBar,
  GradientEditor,
  InstrumentMeter,
  KeyValue,
  Knob,
  LevelMeter,
  Note,
  Pane,
  Progress,
  Sparkline,
  StatusDisplay,
  ValueReadout,
  Waveform,
  XYPad,
  type CurveValue,
  type GradientValue,
} from '../../primitives'

/** Instruments and readouts — the controls that show a shape rather than a number. */
export function Instruments() {
  const [pad, setPad] = useState<[number, number]>([0.62, 0.4])
  const [drive, setDrive] = useState(0.68)
  const [mix, setMix] = useState(0.31)
  const [area, setArea] = useState<[number, number]>([0.62, 0.58])
  const [hue, setHue] = useState(171)
  const [swatch, setSwatch] = useState<string>('#40c7b0')
  const [curve, setCurve] = useState<CurveValue>({ points: [{ x: 0, y: 0 }, { x: 0.4, y: 0.7 }, { x: 1, y: 1 }] })
  const [gradient, setGradient] = useState<GradientValue>({
    kind: 'linear',
    angle: 90,
    stops: [
      { id: 'a', offset: 0, color: '#1b2720' },
      { id: 'b', offset: 0.5, color: '#5c7666' },
      { id: 'c', offset: 1, color: '#ebefe9' },
    ],
  })

  // A slow-moving buffer, so the signal displays are actually alive.
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setPhase(value => value + 1), 120)
    return () => window.clearInterval(id)
  }, [])
  const wave = useMemo(() => Array.from({ length: 64 }, (_, i) => Math.sin((i + phase) * 0.28) * 0.7 + Math.sin((i + phase) * 0.11) * 0.3), [phase])
  const trend = useMemo(() => Array.from({ length: 32 }, (_, i) => 50 + Math.sin((i + phase) * 0.2) * 22), [phase])
  const levels = useMemo(() => [0.5 + Math.sin(phase * 0.3) * 0.35, 0.5 + Math.sin(phase * 0.27 + 1) * 0.3], [phase])

  return (
    <>
      <p className="ui-studio-lead">
        <b>For creative work the value is a shape.</b> These read live and take their mechanics from the same kernel as
        the sliders, so precision, detents and keyboard nudges behave identically.
      </p>

      <Pane index={1} title="Planar and radial" meta="TWO AXES">
        <XYPad label="Offset" value={pad} onChange={setPad} />
        <Knob label="Drive" value={drive} onChange={setDrive} />
        <Knob label="Mix" value={mix} onChange={setMix} />
        <Dial label="Feedback" value={mix} onChange={setMix} />
      </Pane>

      <Pane index={2} title="Signal" meta="LIVE" variant="light">
        <Waveform label="Bass" samples={wave} />
        <Envelope label="Attack / decay" points={[{ time: 0, value: 0 }, { time: 0.2, value: 1 }, { time: 0.6, value: 0.4 }, { time: 1, value: 0 }]} />
        <InstrumentMeter label="Output" value={0.68} unit="dB" status="live" />
        <InstrumentMeter label="Headroom" value={0.86} status="warn" />
        <LevelMeter label="Levels" channels={levels} peak={[0.9, 0.82]} />
      </Pane>

      <Pane index={3} title="Curves and gradients" meta="EDITABLE">
        <CurveControl label="Response" value={curve} onChange={setCurve} />
        <GradientEditor label="Ramp" value={gradient} onChange={setGradient} />
        <GradientBar label="Stops" stops={[{ offset: 0, color: '#1b2720' }, { offset: 0.55, color: '#7fa890' }, { offset: 1, color: '#ebefe9' }]} />
      </Pane>

      <Pane index={4} title="Colour picking" meta="SEMANTIC">
        <ColorArea label="Saturation and lightness" value={area} hue={hue} onChange={setArea} />
        <ColorSlider label="Hue" value={hue} min={0} max={360} step={1} gradient="linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" onChange={setHue} />
        <ColorSwatches label="Palette" value={swatch} colors={['#40c7b0', '#8ed8c9', '#e6c48a', '#f0a0a0', '#a9c7e0']} onChange={value => setSwatch(String(value))} />
      </Pane>

      <Pane index={5} title="Readouts" meta="READ ONLY" footer={<><span>State is a word and a hue</span><span>DISPLAY</span></>}>
        <ValueReadout label="Frame rate" value={61.4} unit="fps" precision={1} status="live" />
        <StatusDisplay label="Backend" value="WEBGPU" tone="live" detail="RGBA16F" />
        <StatusDisplay label="Capture" value="DEGRADED" tone="warn" detail="backdrop only" />
        <KeyValue label="Colour space" value="ACEScg" />
        <KeyValue label="Environment" value="STUDIO_SOFT_4K" />
        <Progress label="Bake" value={0.68} />
        <Sparkline values={trend} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '4px 0' }}>
          <Badge>neutral</Badge>
          <Badge tone="accent">live</Badge>
          <Badge tone="warn">degraded</Badge>
          <Badge tone="danger">stopped</Badge>
        </div>
      </Pane>

      <Pane index={6} title="Quiet states" meta="EMPTY · NOTE · LOG">
        <Empty>No bindings yet — drag a parameter onto a controller channel.</Empty>
        <Note>These controls adjust every surface in this workbench.</Note>
        <ChangeLog>
          Transmission → 72%
          <br />
          Changes are shared across matching controls.
        </ChangeLog>
      </Pane>
    </>
  )
}
