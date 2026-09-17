import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Button,
  ChangeLog,
  Collapsible,
  ColorField,
  ColorRamp,
  DimensionField,
  Empty,
  Note,
  Pane,
  PinBar,
  SearchField,
  Segmented,
  Select,
  SelectionList,
  Slider,
  StatusDot,
  Tabs,
  Toggle,
  Toolbar,
  VectorField,
} from '../primitives'
import { AppBar } from '../shell/AppBar'
import './workbench.css'

/**
 * Workbench — UI PROTOTYPES/workbench.html rebuilt from the package's own components.
 *
 * It is the design system's acceptance test: the page must render identically to the
 * reference, and every surface on it is a public component with no page-specific
 * styling beyond the grid that places the panes.
 */

type Key =
  | 'transmission' | 'diffusion' | 'depth' | 'ior' | 'exposure' | 'temperature' | 'softness'
  | 'focal' | 'aperture' | 'focus' | 'rotation' | 'weight' | 'tracking' | 'frost' | 'radius' | 'density' | 'samples'

interface Spec {
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

const SPECS: Record<Key, Spec> = {
  transmission: { label: 'Transmission', min: 0, max: 100, step: 1, unit: '%' },
  diffusion: { label: 'Diffusion', min: 0, max: 1, step: 0.01 },
  depth: { label: 'Depth', min: 0, max: 10, step: 0.1, unit: 'mm' },
  ior: { label: 'Refraction', min: 1, max: 2, step: 0.01 },
  exposure: { label: 'Exposure', min: -3, max: 3, step: 0.1, unit: 'EV' },
  temperature: { label: 'Temperature', min: 2000, max: 10000, step: 100, unit: 'K' },
  softness: { label: 'Softness', min: 0, max: 100, step: 1, unit: '%' },
  focal: { label: 'Focal length', min: 18, max: 120, step: 1, unit: 'mm' },
  aperture: { label: 'Aperture', min: 1.2, max: 16, step: 0.1 },
  focus: { label: 'Focus', min: 0.1, max: 20, step: 0.1, unit: 'm' },
  rotation: { label: 'Rotation', min: 0, max: 180, step: 1, unit: '°' },
  weight: { label: 'Weight', min: 0, max: 100, step: 1 },
  tracking: { label: 'Tracking', min: 0, max: 10, step: 0.1 },
  frost: { label: 'Frost', min: 0, max: 40, step: 1, unit: 'px' },
  radius: { label: 'Radius', min: 3, max: 12, step: 1, unit: 'px' },
  density: { label: 'Row height', min: 24, max: 32, step: 1, unit: 'px' },
  samples: { label: 'Samples', min: 16, max: 512, step: 16 },
}

const INITIAL: Record<Key, number> = {
  transmission: 72, diffusion: 0.38, depth: 5.6, ior: 1.48, exposure: 1.2, temperature: 5600, softness: 64,
  focal: 50, aperture: 2.8, focus: 8, rotation: 24, weight: 55, tracking: 2, frost: 24, radius: 7, density: 26, samples: 128,
}

/** The folders a command-centre row sits in, so following a pin can open them. */
const FOLDERS_OF: Partial<Record<Key, string[]>> = {
  transmission: ['material'], diffusion: ['material'], depth: ['material'], ior: ['material', 'volume'],
  exposure: ['light'], temperature: ['light'], softness: ['light'],
  focal: ['camera'], aperture: ['camera'], focus: ['camera'], rotation: ['transform'],
}

/** Row names the filter matches against, per tab. */
const ROWS = {
  scene: ['preset', 'transmission', 'diffusion', 'depth', 'response', 'refraction', 'double side', 'exposure', 'temperature', 'softness', 'focal length', 'aperture', 'focus', 'rotation', 'live update'],
  appearance: ['frost', 'radius', 'row height', 'material'],
}

const BLUR_FOR: Record<string, number> = { Clear: 10, Frost: 24, Dense: 38 }
const SIZING = ['Fixed', 'Fill', 'Hug'] as const
type Sizing = (typeof SIZING)[number]

const CHOICES: Record<string, string | boolean> = {
  'command.preset': 'Neutral frost',
  'command.response': 'True',
  'command.doubleSide': true,
  'command.liveUpdate': true,
  'appearance.material': 'Frost',
  'surface.response': 'True',
  'surface.finish': 'Neutral frost',
  'lighting.mode': 'Area',
  'lighting.shadows': true,
  'camera.sensor': 'Full frame',
  'camera.dof': true,
  'typography.widthMode': 'Fixed',
  'typography.heightMode': 'Fixed',
  'typography.grow': 'Fixed',
  'color.space': 'Linear sRGB',
  'color.channel': 'RGB',
  'render.quality': 'Studio',
  'render.denoise': true,
  'render.output': 'Preview',
}

const OBJECTS = [
  { id: 'glass', label: 'Glass panel', meta: 'MESH / 01' },
  { id: 'light', label: 'Area light', meta: 'LIGHT / 02' },
  { id: 'camera', label: 'Studio camera', meta: 'CAM / 03' },
]

function formatted(key: Key, value: number): string {
  const { step, unit } = SPECS[key]
  const text = value.toFixed((String(step).split('.')[1] ?? '').length)
  if (!unit) return text
  return /^[%°]/.test(unit) ? text + unit : `${text} ${unit}`
}

export function Workbench({ backdrop, embedded }: { backdrop?: string; embedded?: boolean }) {
  const pageRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)

