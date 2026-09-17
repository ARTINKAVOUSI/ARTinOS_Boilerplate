import { useState } from 'react'
import {
  Button,
  ColorField,
  DimensionField,
  HueBar,
  IconButton,
  MicroReadout,
  MicroReadoutRow,
  Pane,
  Section,
  Segmented,
  Select,
  Slider,
  StatusDot,
  Tabs,
  Toggle,
  Toolbar,
  VectorField,
} from '../../primitives'

const SIZING = ['Fixed', 'Fill', 'Hug'] as const
type Sizing = (typeof SIZING)[number]

function ResetGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

/** A swatch picked off the hue rail, at the reference's saturation and lightness. */
function hueToHex(hue: number, saturation = 0.34, lightness = 0.64): string {
  const a = saturation * Math.min(lightness, 1 - lightness)
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12
    const c = lightness - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

const OPTICAL = {
  transmission: 72,
  diffusion: 0.38,
  depth: 5.6,
  refraction: 1.48,
  roughness: 0.14,
  exposure: 1.2,
  temperature: 5600,
  softness: 64,
}

/**
 * Core — `VISUAL_REFERENCES/artinos-core-ui.html` rebuilt from the kit's own
 * components: the Optical body and Studio camera panels, value for value. It is
 * the design system's acceptance page — measured against the reference, it has
 * to match it.
 */
export function Core() {
  const [tab, setTab] = useState('scene')
  const [optical, setOptical] = useState(OPTICAL)
  const set = (key: keyof typeof OPTICAL) => (value: number) => setOptical(previous => ({ ...previous, [key]: value }))
  const [response, setResponse] = useState('Balanced')
  const [finish, setFinish] = useState('Neutral frost')
  const [exposureBound, setExposureBound] = useState(false)
  const [temperatureBound, setTemperatureBound] = useState(true)
  const [width, setWidth] = useState(268)
  const [widthMode, setWidthMode] = useState<Sizing>('Fixed')
  const [height, setHeight] = useState(268)
  const [heightMode, setHeightMode] = useState<Sizing>('Fixed')
  const [grow, setGrow] = useState<string>('Fill')
  const [origin, setOrigin] = useState([0, 0, 0])
  const [hue, setHue] = useState(187)
  const [swatch, setSwatch] = useState('#8dbbb4')
  const [liveUpdate, setLiveUpdate] = useState(true)
  const [enabled, setEnabled] = useState(true)

  const [focal, setFocal] = useState(50)
  const [aperture, setAperture] = useState(2.8)
  const [focus, setFocus] = useState(8)
  const [position, setPosition] = useState([0, 1.6, 4.2])
  const [scale, setScale] = useState([1, 1, 1])
  const [rotation, setRotation] = useState(90)
  const [samples, setSamples] = useState(336)
  const [quality, setQuality] = useState('Final')
  const [denoise, setDenoise] = useState(true)
  const [output, setOutput] = useState('Preview')
  const [ratio, setRatio] = useState(0.38)
  const [frame, setFrame] = useState(12.4)
  const [fps, setFps] = useState(98)
  const [ior, setIor] = useState(1.48)

  return (
    <div className="ui-core-stage">
      <Pane
        className="ui-core-optical"
        title="Optical body"
        meta="Material / Surface response"
        status="live"
        actions={
          <IconButton title="Reset all" onClick={() => setOptical(OPTICAL)}>
            <ResetGlyph />
          </IconButton>
        }
        toolbar={
          <Tabs
            label="Optical body"
            value={tab}
            items={[
              { id: 'scene', label: 'Scene' },
              { id: 'studio', label: 'Studio' },
              { id: 'detail', label: 'Detail' },
            ]}
            onChange={setTab}
          />
        }
        footer={
          <>
            <StatusDot tone="modified">Modified</StatusDot>
            <span>Local / shared values</span>
          </>
        }
      >
        <Section title="Material">
          <Slider label="Transmission" value={optical.transmission} min={0} max={100} step={1} unit="%" defaultValue={72} onChange={set('transmission')} />
          <Slider label="Diffusion" value={optical.diffusion} min={0} max={1} step={0.01} defaultValue={0.38} onChange={set('diffusion')} />
          <Slider label="Depth" value={optical.depth} min={0} max={20} step={0.1} unit="mm" defaultValue={5.6} onChange={set('depth')} />
          <Slider label="Refraction" value={optical.refraction} min={1} max={2.4} step={0.01} defaultValue={1.48} onChange={set('refraction')} />
          <Slider label="Roughness" value={optical.roughness} min={0} max={1} step={0.01} defaultValue={0.14} onChange={set('roughness')} />
          <Segmented label="Response" value={response} options={['Soft', 'Balanced', 'Exact']} onChange={setResponse} />
          <Select label="Finish" value={finish} options={['Neutral frost', 'Clear optical', 'Satin porcelain', 'Mineral opal']} onChange={setFinish} />
        </Section>

        <Section title="Light">
          <Slider label="Exposure" value={optical.exposure} min={-4} max={4} step={0.1} unit="EV" defaultValue={1.2} pinned={exposureBound} onPinnedChange={setExposureBound} onChange={set('exposure')} />
          <Slider label="Temperature" value={optical.temperature} min={2000} max={10000} step={50} unit="K" defaultValue={5600} pinned={temperatureBound} onPinnedChange={setTemperatureBound} onChange={set('temperature')} />
          <Slider label="Softness" value={optical.softness} min={0} max={100} step={1} unit="%" size="compact" defaultValue={64} onChange={set('softness')} />
        </Section>

        <Section title="Geometry">
          <DimensionField<Sizing> label="Width" value={width} mode={widthMode} modes={SIZING} step={1} onChange={setWidth} onModeChange={setWidthMode} />
          <DimensionField<Sizing> label="Height" value={height} mode={heightMode} modes={SIZING} step={1} onChange={setHeight} onModeChange={setHeightMode} />
          <Segmented label="Grow" value={grow} options={[...SIZING]} onChange={setGrow} />
          <VectorField label="Origin" value={origin} step={0.01} onChange={setOrigin} />
        </Section>

        <Section title="Colour">
          <HueBar
            label="Hue"
            value={hue}
            onChange={next => {
              setHue(next)
              setSwatch(hueToHex(next))
            }}
          />
          <ColorField label="Swatch" value={swatch} hideLabel onChange={setSwatch} />
        </Section>

        <Section title="Utility">
          <Toggle label="Live update" value={liveUpdate} onChange={setLiveUpdate} />
          <Toggle label="Enabled" value={enabled} onChange={setEnabled} />
        </Section>
      </Pane>

      <Pane
        className="ui-core-camera"
        title="Studio camera"
        meta="Scene / Transform · Evaluation"
        status="live"
        footer={
          <>
            <StatusDot>Ready</StatusDot>
            <span>No render engine</span>
          </>
        }
      >
        <Section title="Camera">
          <Slider label="Focal length" value={focal} min={12} max={200} step={1} unit="mm" defaultValue={50} onChange={setFocal} />
          <Slider label="Aperture" value={aperture} min={1.2} max={22} step={0.1} unit="f" defaultValue={2.8} onChange={setAperture} />
          <Slider label="Focus" value={focus} min={0.2} max={40} step={0.1} unit="m" defaultValue={8} onChange={setFocus} />
        </Section>

        <Section title="Transform">
          <VectorField label="Position" value={position} step={0.01} onChange={setPosition} />
          <VectorField label="Scale" value={scale} step={0.01} onChange={setScale} />
          <Slider label="Rotation" value={rotation} min={-180} max={180} step={1} unit="°" defaultValue={0} onChange={setRotation} />
          <Toolbar fill>
            <Button
              onClick={() => {
                setPosition([0, 0, 0])
                setScale([1, 1, 1])
                setRotation(0)
              }}
            >
              Reset transform
            </Button>
            <Button onClick={() => setPosition([0, 0, 0])}>Zero position</Button>
          </Toolbar>
        </Section>

        <Section title="Evaluation">
          <Slider label="Samples" value={samples} min={16} max={1024} step={8} defaultValue={336} onChange={setSamples} />
          <Segmented label="Quality" value={quality} options={['Draft', 'Studio', 'Final']} onChange={setQuality} />
          <Toggle label="Denoise" value={denoise} onChange={setDenoise} />
          <Select label="Output" value={output} options={['Preview', 'Beauty', 'Cryptomatte']} onChange={setOutput} />
        </Section>

        <Section title="Readout">
          <MicroReadoutRow>
            <MicroReadout label="Ratio" value={ratio} precision={2} onChange={setRatio} />
            <MicroReadout label="Frame time" value={frame} precision={1} unit="ms" onChange={setFrame} />
            <MicroReadout label="Frame rate" value={fps} precision={0} unit="fps" onChange={setFps} />
            <MicroReadout label="Index of refraction" value={ior} precision={2} onChange={setIor} />
          </MicroReadoutRow>
        </Section>
      </Pane>
    </div>
  )
}
