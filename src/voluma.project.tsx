import { useEffect, useMemo, useRef, useState } from 'react'
import { defineArtinosProject } from '@artinos/r3f'
import {
  useArtinosRuntime,
  useParameter,
  useResolvedParameter,
  useSignal,
  useTelemetryMetric,
  type ParameterDefinition,
} from '@artinos/runtime'
import {
  Activity,
  AudioLines,
  Box,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Command,
  Download,
  Droplets,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  Maximize2,
  Mic2,
  MousePointer2,
  Pause,
  Play,
  Radio,
  Redo2,
  RotateCcw,
  Settings2,
  Sparkles,
  Undo2,
  Upload,
  Video,
  Volume2,
  Waves,
  Wind,
  X,
} from 'lucide-react'
import { BoxGeometry, DoubleSide, MathUtils } from 'three/webgpu'
import { useThree } from '@react-three/fiber'
import type { GraphDefinition } from '@artinos/graph'
import { VolumetricFluid, type FluidRuntimeDefinitions } from './voluma-fluid'
import { DemoAudioEngine } from './voluma-audio'
import { AudioReactor, ForceField, PointerSculptor, SpeciesPalette, VolumeEmitter, VolumetricTank } from './voluma-authoring'
import { NumberField } from '@artinos/ui'
import { useFocusScope } from '@artinos/ui/headless'
import './voluma.css'

type NumberDef = ParameterDefinition<number>

function RendererBudget() {
  const setDpr = useThree(state => state.setDpr)
  useEffect(() => { setDpr(.8) }, [setDpr])
  return null
}

const defs = {
  playing: { id: 'voluma.transport.playing', label: 'Simulation', type: 'boolean', defaultValue: true, group: 'Transport' },
  emitterEnabled: { id: 'voluma.emitter.enabled', label: 'Emitter Enabled', type: 'boolean', defaultValue: true, group: 'Emitter' },
  carrier: { id: 'voluma.carrier', label: 'Carrier', type: 'enum', defaultValue: 'clear-water', options: [
    { label: 'Clear Water', value: 'clear-water' }, { label: 'Viscous Water', value: 'viscous-water' }, { label: 'Oil Bath', value: 'oil-bath' }, { label: 'Gel', value: 'gel' }, { label: 'Thin Mist', value: 'thin-mist' }, { label: 'Dense Fog', value: 'dense-fog' }, { label: 'Smoke Air', value: 'smoke-air' }, { label: 'Slow Resin', value: 'resin-slow' }, { label: 'Custom', value: 'custom' },
  ], group: 'Carrier' },
  species: { id: 'voluma.species', label: 'Current Paint', type: 'enum', defaultValue: 'cyan-ink', options: [
    { label: 'Cyan Ink', value: 'cyan-ink' }, { label: 'Magenta Dye', value: 'magenta-dye' }, { label: 'Milk Cloud', value: 'milk' }, { label: 'Oil Gold', value: 'oil-gold' }, { label: 'Neon Orchid', value: 'neon-orchid' },
    { label: 'Watercolor', value: 'watercolor' }, { label: 'Dense Paint', value: 'dense-paint' }, { label: 'Acrylic', value: 'acrylic' }, { label: 'Smoke', value: 'smoke' }, { label: 'Pearl Lacquer', value: 'pearl-lacquer' },
  ], group: 'Materials' },
  emitterPattern: { id: 'voluma.emitter.pattern', label: 'Emitter Stack', type: 'enum', defaultValue: 'single', options: [
    { label: 'Single Ring', value: 'single' }, { label: 'Twin Braid', value: 'twin' }, { label: 'Downward Mushrooms', value: 'downward' }, { label: 'Orbital Vapor', value: 'orbit' }, { label: 'Pearl Ribbon', value: 'ribbon' }, { label: 'Spectrum Sculpture', value: 'spectrum' }, { label: 'Fog Bed', value: 'fog' }, { label: 'Macro Tendril', value: 'tendril' },
  ], group: 'Emitter' },
  quality: { id: 'voluma.quality', label: 'Quality', type: 'enum', defaultValue: 'draft', options: [
    { label: 'Draft · 64³', value: 'draft' }, { label: 'Live · 96³', value: 'live' }, { label: 'Studio · 128³', value: 'studio' }, { label: 'Hero · 160³', value: 'hero' },
  ], group: 'Simulation' },
  interaction: { id: 'voluma.interaction', label: 'Pointer Mode', type: 'enum', defaultValue: 'vortex', options: [
    { label: 'Stir', value: 'stir' }, { label: 'Inject', value: 'inject' }, { label: 'Vortex', value: 'vortex' }, { label: 'Pull', value: 'pull' },
  ], group: 'Interaction' },
  debugView: { id: 'voluma.debug', label: 'Debug View', type: 'enum', defaultValue: 'beauty', options: [
    { label: 'Beauty', value: 'beauty' }, { label: 'Species', value: 'species' }, { label: 'Density', value: 'density' }, { label: 'Velocity', value: 'velocity' }, { label: 'Vorticity', value: 'vorticity' }, { label: 'Pressure', value: 'pressure' }, { label: 'Temperature', value: 'temperature' }, { label: 'Occupancy', value: 'occupancy' }, { label: 'Transmittance', value: 'transmittance' }, { label: '∇C Normals', value: 'normals' }, { label: 'Miscibility Interface', value: 'interface' }, { label: 'Audio Features', value: 'audio' }, { label: 'Emitter Bounds', value: 'emitters' },
  ], group: 'Simulation' },
  thickness: { id: 'voluma.thickness', label: 'Optical Thickness', type: 'number', defaultValue: .72, min: .05, max: 1.5, step: .01, group: 'Play', modulatable: true },
  swirl: { id: 'voluma.swirl', label: 'Swirl', type: 'number', defaultValue: .64, min: 0, max: 1, step: .01, group: 'Play', modulatable: true },
  glow: { id: 'voluma.glow', label: 'Edge Glow', type: 'number', defaultValue: .36, min: 0, max: 1, step: .01, group: 'Play', modulatable: true },
  audio: { id: 'voluma.audioIntensity', label: 'Audio Intensity', type: 'number', defaultValue: .58, min: 0, max: 1, step: .01, group: 'Audio', modulatable: true },
  viscosity: { id: 'voluma.sim.viscosity', label: 'Viscosity', type: 'number', defaultValue: .16, min: 0, max: 1, step: .01, group: 'Simulation', modulatable: true },
  vorticity: { id: 'voluma.sim.vorticity', label: 'Vorticity', type: 'number', defaultValue: 1.85, min: 0, max: 4, step: .01, group: 'Simulation', modulatable: true },
  buoyancy: { id: 'voluma.sim.buoyancy', label: 'Buoyancy', type: 'number', defaultValue: -.45, min: -2, max: 2, step: .01, group: 'Simulation', modulatable: true },
  diffusion: { id: 'voluma.sim.diffusion', label: 'Diffusion', type: 'number', defaultValue: .012, min: 0, max: .1, step: .001, group: 'Simulation', modulatable: true },
  pressure: { id: 'voluma.sim.pressure', label: 'Pressure Iterations', type: 'number', defaultValue: 20, min: 8, max: 40, step: 1, group: 'Simulation' },
  emitterMass: { id: 'voluma.emitter.mass', label: 'Ring Mass', type: 'number', defaultValue: 1.1, min: 0, max: 2, step: .01, group: 'Emitter', modulatable: true },
  circulation: { id: 'voluma.emitter.circulation', label: 'Circulation', type: 'number', defaultValue: 2.2, min: 0, max: 5, step: .01, group: 'Emitter', modulatable: true },
  radius: { id: 'voluma.emitter.radius', label: 'Ring Radius', type: 'number', defaultValue: .48, min: .05, max: 1.2, step: .01, group: 'Emitter', modulatable: true },
  exposure: { id: 'voluma.light.exposure', label: 'Exposure', type: 'number', defaultValue: 1.1, min: .2, max: 2.5, step: .01, group: 'Lighting', modulatable: true },
  lightIntensity: { id: 'voluma.light.intensity', label: 'Key Intensity', type: 'number', defaultValue: 1.35, min: .1, max: 4, step: .01, group: 'Lighting', modulatable: true },
  lightAzimuth: { id: 'voluma.light.azimuth', label: 'Light Azimuth', type: 'number', defaultValue: 26, min: -180, max: 180, step: 1, group: 'Lighting' },
  lightElevation: { id: 'voluma.light.elevation', label: 'Light Elevation', type: 'number', defaultValue: 38, min: -15, max: 85, step: 1, group: 'Lighting' },
} satisfies Record<string, ParameterDefinition>