  const [values, setValues] = useState(INITIAL)
  const [pinned, setPinned] = useState<ReadonlySet<Key>>(() => new Set<Key>(['transmission', 'diffusion']))
  const [choices, setChoices] = useState(CHOICES)
  const [origin, setOrigin] = useState([0, 0, 0])
  const [transform, setTransform] = useState({ position: [0, 0, 0], scale: [1, 1, 1] })
  const [size, setSize] = useState({ width: 268, height: 268 })
  const [color, setColor] = useState('#94b6a4')
  const [selected, setSelected] = useState('glass')
  const [tab, setTab] = useState<'scene' | 'appearance'>('scene')
  const [query, setQuery] = useState('')
  const [reveal, setReveal] = useState<ReadonlySet<string>>(() => new Set())
  // Appearance values reach the tokens only once edited, so the stylesheet's own
  // responsive row height stays in charge until someone changes it.
  const [appearance, setAppearance] = useState<Partial<Record<'frost' | 'radius' | 'density', number>>>({})

  const [edits, setEdits] = useState(0)
  const [status, setStatus] = useState('Ready')
  const [log, setLog] = useState<ReactNode>(
    <>
      No edits yet.
      <br />
      Changes are shared across matching controls.
    </>,
  )

  const record = (message: ReactNode) => {
    setEdits(count => count + 1)
    setLog(message)
    setStatus('Modified')
  }

  const update = (key: Key, value: number) => {
    setValues(current => ({ ...current, [key]: value }))
    if (key === 'frost' || key === 'radius' || key === 'density') setAppearance(current => ({ ...current, [key]: value }))
  }

  const text = (id: string) => String(choices[id])
  const flag = (id: string) => choices[id] === true
  const choose = (id: string, label: string) => (value: string) => {
    setChoices(current => ({ ...current, [id]: value }))
    record(`${label} → ${value}`)
  }
  const flip = (id: string, label: string) => (on: boolean) => {
    setChoices(current => ({ ...current, [id]: on }))
    record(`${label} ${on ? 'on' : 'off'}`)
  }

  const slider = (key: Key, layout?: 'inline') => {
    const spec = SPECS[key]
    return (
      <Slider
        label={spec.label}
        value={values[key]}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        unit={spec.unit}
        defaultValue={INITIAL[key]}
        layout={layout}
        pinned={pinned.has(key)}
        onPinnedChange={on =>
          setPinned(current => {
            const next = new Set(current)
            if (on) next.add(key)
            else next.delete(key)
            return next
          })
        }
        onChange={value => {
          update(key, value)
          record(`${spec.label} → ${formatted(key, value)}`)
        }}
        onReset={() => setLog(`${spec.label} reset`)}
      />
    )
  }

