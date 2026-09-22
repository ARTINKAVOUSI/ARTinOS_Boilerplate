import { useState } from 'react'
import {
  Checkbox,
  Collapsible,
  ColorField,
  ColorRamp,
  DimensionField,
  NumberField,
  Pane,
  PinBar,
  RangeSlider,
  SearchField,
  Segmented,
  Select,
  Slider,
  Tabs,
  TextArea,
  TextField,
  Toggle,
  VectorField,
} from '../../primitives'

const SIZING = ['Fixed', 'Fill', 'Hug'] as const

/** Controls — every input the kit ships, live and in the rows they live in. */
export function Controls() {
  const [exposure, setExposure] = useState(1.2)
  const [transmission, setTransmission] = useState(72)
  const [depth, setDepth] = useState(5.6)
  const [focal, setFocal] = useState(50)
  const [samples, setSamples] = useState(128)
  const [clip, setClip] = useState<[number, number]>([0.2, 0.78])
  const [pinned, setPinned] = useState(true)
  const [response, setResponse] = useState('True')
  const [quality, setQuality] = useState('Studio')
  const [preset, setPreset] = useState('Neutral frost')
  const [live, setLive] = useState(true)
  const [denoise, setDenoise] = useState(true)
  const [locked, setLocked] = useState(false)
  const [tab, setTab] = useState('scene')
  const [name, setName] = useState('Studio scene 04')
  const [notes, setNotes] = useState('Bake at 512 samples before publishing.')
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState([0, 1.2, -3])
  const [width, setWidth] = useState(268)
  const [sizing, setSizing] = useState<(typeof SIZING)[number]>('Fixed')
  const [tint, setTint] = useState('#94b6a4')

  return (
    <>
      <p className="ui-studio-lead">
        <b>The row is the unit.</b> A name, a control and a trailing column — a pin, a unit, or nothing. Drag a track
        anywhere along its length, hold <b>Shift</b> for precision, press <b>Enter</b> to type a value, double-click to
        reset it.
      </p>

      <Pane index={1} title="Numeric" meta="DRAG · TYPE · NUDGE" footer={<><span>Kernel mechanics</span><span>PRECISION · DETENTS · INERTIA</span></>}>
        <Slider label="Exposure" value={exposure} min={-3} max={3} step={0.1} unit="EV" defaultValue={1.2} pinned={pinned} onPinnedChange={setPinned} onChange={setExposure} />
        <Slider label="Transmission" value={transmission} min={0} max={100} step={1} unit="%" defaultValue={72} onChange={setTransmission} />
        <Slider label="Depth" value={depth} min={0} max={10} step={0.1} unit="mm" defaultValue={5.6} detents={[2.5, 5, 7.5]} onChange={setDepth} />
        <Slider label="Bound" value={focal} min={18} max={120} step={1} unit="mm" binding="MIDI 21" status="bound" onChange={setFocal} />
        <Slider label="Read only" value={samples} min={16} max={512} step={16} disabled onChange={setSamples} />
        <NumberField label="Samples" value={samples} min={16} max={512} step={16} onChange={setSamples} />
        <RangeSlider label="Clip range" value={clip} min={0} max={1} step={0.01} onChange={setClip} />
      </Pane>

      <Pane index={2} title="Inline and stacked" meta="LAYOUTS" variant="material">
        <Slider label="Transmission" value={transmission} min={0} max={100} step={1} unit="%" layout="inline" onChange={setTransmission} />
        <Slider label="Depth" value={depth} min={0} max={10} step={0.1} unit="mm" layout="inline" onChange={setDepth} />
        <Slider label="Exposure" value={exposure} min={-3} max={3} step={0.1} unit="EV" layout="stack" pinned={pinned} onPinnedChange={setPinned} onChange={setExposure} />
      </Pane>

      <Pane index={3} title="Ticked track" meta="CAMERA" variant="camera">
        <Slider label="Focal length" value={focal} min={18} max={120} step={1} unit="mm" onChange={setFocal} />
        <Slider label="Aperture" value={2.8} min={1.2} max={16} step={0.1} onChange={() => {}} />
      </Pane>

      <Pane index={4} title="Choice" meta="STATE IS NEVER COLOUR ALONE">
        <Segmented label="Response" value={response} options={['Soft', 'True', 'Exact']} onChange={setResponse} />
        <Segmented label="Quality" value={quality} options={['Draft', 'Studio', 'Final']} onChange={setQuality} />
        <Select label="Preset" value={preset} options={['Neutral frost', 'Clear optical', 'Fine satin']} onChange={setPreset} />
        <Toggle label="Live update" value={live} onChange={setLive} />
        <Toggle label="Denoise" value={denoise} onChange={setDenoise} />
        <Toggle label="Locked" value={locked} description="Disabled example" disabled onChange={setLocked} />
        <div style={{ display: 'flex', gap: 12, padding: '4px 0' }}>
          <Checkbox label="Denoise" value={denoise} onChange={setDenoise} />
          <Checkbox label="Motion blur" value={false} onChange={() => {}} />
          <Checkbox label="GPU" value onChange={() => {}} />
        </div>
      </Pane>

      <Pane
        index={5}
        title="Tabs, search and pins"
        meta="NAVIGATION"
        toolbar={
          <>
            <Tabs
              label="Sections"
              value={tab}
              items={[
                { id: 'scene', label: 'Scene' },
                { id: 'appearance', label: 'Appearance' },
                { id: 'render', label: 'Render' },
              ]}
              onChange={setTab}
            />
            <SearchField value={query} placeholder="Filter parameters…" shortcut="/" onChange={setQuery} />
            <PinBar items={[{ id: 'exposure', label: 'Exposure' }, { id: 'depth', label: 'Depth' }]} onSelect={() => {}} />
          </>
        }
      >
        <TextField label="Name" value={name} onChange={setName} />
        <TextArea label="Notes" value={notes} rows={3} onChange={setNotes} />
      </Pane>

      <Pane index={6} title="Folders" meta="NESTING">
        <Collapsible title="Material">
          <Slider label="Transmission" value={transmission} min={0} max={100} step={1} unit="%" onChange={setTransmission} />
          <Collapsible title="Volume" defaultOpen={false}>
            <Slider label="Refraction" value={1.48} min={1} max={2} step={0.01} onChange={() => {}} />
            <Toggle label="Double side" value onChange={() => {}} />
          </Collapsible>
        </Collapsible>
        <Collapsible title="Light" defaultOpen={false}>
          <Slider label="Exposure" value={exposure} min={-3} max={3} step={0.1} unit="EV" onChange={setExposure} />
        </Collapsible>
      </Pane>

      <Pane index={7} title="Vector and size" meta="COMPOSITES">
        <VectorField label="Position" value={position} onChange={setPosition} />
        <DimensionField<(typeof SIZING)[number]> label="Width" value={width} mode={sizing} modes={SIZING} onChange={setWidth} onModeChange={setSizing} />
      </Pane>

      <Pane index={8} title="Colour" meta="MATERIAL" variant="typography">
        <ColorField label="Tint" value={tint} onChange={setTint} />
        <ColorField label="Swatch" value={tint} hideLabel onChange={setTint} />
        <ColorRamp label="Reference ramp" labels={['SHADOW', 'REFERENCE RAMP', 'LIGHT']} />
      </Pane>
    </>
  )
}