function Tank() {
  const carrier = String(useResolvedParameter(defs.carrier, 120))
  const quality = String(useResolvedParameter(defs.quality, 120))
  const species = String(useResolvedParameter(defs.species, 120))
  const emitterPattern = String(useResolvedParameter(defs.emitterPattern, 120))
  const lightIntensity = Number(useResolvedParameter(defs.lightIntensity, 120))
  const fogColor = carrier.includes('mist') ? '#16262c' : carrier.includes('oil') ? '#1a1611' : '#071014'
  const tankGeometry = useMemo(() => new BoxGeometry(5.5, 4.7, 3.2), [])
  return <>
    <RendererBudget />
    <color attach="background" args={['#030609']} />
    <fogExp2 attach="fog" args={[fogColor, .09]} />
    <ambientLight intensity={.08} color="#86b8c4" />
    <spotLight position={[-3.5, 4.5, 4]} color="#66f1ed" intensity={36 * lightIntensity} angle={.46} penumbra={.75} distance={13} />
    <spotLight position={[3.7, 2.2, -3.2]} color="#d961c3" intensity={28 * lightIntensity} angle={.55} penumbra={.8} distance={12} />
    <VolumetricTank carrier={carrier} quality={quality}>
      <SpeciesPalette items={materials.map(item => item.id)} />
      <VolumeEmitter id="active-stack" type={emitterPattern === 'orbit' ? 'orbit' : emitterPattern === 'spectrum' ? 'spectrum-ring' : emitterPattern === 'ribbon' ? 'path' : 'vortex-ring'} species={species} position={[0, .79, 0]} axis={[0, -1, 0]} mass={1.1} radius={.48} circulation={2.2} audio="bass" />
      <ForceField id="carrier-gravity" type="gravity" strength={-.45} direction={[0, -1, 0]} />
      <AudioReactor source="demo" graph="voluma-audio-sculpture" />
      <PointerSculptor mode="vortex" />
      <mesh geometry={tankGeometry}>
        <meshPhysicalMaterial color="#7ec9d1" transparent opacity={.035} transmission={.62} thickness={.12} roughness={.08} depthWrite={false} side={DoubleSide} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[tankGeometry]} />
        <lineBasicMaterial color="#86bec4" transparent opacity={.11} />
      </lineSegments>
      <VolumetricFluid definitions={defs as unknown as FluidRuntimeDefinitions} />
    </VolumetricTank>
    <mesh position={[0, -2.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[8, 6]} />
      <meshPhysicalMaterial color="#050708" roughness={.78} metalness={.2} transparent opacity={.72} />
    </mesh>
  </>
}

function Content() { return <Tank /> }

function Meter({ value, color = '#6de2df' }: { value: number; color?: string }) {
  return <span className="vol-meter"><i style={{ width: `${MathUtils.clamp(value, 0, 1) * 100}%`, background: color }} /></span>
}