  const q = query.toLowerCase().trim()
  const shows = (name: string) => !q || name.includes(q)
  const forced = (folder: string) => (q || reveal.has(folder) ? true : undefined)
  const noResults = Boolean(q) && !ROWS[tab].some(shows)

  const followPin = (key: Key) => {
    setTab('scene')
    setQuery('')
    setReveal(new Set(FOLDERS_OF[key] ?? []))
    requestAnimationFrame(() => {
      setReveal(new Set())
      const pane = pageRef.current?.querySelector('[data-variant="command"]')
      const row = [...(pane?.querySelectorAll('.artinos-slider') ?? [])].find(field => field.querySelector('.artinos-field-label')?.textContent === SPECS[key].label)
      row?.querySelector<HTMLElement>('.artinos-range')?.focus()
    })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || (event.target as Element | null)?.closest('input, select, textarea')) return
      event.preventDefault()
      filterRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const style = {
    ...(backdrop ? { '--wb-backdrop': `url("${backdrop}")` } : {}),
    ...(appearance.frost !== undefined ? { '--ui-blur': `${appearance.frost}px` } : {}),
    ...(appearance.radius !== undefined ? { '--ui-radius': `${appearance.radius}px` } : {}),
    ...(appearance.density !== undefined ? { '--ui-row': `${appearance.density}px` } : {}),
  } as CSSProperties

  const objectName = OBJECTS.find(item => item.id === selected)?.label ?? ''