function Slider({ definition, label, unit, compact = false }: { definition: NumberDef; label?: string; unit?: string; compact?: boolean }) {
  const [value, setValue] = useParameter(definition)
  const min = Number(definition.min ?? 0), max = Number(definition.max ?? 1), step = Number(definition.step ?? .01)
  const progress = MathUtils.clamp((Number(value) - min) / (max - min || 1), 0, 1) * 100
  const name = label ?? definition.label
  return <div className={`vol-slider ${compact ? 'is-compact' : ''}`}>
    <span>{name}</span>
    <div className="vol-slider-track"><i style={{ width: `${progress}%` }} /><input aria-label={name} type="range" min={min} max={max} step={step} value={Number(value)} onChange={event => setValue(Number(event.target.value))} /></div>
    <NumberField label={`${name} value`} value={Number(value)} min={min} max={max} step={step} unit={unit} onChange={setValue} />
    <button type="button" aria-label={`Reset ${name}`} title="Reset to default" disabled={Number(value) === definition.defaultValue} onClick={() => setValue(definition.defaultValue)}><RotateCcw size={12} /></button>
  </div>
}
function EnumSelect({ definition }: { definition: ParameterDefinition }) {
  const [value, setValue] = useParameter(definition)
  return <label className="vol-select-row"><span>{definition.label}</span><select value={String(value)} onChange={(event) => setValue(event.target.value)}>{definition.options?.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select></label>
}

const materials = [
  { id: 'cyan-ink', name: 'Aegean Ink', type: 'LIQUID INK', color: '#12bbc9', density: '1.06', viscosity: .12, diffusion: .006, buoyancy: -.62, thickness: .76, glow: .32 },
  { id: 'magenta-dye', name: 'Orchid Dye', type: 'CHROMATIC DYE', color: '#be3b8c', density: '1.02', viscosity: .1, diffusion: .012, buoyancy: -.28, thickness: .62, glow: .46 },
  { id: 'milk', name: 'Pearl Milk', type: 'CLOUDY SCATTER', color: '#e1ebe7', density: '1.03', viscosity: .42, diffusion: .018, buoyancy: -.16, thickness: 1.14, glow: .12 },
  { id: 'oil-gold', name: 'Molten Ochre', type: 'OIL PIGMENT', color: '#c68732', density: '.91', viscosity: .56, diffusion: .001, buoyancy: .42, thickness: 1.08, glow: .26 },
  { id: 'neon-orchid', name: 'Neon Orchid', type: 'EMISSIVE DYE', color: '#9a62ff', density: '1.01', viscosity: .05, diffusion: .026, buoyancy: .82, thickness: .5, glow: .88 },
  { id: 'watercolor', name: 'Saffron Wash', type: 'WATERCOLOR', color: '#dd8f39', density: '1.01', viscosity: .06, diffusion: .038, buoyancy: -.08, thickness: .42, glow: .18 },
  { id: 'dense-paint', name: 'Titan Paint', type: 'DENSE PAINT', color: '#e6d7be', density: '1.24', viscosity: .82, diffusion: .001, buoyancy: -1.18, thickness: 1.38, glow: .08 },
  { id: 'acrylic', name: 'Lagoon Acrylic', type: 'ACRYLIC BLEND', color: '#3dbaa8', density: '1.12', viscosity: .66, diffusion: .004, buoyancy: -.48, thickness: 1.02, glow: .22 },
  { id: 'smoke', name: 'Silver Smoke', type: 'AEROSOL', color: '#9ba8aa', density: '.68', viscosity: .04, diffusion: .045, buoyancy: 1.12, thickness: .36, glow: .14 },
  { id: 'pearl-lacquer', name: 'Pearl Lacquer', type: 'PEARLESCENT OIL', color: '#d8b7ca', density: '.94', viscosity: .72, diffusion: .001, buoyancy: .28, thickness: .92, glow: .74 },
] as const

function MaterialTray() {
  const [species, setSpecies] = useParameter(defs.species)
  const [, setViscosity] = useParameter(defs.viscosity)
  const [, setDiffusion] = useParameter(defs.diffusion)
  const [, setBuoyancy] = useParameter(defs.buoyancy)
  const [, setThickness] = useParameter(defs.thickness)
  const [, setGlow] = useParameter(defs.glow)
  const selectMaterial = (item: typeof materials[number]) => {
    setSpecies(item.id)
    setViscosity(item.viscosity)
    setDiffusion(item.diffusion)
    setBuoyancy(item.buoyancy)
    setThickness(item.thickness)
    setGlow(item.glow)
  }
  return <section className="vol-section vol-materials">
    <div className="vol-section-head"><span>MATERIAL LIBRARY</span><button title="Random material" onClick={() => selectMaterial(materials[Math.floor(Math.random() * materials.length)])}><Sparkles size={13} /></button></div>
    <div className="vol-vials">
      {materials.map(item => <button key={item.id} className={species === item.id ? 'is-active' : ''} onClick={() => selectMaterial(item)} title={`${item.name} · density ${item.density}`}>
        <span className="vol-vial" style={{ '--paint': item.color } as React.CSSProperties}><i /><b /></span>
        <small>{item.name.split(' ')[0]}</small>
      </button>)}
    </div>
    <div className="vol-material-detail">
      <span className="vol-swatch" style={{ background: materials.find(item => item.id === species)?.color }} />
      <span><b>{materials.find(item => item.id === species)?.name}</b><small>{materials.find(item => item.id === species)?.type} · ρ {materials.find(item => item.id === species)?.density}</small></span>
      <ChevronRight size={15} />
    </div>
  </section>
}

function CarrierCard() {
  const [carrier, setCarrier] = useParameter(defs.carrier)
  const [, setViscosity] = useParameter(defs.viscosity)
  const [, setDiffusion] = useParameter(defs.diffusion)
  const [, setBuoyancy] = useParameter(defs.buoyancy)
  const labels: Record<string, string> = { 'clear-water': 'Clear Water', 'viscous-water': 'Viscous Water', 'oil-bath': 'Oil Bath', gel: 'Soft Gel', 'thin-mist': 'Thin Mist', 'dense-fog': 'Dense Fog', 'smoke-air': 'Smoke Air', 'resin-slow': 'Slow Resin', custom: 'Custom Medium' }
  const profiles: Record<string, [number, number, number]> = { 'clear-water': [.16, .012, -.45], 'viscous-water': [.42, .009, -.2], 'oil-bath': [.58, .003, .28], gel: [.78, .001, -.05], 'thin-mist': [.04, .04, .9], 'dense-fog': [.08, .046, 1.1], 'smoke-air': [.03, .052, 1.35], 'resin-slow': [.94, .0005, -.02], custom: [.22, .012, 0] }
  return <section className="vol-section">
    <div className="vol-section-head"><span>CARRIER</span><Gauge size={13} /></div>
    <div className="vol-carrier-card">
      <span className={`vol-carrier-visual carrier-${carrier}`} aria-hidden="true"><i /><b /><em /></span>
      <label><span className="vol-help-text">Choose a medium</span><select aria-label="Carrier medium" value={String(carrier)} onChange={event => {
        const next = event.target.value
        setCarrier(next)
        const [viscosity, diffusion, buoyancy] = profiles[next]
        setViscosity(viscosity); setDiffusion(diffusion); setBuoyancy(buoyancy)
      }}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <p className="vol-help-text">Sets viscosity, diffusion and buoyancy. Fine-tune these in Lab.</p>
  </section>
}

function LeftPanel({ mode, setMode }: { mode: 'play' | 'lab'; setMode: (mode: 'play' | 'lab') => void }) {
  return <aside className="vol-panel vol-panel-left">
    <div className="vol-mode-tabs"><button className={mode === 'play' ? 'is-active' : ''} onClick={() => setMode('play')}>PLAY</button><button className={mode === 'lab' ? 'is-active' : ''} onClick={() => setMode('lab')}>LAB</button></div>
    <div className="vol-panel-scroll">
      <CarrierCard />
      <MaterialTray />
      <section className="vol-section">
        <div className="vol-section-head"><span>{mode === 'play' ? 'MACRO CONTROLS' : 'SOLVER'}</span><Sparkles size={13} /></div>
        <div className="vol-control-stack">
          {mode === 'play' ? <>
            <Slider definition={defs.thickness} />
            <Slider definition={defs.swirl} />
            <Slider definition={defs.glow} />
            <Slider definition={defs.audio} />
          </> : <>
            <Slider definition={defs.viscosity} />
            <Slider definition={defs.vorticity} />
            <Slider definition={defs.buoyancy} />
            <Slider definition={defs.diffusion} />
            <Slider definition={defs.pressure} />
            <EnumSelect definition={defs.quality} />
            <EnumSelect definition={defs.debugView} />
            <Slider definition={defs.exposure} />
            <Slider definition={defs.lightIntensity} />
            <Slider definition={defs.lightAzimuth} />
            <Slider definition={defs.lightElevation} />
          </>}
        </div>
      </section>
      <section className="vol-section vol-audio-block">
        <div className="vol-section-head"><span>AUDIO REACTOR</span><span>MONITOR</span></div>
        <AudioReadout />
      </section>
    </div>
  </aside>
}

function AudioReadout() {
  const bass = Number(useSignal('audio.bass', 0)), mid = Number(useSignal('audio.mid', 0)), treble = Number(useSignal('audio.treble', 0))
  const flux = Number(useSignal('audio.flux', 0)), onset = Number(useSignal('audio.onset', 0)), centroid = Number(useSignal('audio.centroid', 0))
  return <div className="vol-audio-readout">
    <div><small>BASS</small><Meter value={bass} /><output>{Math.round(bass * 100)}</output></div>
    <div><small>MID</small><Meter value={mid} color="#ac75ff" /><output>{Math.round(mid * 100)}</output></div>
    <div><small>AIR</small><Meter value={treble} color="#d777b7" /><output>{Math.round(treble * 100)}</output></div>
    <div><small>FLUX</small><Meter value={flux} color="#f2ae64" /><output>{Math.round(flux * 100)}</output></div>
    <div><small>ONSET</small><Meter value={onset} color="#f06f83" /><output>{onset > .5 ? 'HIT' : '—'}</output></div>
    <div><small>CENT</small><Meter value={Math.min(1, centroid / 6000)} color="#8ea9ff" /><output>{Math.round(centroid / 10) / 100}k</output></div>
  </div>
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <button className={`vol-toggle ${value ? 'is-on' : ''}`} onClick={() => onChange(!value)} role="switch" aria-checked={value} aria-label="Emitter enabled"><i /></button>
}

function RightPanel() {
  const runtime = useArtinosRuntime()
  const [enabled, setEnabled] = useParameter(defs.emitterEnabled as ParameterDefinition<boolean>)
  const [pattern, setPattern] = useParameter(defs.emitterPattern)
  const [species, setSpecies] = useParameter(defs.species)
  const [open, setOpen] = useState({ emission: true, material: false, forces: false })
  const fold = (key: keyof typeof open) => setOpen(value => ({ ...value, [key]: !value[key] }))
  const patternLabel = defs.emitterPattern.options?.find(option => option.value === pattern)?.label ?? 'Emitter Stack'
  const materialLabel = materials.find(item => item.id === species)?.name ?? 'Aegean Ink'
  return <aside className="vol-panel vol-panel-right">
    <header className="vol-inspector-title"><span><CircleDot size={15} /> ACTIVE EMITTER STACK</span><Layers3 size={15} /></header>
    <div className="vol-object-row"><span className="vol-object-icon"><Waves size={18} /></span><span><b>{patternLabel}</b><small>EMITTER · {materialLabel.toUpperCase()}</small></span><Toggle value={enabled} onChange={setEnabled} /></div>
    <div className="vol-panel-scroll">
<p className="vol-help-text vol-inset">Choose a pattern, then adjust its mass, scale and motion.</p>
      <InspectorGroup title="Emission" open={open.emission} onClick={() => fold('emission')} badge="BASS">
        <EnumSelect definition={defs.emitterPattern} />
        <Slider definition={defs.emitterMass} label="MASS" compact />
        <Slider definition={defs.radius} label="RADIUS" compact />
        <Slider definition={defs.circulation} label="CIRCULATION" compact />
        <p className="vol-help-text">Audio can modulate mass and radius when a source is active.</p>
      </InspectorGroup>
      <InspectorGroup title="Material" open={open.material} onClick={() => fold('material')}>
        <EnumSelect definition={defs.species} />
        <Slider definition={defs.thickness} compact />
      </InspectorGroup>
      <InspectorGroup title="Force coupling" open={open.forces} onClick={() => fold('forces')} badge="3">
        <Slider definition={defs.vorticity} compact />
        <Slider definition={defs.buoyancy} compact />
        <Slider definition={defs.viscosity} compact />
      </InspectorGroup>
    </div>
    <button className="vol-add-property" onClick={() => {
      const patterns = defs.emitterPattern.options ?? [], paints = defs.species.options ?? []
      setPattern(patterns[Math.floor(Math.random() * patterns.length)]?.value ?? 'single')
      setSpecies(paints[Math.floor(Math.random() * paints.length)]?.value ?? 'cyan-ink')
      runtime.parameters.set(defs.emitterMass.id, .35 + Math.random() * 1.4)
      runtime.parameters.set(defs.radius.id, .16 + Math.random() * .56)
      runtime.parameters.set(defs.circulation.id, .7 + Math.random() * 3.8)
    }}><Sparkles size={14} /> RANDOMIZE STACK</button>
  </aside>
}

function InspectorGroup({ title, open, onClick, badge, children }: { title: string; open: boolean; onClick: () => void; badge?: string; children?: React.ReactNode }) {
  return <section className={`vol-inspector-group ${open ? 'is-open' : ''}`}>
    <button className="vol-inspector-head" aria-expanded={open} onClick={onClick}><ChevronRight size={14} /><span>{title}</span>{badge && <em>{badge}</em>}</button>
    {open && children && <div className="vol-inspector-body">{children}</div>}
  </section>
}

function BottomDock({ playing, onPlay }: { playing: boolean; onPlay: () => void }) {
  const runtime = useArtinosRuntime()
  const [interaction, setInteraction] = useParameter(defs.interaction)
  const elapsed = Number(useSignal('time.elapsed', 0))
  const elapsedMinutes = Math.floor(elapsed / 60)
  const elapsedSeconds = Math.floor(elapsed % 60)
  const elapsedHundredths = Math.floor((elapsed % 1) * 100)
  const reset = () => {
    const pipeline = runtime.resources.get<{ reset(renderer: any): void }>('voluma.pipeline')
    const renderer = runtime.resources.get('three.renderer')
    if (pipeline && renderer) pipeline.reset(renderer)
  }
  return <div className="vol-bottom-wrap">
    <div className="vol-tools">
      {['stir', 'inject', 'vortex', 'pull'].map((tool, index) => {
        const Icon = [MousePointer2, Droplets, RotateCcw, Radio][index]
        return <button key={tool} className={interaction === tool ? 'is-active' : ''} onClick={() => setInteraction(tool)} title={tool}><Icon size={15} /></button>
      })}
    </div>
    <div className="vol-transport">
      <button title="Undo" onClick={() => runtime.undo()}><Undo2 size={14} /></button><button title="Redo" onClick={() => runtime.redo()}><Redo2 size={14} /></button><i />
      <button className="vol-play" onClick={onPlay} title={playing ? 'Pause simulation' : 'Play simulation'}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
      <span className="vol-time">{String(elapsedMinutes).padStart(2, '0')}:{String(elapsedSeconds).padStart(2, '0')}<small>.{String(elapsedHundredths).padStart(2, '0')}</small></span>
      <span className="vol-transport-state">{playing ? 'Simulation running' : 'Simulation paused'}</span>
      <span className="vol-duration">LIVE</span><i />
      <button title="Reset fields" onClick={reset}><RotateCcw size={14} /></button>
    </div>
    <div className="vol-view-tools"><span><Box size={14} /> PERSPECTIVE</span></div>
  </div>
}

function TopBar({ preset, setPreset }: { preset: string; setPreset: (preset: string) => void }) {
  const runtime = useArtinosRuntime()
  const [quality, setQuality] = useParameter(defs.quality)
  const resolution = useTelemetryMetric('fluid.resolution', '64³')
  const [presetOpen, setPresetOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [audioBusy, setAudioBusy] = useState(false)
  const [audioSource, setAudioSource] = useState<'off' | 'demo' | 'mic' | 'file'>('off')
  const demoEngine = useRef<DemoAudioEngine | null>(null)
  const removeDemoFrame = useRef<(() => void) | null>(null)
  const audioFileInput = useRef<HTMLInputElement | null>(null)
  const [recording, setRecording] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const recordedChunks = useRef<Blob[]>([])
  const recordedScene = useRef('')
  const sceneFileInput = useRef<HTMLInputElement | null>(null)
  const presets = ['Single Drop Ink', 'Twin Braid', 'Milk in Water', 'Oil Lenses', 'Downward Mushrooms', 'Neon Vapor', 'Pearlescent Ribbon', 'AV Sculpture', 'Fog Tank', 'Macro Tendril']
  const exportScene = () => {
    const blob = new Blob([runtime.persistence.export()], { type: 'application/json' })
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = 'voluma-scene.json'; anchor.click(); URL.revokeObjectURL(anchor.href)
  }
  const importScene = async (file?: File) => {
    if (!file) return
    try { if (!runtime.persistence.import(await file.text())) { setNotice('This is not a valid scene file.'); return } } catch { setNotice('Could not read this scene file.'); return }
    setNotice('Scene imported.')
    const pipeline = runtime.resources.get<{ reset(renderer: any): void }>('voluma.pipeline')
    const renderer = runtime.resources.get('three.renderer')
    if (pipeline && renderer) pipeline.reset(renderer)
  }
  useEffect(() => () => {
    removeDemoFrame.current?.()
    demoEngine.current?.stop()
  }, [])
  const stopAudio = () => {
      removeDemoFrame.current?.()
      removeDemoFrame.current = null
      demoEngine.current?.stop()
      demoEngine.current = null
      setAudioSource('off')
  }
  const attachEngine = (engine: DemoAudioEngine, source: 'demo' | 'mic' | 'file') => {
    demoEngine.current = engine
    removeDemoFrame.current = runtime.frames.add({ id: 'voluma.audio-analysis', phase: 'input', priority: -40, run: () => engine.sample() })
    setAudioSource(source)
  }
  const toggleDemoAudio = async () => {
    if (audioSource === 'demo') { stopAudio(); return }
    stopAudio()
    const engine = new DemoAudioEngine(runtime.signals)
    setAudioBusy(true)
    try { await engine.start(); attachEngine(engine, 'demo') } catch (error) { engine.stop(); setNotice(error instanceof Error ? error.message : 'Demo audio could not start.') } finally { setAudioBusy(false) }
  }
  const startMicrophone = async () => {
    if (audioSource === 'mic') { stopAudio(); return }
    stopAudio()
    const engine = new DemoAudioEngine(runtime.signals)
    setAudioBusy(true)
    try { await engine.startMicrophone(); attachEngine(engine, 'mic'); setNotice('Microphone connected.') } catch (error) { engine.stop(); setNotice(error instanceof Error ? error.message : 'Microphone could not connect.') } finally { setAudioBusy(false) }
  }
  const startAudioFile = async (file?: File) => {
    if (!file) return
    stopAudio()
    const engine = new DemoAudioEngine(runtime.signals)
    setAudioBusy(true)
    try { await engine.startFile(file); attachEngine(engine, 'file'); setNotice('Audio file: ' + file.name) } catch (error) { engine.stop(); setNotice(error instanceof Error ? error.message : 'Audio file could not play.') } finally { setAudioBusy(false) }
  }
  const toggleRecording = () => {
    if (typeof MediaRecorder === 'undefined') { setNotice('Recording is unavailable in this browser.'); return }
    if (recorder.current?.state === 'recording') {
      recorder.current.stop()
      return
    }
    const canvas = document.querySelector('canvas')
    if (!(canvas instanceof HTMLCanvasElement) || typeof canvas.captureStream !== 'function') { setNotice('The canvas is not ready to record.'); return }
    recordedChunks.current = []
    recordedScene.current = runtime.persistence.export()
    const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : ''
    const mediaRecorder = new MediaRecorder(canvas.captureStream(30), preferredMime ? { mimeType: preferredMime } : undefined)
    mediaRecorder.ondataavailable = event => { if (event.data.size) recordedChunks.current.push(event.data) }
    mediaRecorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(recordedChunks.current, { type: 'video/webm' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'voluma-capture.webm'; anchor.click(); URL.revokeObjectURL(url)
      const sceneUrl = URL.createObjectURL(new Blob([recordedScene.current], { type: 'application/json' }))
      const sceneAnchor = document.createElement('a'); sceneAnchor.href = sceneUrl; sceneAnchor.download = 'voluma-capture.scene.json'; sceneAnchor.click(); URL.revokeObjectURL(sceneUrl)
      mediaRecorder.stream.getTracks().forEach(track => track.stop())
      setRecording(false)
      recorder.current = null
    }
    recorder.current = mediaRecorder
    mediaRecorder.start(250)
    setRecording(true)
  }
  return <header className="vol-topbar">{notice && <div className="vol-notice" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14} /></button></div>}
    <div className="vol-brand"><span className="vol-mark"><i /><b /><em /></span><span><strong>VOLUMA</strong><small>FLUID / LIGHT INSTRUMENT</small></span></div>
    <div className="vol-runtime-state"><span><i /> WEBGPU</span><b>LIVE</b><small>{String(quality).toUpperCase()} · {resolution}</small></div>
    <div className="vol-preset-picker">
      <button onClick={() => setPresetOpen(value => !value)}><span><small>SCENE</small><b>{preset}</b></span><ChevronDown size={15} /></button>
      {presetOpen && <div className="vol-preset-menu">{presets.map(item => <button key={item} className={item === preset ? 'is-active' : ''} onClick={() => {
        setPreset(item)
        setPresetOpen(false)
        runtime.presets.apply(`voluma:${item.toLowerCase().replaceAll(' ', '-')}`)
        window.setTimeout(() => {
          const pipeline = runtime.resources.get<{ reset(renderer: any): void }>('voluma.pipeline')
          const renderer = runtime.resources.get('three.renderer')
          if (pipeline && renderer) pipeline.reset(renderer)
        }, 0)
      }}>{item}</button>)}</div>}
    </div>
    <nav className="vol-top-actions">
      <button disabled={audioBusy} title="Toggle demo oscillator" onClick={toggleDemoAudio} className={audioSource === 'demo' ? 'is-active' : ''}><AudioLines size={15} /><span>{audioSource === 'demo' ? 'DEMO LIVE' : 'DEMO'}</span></button>
      <button disabled={audioBusy} title="Use microphone" onClick={startMicrophone} className={audioSource === 'mic' ? 'is-active' : ''}><Mic2 size={15} /><span>{audioSource === 'mic' ? 'MIC LIVE' : 'MIC'}</span></button>
      <button disabled={audioBusy} title="Analyze audio file" onClick={() => audioFileInput.current?.click()} className={audioSource === 'file' ? 'is-active' : ''}><Volume2 size={15} /><span>FILE</span></button>
      <input ref={audioFileInput} className="vol-hidden-input" type="file" accept="audio/*" onChange={(event) => { void startAudioFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
      <button title="Import scene" onClick={() => sceneFileInput.current?.click()}><Upload size={15} /></button><input ref={sceneFileInput} className="vol-hidden-input" type="file" accept="application/json,.json" onChange={(event) => { void importScene(event.target.files?.[0]); event.currentTarget.value = '' }} />
      <button title="Export scene" onClick={exportScene}><Download size={15} /></button><select className="vol-quality-select" aria-label="Quality tier" value={String(quality)} onChange={event => setQuality(event.target.value)}>{defs.quality.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className={`vol-record ${recording ? 'is-active' : ''}`} onClick={toggleRecording}><i /> {recording ? 'STOP' : 'RECORD'}</button>
    </nav>
  </header>
}

function PerfHud() {
  const fps = Number(useTelemetryMetric('performance.fps', 0))
  const sim = Number(useTelemetryMetric('fluid.sim.ms', 0))
  const bake = Number(useTelemetryMetric('fluid.bake.ms', 0))
  const frame = Number(useTelemetryMetric('performance.frameMs', 0))
  const jacobi = Number(useTelemetryMetric('fluid.pressure.iterations', 0))
  return <div className="vol-perf-hud"><span><i /> {fps.toFixed(0)} <small>FPS</small></span><span>SIM <b>{sim.toFixed(1)}</b><small>MS</small></span><span>BAKE <b>{bake.toFixed(1)}</b><small>MS</small></span><span>FRAME <b>{frame.toFixed(1)}</b><small>MS</small></span><span>JACOBI <b>{jacobi}</b></span></div>
}

function Overlay() {
  const runtime = useArtinosRuntime()
  const [mode, setMode] = useState<'play' | 'lab'>('play')
  const [preset, setPreset] = useState('Single Drop Ink')
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'materials' | 'emitter' | 'viewport'>('materials')
  const commandRef = useRef<HTMLDivElement>(null)
  useFocusScope(commandRef, commandOpen)
  const [playing, setPlaying] = useParameter(defs.playing as ParameterDefinition<boolean>)
  const [, setQuality] = useParameter(defs.quality)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(value => !value) }
      if (event.key === 'Escape') setCommandOpen(false)
      const editing = event.target instanceof HTMLElement && Boolean(event.target.closest('input,select,textarea,[contenteditable=true],button'))
      if (editing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.code === 'Space') { event.preventDefault(); runtime.setParameter(defs.playing.id, !runtime.parameters.getBase(defs.playing.id)) }
      if (event.key.toLowerCase() === 'r') { event.preventDefault(); reset() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const reset = () => {
    const pipeline = runtime.resources.get<{ reset(renderer: any): void }>('voluma.pipeline')
    const renderer = runtime.resources.get('three.renderer')
    if (pipeline && renderer) pipeline.reset(renderer)
    setCommandOpen(false)
  }
  return <div className="voluma-ui" data-mobile-panel={mobilePanel}>
    <TopBar preset={preset} setPreset={setPreset} />
<nav className="vol-mobile-tabs" aria-label="Studio panel">{(['materials', 'emitter', 'viewport'] as const).map(panel => <button key={panel} aria-pressed={mobilePanel === panel} onClick={() => setMobilePanel(panel)}>{panel}</button>)}</nav><LeftPanel mode={mode} setMode={setMode} />
    <RightPanel />
    <div className="vol-viewport-label"><span><Eye size={13} /> CAMERA / MACRO HERO</span><small>DRAG TO SCULPT · SHIFT INJECT · ALT VORTEX · CTRL PULL</small></div>
    <PerfHud />
    <BottomDock playing={Boolean(playing)} onPlay={() => setPlaying(!playing)} />
    <button className="vol-command" title="Command palette" onClick={() => setCommandOpen(value => !value)}><Command size={13} /> K</button>
    {commandOpen && <div ref={commandRef} className="vol-command-palette" role="dialog" aria-modal="true" aria-label="Command palette"><header><span>COMMANDS</span><button onClick={() => setCommandOpen(false)}><X size={14} /></button></header><button onClick={() => { setPlaying(!playing); setCommandOpen(false) }}>{playing ? 'Pause simulation' : 'Resume simulation'}<small>Space</small></button><button onClick={reset}>Reset all fields<small>R</small></button><button onClick={() => { setQuality('draft'); setCommandOpen(false) }}>Quality: Draft<small>64³</small></button><button onClick={() => { setQuality('live'); setCommandOpen(false) }}>Quality: Live<small>96³</small></button></div>}
  </div>
}

const audioGraph: GraphDefinition = {
  id: 'voluma-audio-sculpture', name: 'Volumetric Audio Sculpture', domain: 'signal', enabled: true,
  nodes: [
    { id: 'bass', type: 'signal', x: 20, y: 20, data: { id: 'audio.bass' } },
    { id: 'smooth', type: 'smooth', x: 220, y: 20, data: { amount: .78 } },
    { id: 'shape', type: 'remap', x: 420, y: 20, data: { inMin: 0, inMax: 1, outMin: .45, outMax: 1 } },
    { id: 'write', type: 'write-parameter', x: 620, y: 20, data: { id: defs.swirl.id } },
    { id: 'treble', type: 'signal', x: 20, y: 150, data: { id: 'audio.treble' } },
    { id: 'trebleSmooth', type: 'smooth', x: 220, y: 150, data: { amount: .42 } },
    { id: 'trebleShape', type: 'remap', x: 420, y: 150, data: { inMin: 0, inMax: 1, outMin: 1.2, outMax: 3.8 } },
    { id: 'trebleWrite', type: 'write-parameter', x: 620, y: 150, data: { id: defs.vorticity.id } },
    { id: 'flux', type: 'signal', x: 20, y: 280, data: { id: 'audio.flux' } },
    { id: 'fluxSmooth', type: 'smooth', x: 220, y: 280, data: { amount: .2 } },
    { id: 'fluxShape', type: 'remap', x: 420, y: 280, data: { inMin: 0, inMax: 1, outMin: .2, outMax: .95 } },
    { id: 'fluxWrite', type: 'write-parameter', x: 620, y: 280, data: { id: defs.glow.id } },
  ],
  edges: [
    { id: 'a', from: 'bass', to: 'smooth', output: 'value', input: 'value', order: 0 },
    { id: 'b', from: 'smooth', to: 'shape', output: 'value', input: 'value', order: 0 },
    { id: 'c', from: 'shape', to: 'write', output: 'value', input: 'value', order: 0 },
    { id: 'd', from: 'treble', to: 'trebleSmooth', output: 'value', input: 'value', order: 0 },
    { id: 'e', from: 'trebleSmooth', to: 'trebleShape', output: 'value', input: 'value', order: 0 },
    { id: 'f', from: 'trebleShape', to: 'trebleWrite', output: 'value', input: 'value', order: 0 },
    { id: 'g', from: 'flux', to: 'fluxSmooth', output: 'value', input: 'value', order: 0 },
    { id: 'h', from: 'fluxSmooth', to: 'fluxShape', output: 'value', input: 'value', order: 0 },
    { id: 'i', from: 'fluxShape', to: 'fluxWrite', output: 'value', input: 'value', order: 0 },
  ],
}

const presetValues = (pattern: string, species: string, carrier: string, thickness: number, swirl: number, glow: number, viscosity = .16, vorticity = 1.85, buoyancy = -.45, diffusion = .012, mass = 1.1, radius = .48, circulation = 2.2, exposure = 1.1, lightIntensity = 1.35) => ({
  [defs.species.id]: species, [defs.carrier.id]: carrier, [defs.thickness.id]: thickness, [defs.swirl.id]: swirl, [defs.glow.id]: glow,
  [defs.emitterPattern.id]: pattern, [defs.exposure.id]: exposure, [defs.lightIntensity.id]: lightIntensity,
  [defs.viscosity.id]: viscosity, [defs.vorticity.id]: vorticity, [defs.buoyancy.id]: buoyancy, [defs.diffusion.id]: diffusion,
  [defs.emitterMass.id]: mass, [defs.radius.id]: radius, [defs.circulation.id]: circulation,
})

export default defineArtinosProject({
  id: 'voluma', name: 'VOLUMA Fluid Studio', version: '1.0.0', description: 'Cinematic volumetric fluid and light instrument', default: true, shell: 'minimal',
  renderer: { backend: 'webgpu', dpr: [.55, .8], shadows: false, postfx: false, antialias: false, powerPreference: 'high-performance', threeInspector: false, threeInspectorVisible: false },
  Content, Overlay, parameters: Object.values(defs), graphs: [audioGraph], telemetry: true, adaptiveQuality: false,
  bindings: [
    { id: 'voluma.audio.glow', source: 'audio.treble', target: defs.glow.id, mode: 'add', input: [0, 1], output: [0, .28], clamp: true, smooth: .16 },
    { id: 'voluma.audio.mass', source: 'audio.bass', target: defs.emitterMass.id, mode: 'add', input: [0, .82], output: [0, .7], clamp: true, smooth: .32 },
    { id: 'voluma.audio.circulation', source: 'audio.onset', target: defs.circulation.id, mode: 'add', input: [0, 1], output: [0, 1.6], clamp: true, smooth: .08 },
    { id: 'voluma.audio.vorticity', source: 'audio.treble', target: defs.vorticity.id, mode: 'add', input: [0, 1], output: [0, 1.4], clamp: true, smooth: .12 },
    { id: 'voluma.audio.radius', source: 'audio.bass', target: defs.radius.id, mode: 'add', input: [0, 1], output: [0, .24], clamp: true, smooth: .26 },
    { id: 'voluma.audio.exposure', source: 'audio.rms', target: defs.exposure.id, mode: 'add', input: [0, .7], output: [0, .38], clamp: true, smooth: .36 },
  ],
  presets: [
    { id: 'voluma:single-drop-ink', label: 'Single Drop Ink', group: 'voluma', values: presetValues('single', 'cyan-ink', 'clear-water', .76, .72, .32, .12, 2.4, -.62, .006, .82, .38, 2.7) },
    { id: 'voluma:twin-braid', label: 'Twin Braid', group: 'voluma', values: presetValues('twin', 'magenta-dye', 'clear-water', .62, .88, .46, .1, 2.9, -.28, .012, .68, .3, 3.2) },
    { id: 'voluma:milk-in-water', label: 'Milk in Water', group: 'voluma', values: presetValues('single', 'milk', 'viscous-water', 1.14, .36, .12, .42, 1.15, -.16, .018, 1.2, .62, 1.2) },
    { id: 'voluma:oil-lenses', label: 'Oil Lenses', group: 'voluma', values: presetValues('single', 'oil-gold', 'clear-water', 1.08, .22, .26, .56, .92, .42, .001, .72, .22, 1.1, 1.25, 1.6) },
    { id: 'voluma:downward-mushrooms', label: 'Downward Mushrooms', group: 'voluma', values: presetValues('downward', 'cyan-ink', 'clear-water', .9, .8, .28, .14, 3.25, -1.15, .004, 1.28, .52, 3.6) },
    { id: 'voluma:neon-vapor', label: 'Neon Vapor', group: 'voluma', values: presetValues('orbit', 'neon-orchid', 'thin-mist', .5, .92, .88, .05, 3.4, .82, .026, .52, .28, 3.8, 1.35, 1.7) },
    { id: 'voluma:pearlescent-ribbon', label: 'Pearlescent Ribbon', group: 'voluma', values: presetValues('ribbon', 'pearl-lacquer', 'gel', .86, .3, .7, .7, .72, -.08, .002, .58, .7, .82, 1.3, 1.85) },
    { id: 'voluma:av-sculpture', label: 'AV Sculpture', group: 'voluma', values: presetValues('spectrum', 'neon-orchid', 'thin-mist', .54, .94, .8, .06, 3.5, -.18, .02, .92, .44, 3.9, 1.32, 1.65) },
    { id: 'voluma:fog-tank', label: 'Fog Tank', group: 'voluma', values: presetValues('fog', 'smoke', 'thin-mist', .38, .2, .18, .08, .78, .7, .032, .24, .7, .48, .9, .8) },
    { id: 'voluma:macro-tendril', label: 'Macro Tendril', group: 'voluma', values: presetValues('tendril', 'cyan-ink', 'clear-water', .66, 1, .44, .06, 3.85, -.32, .002, .42, .2, 4.4, 1.2, 1.5) },
  ],
  setup: ({ runtime }) => {
    const dispose = runtime.resources.set('voluma.manifest', {
      domain: 'cinematic-slab', solver: 'dense-eulerian-3d', quality: ['64³', '96³', '128³', '160³'], jacobi: '10–40 quality capped',
      passes: ['vortex-ring-splat', 'buoyancy+interface-force', 'curl', 'vorticity', 'spatial-viscosity', 'divergence', 'pressure', 'project', 'advect-velocity', 'advect+diffuse-species', 'transmittance', 'beer-lambert-raymarch'],
      renderer: 'WebGPU / TSL shared pipeline', interaction: ['stir', 'inject', 'vortex', 'pull'],
    }, { kind: 'volumetric-fluid-manifest', owner: 'voluma' })
    return dispose
  },
})