  return (
    <div ref={pageRef} className="wb-page artinos-root" data-embedded={embedded ? '' : undefined} style={style}>
      {/* Inside the studio the page keeps its workspace and drops its chrome: the
          studio already supplies a bar, and two stacked bars read as a mistake. */}
      {!embedded && (
        <AppBar
          brand="ARTINOS"
          title="/ Command workbench"
          href="#"
          context="Courtyard / Material study / Local"
          nav={
            <>
              <a href="#instruments">Instrument collection</a>
              <a href="#glass">Glass collection</a>
            </>
          }
        />
      )}

      <main className="wb-workspace">
        <Pane
          as="aside"
          variant="command"
          index={1}
          title="Metablock"
          meta="COMMAND CENTER"
          toolbar={
            <>
              <Tabs
                label="Inspector"
                value={tab}
                items={[
                  { id: 'scene', label: 'Scene' },
                  { id: 'appearance', label: 'Appearance' },
                ]}
                onChange={next => {
                  setTab(next as 'scene' | 'appearance')
                  setQuery('')
                }}
              />
              <SearchField value={query} placeholder="Filter parameters…" label="Filter inspector parameters" shortcut="/" inputRef={filterRef} onChange={setQuery} />
              <PinBar items={[...pinned].map(key => ({ id: key, label: SPECS[key].label }))} onSelect={id => followPin(id as Key)} />
            </>
          }
          footer={
            <>
              <StatusDot>{status}</StatusDot>
              <span>LOCAL / SHARED VALUES</span>
            </>
          }
        >
          {tab === 'scene' ? (
            <div role="tabpanel" aria-label="Scene">
              <Collapsible title="Material" open={forced('material')}>
                {shows('preset') && <Select label="Preset" value={text('command.preset')} options={['Neutral frost', 'Clear optical', 'Fine satin']} onChange={choose('command.preset', 'Preset')} />}
                {shows('transmission') && slider('transmission')}
                {shows('diffusion') && slider('diffusion')}
                {shows('depth') && slider('depth')}
                {shows('response') && <Segmented label="Response" value={text('command.response')} options={['Soft', 'True', 'Exact']} onChange={choose('command.response', 'Response')} />}
                <Collapsible title="Volume" defaultOpen={false} open={forced('volume')}>
                  {shows('refraction') && slider('ior')}
                  {shows('double side') && <Toggle label="Double side" value={flag('command.doubleSide')} onChange={flip('command.doubleSide', 'Double side')} />}
                </Collapsible>
              </Collapsible>
              <Collapsible title="Light" open={forced('light')}>
                {shows('exposure') && slider('exposure')}
                {shows('temperature') && slider('temperature')}
                {shows('softness') && slider('softness')}
              </Collapsible>
              <Collapsible title="Camera" open={forced('camera')}>
                {shows('focal length') && slider('focal')}
                {shows('aperture') && slider('aperture')}
                {shows('focus') && slider('focus')}
              </Collapsible>
              <Collapsible title="Transform" defaultOpen={false} open={forced('transform')}>
                <VectorField label="Origin" value={origin} onChange={next => { setOrigin(next); record(`Origin → ${next.join(', ')}`) }} />
                {shows('rotation') && slider('rotation')}
              </Collapsible>
              {shows('live update') && <Toggle label="Live update" value={flag('command.liveUpdate')} onChange={flip('command.liveUpdate', 'Live update')} />}
            </div>
          ) : (
            <div role="tabpanel" aria-label="Appearance">
              <Collapsible title="Surface" open={forced('surface')}>
                {shows('frost') && slider('frost')}
                {shows('radius') && slider('radius')}
                {shows('row height') && slider('density')}
              </Collapsible>
              <Note>These controls adjust every surface in this workbench.</Note>
              {shows('material') && (
                <Segmented
                  label="Material"
                  value={text('appearance.material')}
                  options={['Clear', 'Frost', 'Dense']}
                  onChange={(value: string) => {
                    choose('appearance.material', 'Material')(value)
                    update('frost', BLUR_FOR[value])
                  }}
                />
              )}
            </div>
          )}
          {noResults && <Empty>No matching parameters</Empty>}
        </Pane>

        <section className="wb-canvas" aria-label="Tool surfaces">
          <div className="wb-canvas-bar">
            <span>
              Scene / <b style={{ fontWeight: 500 }}>{objectName}</b>
            </span>
            <small>8 tool panels · linked parameters</small>
          </div>
          <div className="wb-canvas-grid">
            <Pane index={2} title="Surface" meta="OPTICAL" variant="material">
              {slider('transmission', 'inline')}
              {slider('diffusion', 'inline')}
              {slider('depth', 'inline')}
              <Segmented label="Response" value={text('surface.response')} options={['Soft', 'True', 'Exact']} onChange={choose('surface.response', 'Response')} />
              <Select label="Finish" value={text('surface.finish')} options={['Neutral frost', 'Clear optical', 'Satin']} onChange={choose('surface.finish', 'Finish')} />
            </Pane>

            <Pane index={3} title="Lighting" meta="STUDIO" variant="light">
              {slider('exposure')}
              {slider('temperature')}
              {slider('softness')}
              <Segmented label="Mode" value={text('lighting.mode')} options={['Area', 'Point', 'Sun']} onChange={choose('lighting.mode', 'Mode')} />
              <Toggle label="Shadows" value={flag('lighting.shadows')} onChange={flip('lighting.shadows', 'Shadows')} />
            </Pane>

            <Pane index={4} title="Camera" meta="PERSPECTIVE" variant="camera">
              {slider('focal')}
              {slider('aperture')}
              {slider('focus')}
              <Select label="Sensor" value={text('camera.sensor')} options={['Full frame', 'Super 35', 'Micro 4/3']} onChange={choose('camera.sensor', 'Sensor')} />
              <Toggle label="Depth of field" value={flag('camera.dof')} onChange={flip('camera.dof', 'Depth of field')} />
            </Pane>

            <Pane index={5} title="Transform" meta="WORLD">
              <VectorField label="Position" value={transform.position} onChange={position => { setTransform(current => ({ ...current, position })); record(`Position → ${position.join(', ')}`) }} />
              <VectorField label="Scale" value={transform.scale} onChange={scale => { setTransform(current => ({ ...current, scale })); record(`Scale → ${scale.join(', ')}`) }} />
              {slider('rotation')}
              <Toolbar fill>
                <Button
                  onClick={() => {
                    setTransform({ position: [0, 0, 0], scale: [1, 1, 1] })
                    update('rotation', INITIAL.rotation)
                    record('Reset transform')
                  }}
                >
                  Reset transform
                </Button>
                <Button
                  onClick={() => {
                    setTransform(current => ({ ...current, position: [0, 0, 0] }))
                    record('Zero position')
                  }}
                >
                  Zero position
                </Button>
              </Toolbar>
            </Pane>

            <Pane index={6} title="Typography" meta="LAYOUT" variant="typography">
              {slider('weight')}
              {slider('tracking')}
              <DimensionField<Sizing>
                label="Width"
                value={size.width}
                mode={text('typography.widthMode') as Sizing}
                modes={SIZING}
                onChange={width => { setSize(current => ({ ...current, width })); record(`Width → ${width}`) }}
                onModeChange={choose('typography.widthMode', 'Width sizing')}
              />
              <DimensionField<Sizing>
                label="Height"
                value={size.height}
                mode={text('typography.heightMode') as Sizing}
                modes={SIZING}
                onChange={height => { setSize(current => ({ ...current, height })); record(`Height → ${height}`) }}
                onModeChange={choose('typography.heightMode', 'Height sizing')}
              />
              <Segmented label="Grow" value={text('typography.grow')} options={[...SIZING]} onChange={choose('typography.grow', 'Grow')} />
            </Pane>

            <Pane index={7} title="Color" meta="MATERIAL">
              <ColorField label="Material color" hideLabel value={color} onChange={next => { setColor(next); record(`Material color → ${next}`) }} />
              <Select label="Space" value={text('color.space')} options={['Linear sRGB', 'Display P3', 'ACEScg']} onChange={choose('color.space', 'Space')} />
              <Segmented label="Channel" value={text('color.channel')} options={['RGB', 'R', 'G', 'B']} onChange={choose('color.channel', 'Channel')} />
              <ColorRamp label="Reference neutral green ramp" labels={['SHADOW', 'REFERENCE RAMP', 'LIGHT']} />
            </Pane>

            <Pane index={8} title="Evaluation" meta="PREVIEW" variant="render">
              {slider('samples')}
              <Segmented label="Quality" value={text('render.quality')} options={['Draft', 'Studio', 'Final']} onChange={choose('render.quality', 'Quality')} />
              <Toggle label="Denoise" value={flag('render.denoise')} onChange={flip('render.denoise', 'Denoise')} />
              <Select label="Output" value={text('render.output')} options={['Preview', 'Still frame', 'Sequence']} onChange={choose('render.output', 'Output')} />
              <footer className="artinos-pane-foot" style={{ padding: '6px 0 0', border: 0 }}>
                <span>Local visual study</span>
                <span>No render engine</span>
              </footer>
            </Pane>

            <Pane index={9} title="Selection" meta="SCENE">
              <SelectionList
                label="Scene selection"
                items={OBJECTS}
                value={selected}
                onChange={id => {
                  setSelected(id)
                  record(`Selected ${OBJECTS.find(item => item.id === id)?.label}`)
                }}
              />
              <ChangeLog>{log}</ChangeLog>
            </Pane>
          </div>
        </section>

        <Pane
          variant="dock"
          className="wb-dock"
          index={10}
          title="Parameter dock"
          actions={<span>Pinned + recent</span>}
          meta="SURFACE / SHARED WITH INSPECTOR"
          footer={
            <>
              <span>Scene / Glass panel</span>
              <span>{edits} edits</span>
            </>
          }
        >
          {slider('transmission')}
          {slider('diffusion')}
          {slider('depth')}
          {slider('exposure')}
          {slider('rotation')}
        </Pane>
      </main>

      <div className="wb-status">
        <span>10 command surfaces · All values are local prototype controls</span>
        <span>Drag to adjust · Arrow keys for precision · Double-click to reset</span>
      </div>
    </div>
  )
}
