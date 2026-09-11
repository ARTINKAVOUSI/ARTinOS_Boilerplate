import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  Collapsible,
  ColorField,
  CurveEditor,
  Dial,
  DropZone,
  Empty,
  Envelope,
  FileField,
  GradientBar,
  IconButton,
  // `Meter` and `XYPad` each ship in two variants: a plain one in display /
  // vector, and a signal-aware instrument one. The instrument pair is what
  // carries `status` and a planar min/max, so that is what is shown here.
  InstrumentMeter,
  InstrumentXYPad,
  KeyCapture,
  KeyValue,
  Knob,
  NumberField,
  Progress,
  PropertyRow,
  RangeSlider,
  SearchField,
  Section,
  Segmented,
  Select,
  Slider,
  Sparkline,
  Stack,
  Tabs,
  TextArea,
  TextField,
  Toggle,
  Toolbar,
  VectorField,
  Waveform,
  controls,
} from '../primitives'
import { TokenStudio } from './TokenStudio'
import { BloomPicker } from './BloomPicker'
import './showcase.css'

/* ── page scaffolding ───────────────────────────────────────────────────── */

interface SectionDef {
  id: string
  label: string
  group: string
}

const SECTIONS: SectionDef[] = [
  { id: 'bloom', label: 'Bloom playground', group: 'Start here' },
  { id: 'principles', label: 'Principles', group: 'System' },
  { id: 'color', label: 'Colour', group: 'Foundations' },
  { id: 'type', label: 'Type', group: 'Foundations' },
  { id: 'space', label: 'Space & radius', group: 'Foundations' },
  { id: 'elevation', label: 'Elevation', group: 'Foundations' },
  { id: 'motion', label: 'Motion', group: 'Foundations' },
  { id: 'numeric', label: 'Numeric', group: 'Controls' },
  { id: 'choice', label: 'Choice', group: 'Controls' },
  { id: 'text', label: 'Text & files', group: 'Controls' },
  { id: 'instrument', label: 'Instrument', group: 'Controls' },
  { id: 'display', label: 'Display', group: 'Controls' },
  { id: 'composition', label: 'Composition', group: 'Patterns' },
  { id: 'states', label: 'States', group: 'Patterns' },
  { id: 'catalog', label: 'Catalog', group: 'Reference' },
  { id: 'a11y', label: 'Accessibility', group: 'Reference' },
]

function ShowcaseSection({ id, title, code, children, lede }: { id: string; title: string; code?: string; lede?: string; children: ReactNode }) {
  return (
    <section className="artinos-showcase-section" id={id}>
      <header>
        <h2>{title}</h2>
        {code && <span>{code}</span>}
      </header>
      {lede && <p>{lede}</p>}
      {children}
    </section>
  )
}

function Specimen({ name, code, note, row = false, children }: { name: string; code?: string; note?: string; row?: boolean; children: ReactNode }) {
  return (
    <article className="artinos-specimen">
      <header>
        <b>{name}</b>
        {code && <code>{code}</code>}
      </header>
      <div className={`artinos-specimen-stage ${row ? 'is-row' : ''}`}>{children}</div>
      {note && <p>{note}</p>}
    </article>
  )
}

/* ── foundations data ───────────────────────────────────────────────────── */

const COLOR_ROLES: Array<{ token: string; label: string; note: string }> = [
  { token: '--bg-app', label: 'App ground', note: 'Behind everything, including the canvas.' },
  { token: '--bg-stage', label: 'Stage', note: 'Viewport ground and page sections.' },
  { token: '--bg-surface', label: 'Surface', note: 'Panels, cards, dock body.' },
  { token: '--bg-raised', label: 'Raised', note: 'Anything sitting on a surface.' },
  { token: '--bg-well', label: 'Well', note: 'Inputs and tracks — recessed, not raised.' },
  { token: '--bg-float', label: 'Float', note: 'Menus, popovers, dialogs.' },
  { token: '--text-hi', label: 'Text primary', note: 'Values and titles.' },
  { token: '--text-mid', label: 'Text secondary', note: 'Labels and body.' },
  { token: '--text-low', label: 'Text muted', note: 'Supporting copy.' },
  { token: '--text-faint', label: 'Text faint', note: 'Units and counts only — under 4.5:1.' },
  { token: '--sig-live', label: 'Live', note: 'Running, armed, enabled.' },
  { token: '--sig-warn', label: 'Warn', note: 'Degraded but proceeding.' },
  { token: '--sig-fault', label: 'Fault', note: 'Stopped, invalid, destructive.' },
  { token: '--sig-bind', label: 'Bound', note: 'Driven from outside the panel.' },
]

const TYPE_SCALE: Array<{ token: string; use: string; sample: string }> = [
  { token: '--type-title', use: 'Section titles', sample: 'The control set' },
  { token: '--type-body', use: 'Body copy', sample: 'One row carries label, binding, value and unit.' },
  { token: '--type-label', use: 'Control labels', sample: 'Exposure' },
  { token: '--type-value', use: 'Numeric readout', sample: '1.240' },
  { token: '--type-readout', use: 'HUD readout', sample: '16.43' },
  { token: '--type-panel', use: 'Panel name', sample: 'ENVIRONMENT' },
  { token: '--type-section', use: 'Section marker', sample: 'LIGHTING' },
]

const SPACE_SCALE = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7', '--space-8']
const RADIUS_SCALE = ['--radius-control', '--radius-card', '--radius-panel', '--radius-shell']
const HEIGHT_SCALE = ['--control-h-sm', '--control-h', '--control-h-lg']

const ELEVATIONS: Array<{ token: string; label: string; meaning: string }> = [
  { token: '--e0-well', label: 'e0 · well', meaning: 'Recessed means editable.' },
  { token: '--e1-surface', label: 'e1 · surface', meaning: 'A bounded region.' },
  { token: '--e2-dock', label: 'e2 · dock', meaning: 'Frost means floating chrome.' },
  { token: '--e3-float', label: 'e3 · float', meaning: 'Above everything, dismissible.' },
]

const MOTION: Array<{ token: string; use: string }> = [
  { token: '--dur-value', use: 'A value catching up to the pointer.' },
  { token: '--dur-state', use: 'Hover, focus, armed.' },
  { token: '--dur-surface', use: 'A popover or dialog arriving.' },
  { token: '--dur-layout', use: 'A dock resizing or a panel moving.' },
  { token: '--ease-enter', use: 'Arriving — decelerates into place.' },
  { token: '--ease-exit', use: 'Leaving — accelerates away, and takes less time.' },
]

const RULES: Array<{ n: string; title: string; body: string; do: string; dont: string }> = [
  {
    n: '01',
    title: 'Components read roles, never primitives',
    body: 'A component rule that names a primitive pins itself to one theme. Roles are the contract; primitives stay private to the token file.',
    do: 'var(--bg-surface)',
    dont: 'var(--ink-surface)',
  },
  {
    n: '02',
    title: 'One meaning per elevation',
    body: 'Recessed means editable. Frost means floating chrome. A card that is both raised and recessed is two components wearing one shell.',
    do: 'inputs at --e0-well',
    dont: 'a well with a cast shadow',
  },
  {
    n: '03',
    title: 'Colour is state, not decoration',
    body: 'Teal is running or armed, azure externally driven, amber degraded, rose stopped. Nothing on the surface is tinted for emphasis alone.',
    do: 'azure only when bound',
    dont: 'teal to feel active',
  },
  {
    n: '04',
    title: 'Separate with gutters before strokes',
    body: 'A 12px gutter separates as well as a border and adds no visual weight. A hairline belongs inside a card, not between two of them.',
    do: 'gap: var(--space-5)',
    dont: '1px between panels',
  },
  {
    n: '05',
    title: 'Numbers never move',
    body: 'Values are mono and tabular so a digit change cannot shift the column. The unit is always a separate, quieter element.',
    do: '--type-value everywhere',
    dont: 'proportional numerals',
  },
  {
    n: '06',
    title: 'Height comes from a token',
    body: 'Three control heights cover the whole surface. A one-off height is a sign the component is doing two jobs at once.',
    do: '24 / 28 / 32',
    dont: 'height: 30px',
  },
]

const CATALOG: Array<{ name: string; category: string; description: string; states: string }> = [
  { name: 'Slider', category: 'control', description: 'Scrub cell. The row is the drag surface; the fill is the value.', states: 'idle · hover · drag · bound · warn · fault' },
  { name: 'Dial', category: 'control', description: 'Angular scrub for bounded values with a compact footprint.', states: 'idle · drag · disabled' },
  { name: 'RangeSlider', category: 'control', description: 'Two handles over one track; pushing one carries the other.', states: 'idle · drag' },
  { name: 'NumberField', category: 'control', description: 'Typed entry for an exact value.', states: 'idle · focus · invalid' },
  { name: 'Toggle', category: 'control', description: 'Recessed track, square knob, explicit ON/OFF caption.', states: 'on · off · disabled' },
  { name: 'Checkbox', category: 'control', description: '14px square for inline flags — the label is the state.', states: 'checked · unchecked · disabled' },
  { name: 'Segmented', category: 'control', description: 'Two to four exclusive options, all visible at once.', states: 'idle · active' },
  { name: 'Select', category: 'control', description: 'Exclusive choice past four options.', states: 'idle · focus' },
  { name: 'Tabs', category: 'navigation', description: 'Flush labels on a shared rule; the active one is brighter.', states: 'idle · active' },
  { name: 'TextField', category: 'control', description: 'Single-line entry.', states: 'idle · focus · invalid' },
  { name: 'ColorField', category: 'control', description: 'Swatch plus hex, on one row.', states: 'idle · focus' },
  { name: 'VectorField', category: 'control', description: 'Two to four components under one label.', states: 'idle · focus' },
  { name: 'XYPad', category: 'instrument', description: 'Two coupled values on one planar surface.', states: 'idle · drag' },
  { name: 'Knob', category: 'instrument', description: 'Angular control with detents, for dense racks.', states: 'idle · drag · detent' },
  { name: 'Meter', category: 'display', description: 'A level with a signal state.', states: 'live · warn · fault' },
  { name: 'Waveform', category: 'display', description: 'A sample buffer drawn as a signal trace.', states: 'live · warn · fault' },
  { name: 'Envelope', category: 'display', description: 'Time-value breakpoints over a normalised field.', states: 'live · warn' },
  { name: 'GradientBar', category: 'display', description: 'Ordered colour stops as a continuous ramp.', states: 'idle' },
  { name: 'Sparkline', category: 'display', description: 'A trend, small enough to sit inside a row.', states: 'idle' },
  { name: 'Badge', category: 'display', description: 'A state as a word, never colour alone.', states: 'neutral · accent · warn · danger' },
  { name: 'PropertyRow', category: 'composition', description: 'Label, control, unit, status, reset and actions in one relationship.', states: 'default · bound · warn · fault · mixed' },
  { name: 'Section', category: 'composition', description: 'A titled group of rows with an optional description.', states: 'default' },
  { name: 'Collapsible', category: 'composition', description: 'A group that can fold away, with a count on the header.', states: 'open · closed' },
  { name: 'ListBrowser', category: 'composition', description: 'Virtualised list with fuzzy match and filters.', states: 'idle · filtered · empty' },
]

const A11Y: string[] = [
  'Nothing renders below 8.5px, and that floor is reserved for mono caps with wide tracking.',
  'Body and label text holds 4.5:1 against its own surface; --text-faint is for units and counts only.',
  'Focus is a two-ring token and is never removed, only restyled.',
  'State is never colour alone: bound rows name their source, faults carry text.',
  'Drag targets are at least 24px tall — the scrub row is the floor, not the exception.',
  'prefers-reduced-motion zeroes all four durations; no animation is load-bearing.',
]

/* ── the page ───────────────────────────────────────────────────────────── */

/**
 * The ARTINOS Instrument system, documented by running it.
 *
 * Every specimen below is the real component reading the real tokens — there
 * are no screenshots and no re-implementations, so this page cannot drift from
 * what ships. The token studio edits those same roles live.
 */
export function Showcase() {
  const [active, setActive] = useState(SECTIONS[0].id)
  const [bloomColor, setBloomColor] = useState('#FFB1EE')
  const [bloomTheme, setBloomTheme] = useState<'light' | 'dark'>('light')
  const [blueprint, setBlueprint] = useState(true)
  const [uiTheme, setUiTheme] = useState('glass')
  const [density, setDensity] = useState('medium')
  const [modality, setModality] = useState('pointer')
  const [direction, setDirection] = useState('ltr')
  const [motion, setMotion] = useState('full')
  const catalog = useMemo(() => {
    const known = new Set(CATALOG.map(entry => entry.name))
    return [...CATALOG, ...controls.list().filter(definition => !known.has(definition.name)).map(definition => ({ name: definition.name, category: definition.category, description: definition.metadata.description ?? definition.semantics.purpose, states: (definition.state.states ?? Object.keys(definition.state.initial)).join(' · ') }))]
  }, [])

  // Value state for the live specimens.
  const [exposure, setExposure] = useState(1.24)
  const [bias, setBias] = useState(0.32)
  const [gain, setGain] = useState(0.68)
  const [samples, setSamples] = useState(262144)
  const [clip, setClip] = useState<[number, number]>([0.2, 0.78])
  const [denoise, setDenoise] = useState(true)
  const [motionBlur, setMotionBlur] = useState(false)
  const [gpu, setGpu] = useState(true)
  const [shading, setShading] = useState('solid')
  const [colorspace, setColorspace] = useState('acescg')
  const [tab, setTab] = useState('scene')
  const [name, setName] = useState('Studio Scene 04')
  const [notes, setNotes] = useState('Bake at 512 samples before publishing.')
  const [query, setQuery] = useState('')
  const [tint, setTint] = useState('#2fb39c')
  const [position, setPosition] = useState([0, 1.2, -3])
  const [pad, setPad] = useState<[number, number]>([0.62, 0.4])
  const [shortcut, setShortcut] = useState('Meta+R')
  const [curve, setCurve] = useState<Array<[number, number]>>([[0, 0], [0.4, 0.7], [1, 1]])

  // A slowly-moving buffer, so the signal displays are actually alive.
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setPhase(p => p + 1), 120)
    return () => window.clearInterval(id)
  }, [])

  const wave = useMemo(
    () => Array.from({ length: 64 }, (_, i) => Math.sin((i + phase) * 0.28) * 0.7 + Math.sin((i + phase) * 0.11) * 0.3),
    [phase],
  )
  const trend = useMemo(() => Array.from({ length: 32 }, (_, i) => 50 + Math.sin((i + phase) * 0.2) * 22), [phase])

  // Highlight the section currently in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-15% 0px -70% 0px' },
    )
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, SectionDef[]>()
    for (const section of SECTIONS) {
      const list = map.get(section.group) ?? []
      list.push(section)
      map.set(section.group, list)
    }
    return [...map.entries()]
  }, [])

  return (
    <div className={`artinos-showcase plate-workspace bloom-library ${blueprint ? 'is-blueprint' : ''}`} data-theme={uiTheme} data-density={density} data-modality={modality} data-direction={direction} data-reduced-motion={motion === 'reduced' || undefined} dir={direction} data-bloom-theme={bloomTheme}>
      <div className="artinos-showcase-layout">
      <aside className="artinos-showcase-nav">
        <div className="artinos-showcase-brand">
          <i aria-hidden>#</i>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <b>ARTINOS</b>
            <small>INSTRUMENT</small>
          </span>
        </div>
        <nav>
          {groups.map(([group, items]) => (
            <div key={group}>
              <h6>{group}</h6>
              {items.map(item => (
                <a key={item.id} href={`#${item.id}`} aria-current={active === item.id}>
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="artinos-showcase-main">
        <header className="artinos-showcase-hero">
          <div className="bloom-hero-kicker"><span className="bloom-mark" aria-hidden>✳</span> ARTINOS UI / BLOOM SYSTEM</div>
          <h1>Interfaces that open<br /><i>like a flower.</i></h1>
          <p>
            A complete component language for creative tools: expressive at the surface, precise underneath. Explore the live
            picker, tune the controls, and browse the same primitives ARTINOS ships to every project.
          </p>
          <div className="artinos-showcase-hero-meta">
            <Badge tone="accent">{catalog.length} components</Badge>
            <Badge>live specimens</Badge>
            <Badge>token driven</Badge>
            <div className="bloom-hero-actions">
              <button type="button" className="bloom-text-button" onClick={() => setBlueprint(value => !value)}>{blueprint ? 'Hide grid' : 'Show grid'}</button>
              <button type="button" className="bloom-text-button" onClick={() => setBloomTheme(value => value === 'light' ? 'dark' : 'light')}>{bloomTheme === 'light' ? 'Dark mode' : 'Light mode'}</button>
            </div>
          </div>
          <Toolbar>
            <Select label="Theme" value={uiTheme} options={['dark','light','high-contrast','glass','studio','minimal']} onChange={value => setUiTheme(String(value))} />
            <Select label="Density" value={density} options={['large','medium','compact','micro','touch']} onChange={value => setDensity(String(value))} />
            <Select label="Modality" value={modality} options={['pointer','touch','pen','keyboard','spatial']} onChange={value => setModality(String(value))} />
            <Select label="Direction" value={direction} options={['ltr','rtl']} onChange={value => setDirection(String(value))} />
            <Select label="Motion" value={motion} options={['full','reduced']} onChange={value => setMotion(String(value))} />
          </Toolbar>
        </header>

        <ShowcaseSection id="bloom" title="Bloom playground" code="LIVE / 01" lede="The signature interaction: a tiny swatch opens into a palette of petals. Every control below is a real, reusable component—not a screenshot.">
          <div className="bloom-playground">
            <div className="bloom-playground__picker">
              <BloomPicker value={bloomColor} onChange={setBloomColor} palette={['#FFB1EE', '#FFC8A2', '#FFE08A', '#B8E986', '#8DE0D2', '#9EC5FF', '#C7A7F5', '#F6A6C1', '#F58D8D', '#D7D1C8', '#AAB7C4', '#242429']} />
              <span className="bloom-handnote">choose a petal ↗</span>
            </div>
            <div className="bloom-playground__details">
              <div className="bloom-value-card" style={{ '--bloom-value': bloomColor } as CSSProperties}>
                <span>Selected colour</span>
                <strong>{bloomColor.toUpperCase()}</strong>
                <i aria-hidden />
              </div>
              <div className="bloom-setting-list">
                <PropertyRow label="Palette"><Select label="" value="bloom" options={[{ value: 'bloom', label: 'Bloom / soft' }, { value: 'signal', label: 'Signal / vivid' }]} onChange={() => undefined} /></PropertyRow>
                <PropertyRow label="Theme"><Segmented value={bloomTheme} options={['light', 'dark']} onChange={value => setBloomTheme(value as 'light' | 'dark')} /></PropertyRow>
                <PropertyRow label="Blueprint"><Toggle label="Visible" value={blueprint} onChange={setBlueprint} /></PropertyRow>
              </div>
              <code className="bloom-code-chip">&lt;BloomPicker value="{bloomColor.toUpperCase()}" /&gt;</code>
            </div>
          </div>
        </ShowcaseSection>

        {/* ── principles ─────────────────────────────────────────────── */}
        <ShowcaseSection id="principles" title="How to hold the system" code="RULES" lede="Six rules, each checkable in review.">
          <div className="artinos-rules">
            {RULES.map(rule => (
              <article key={rule.n}>
                <em>{rule.n}</em>
                <div>
                  <b>{rule.title}</b>
                  <p>{rule.body}</p>
                </div>
                <ul>
                  <li className="is-do">✓ {rule.do}</li>
                  <li className="is-dont">✕ {rule.dont}</li>
                </ul>
              </article>
            ))}
          </div>
        </ShowcaseSection>

        {/* ── colour ─────────────────────────────────────────────────── */}
        <ShowcaseSection
          id="color"
          title="Colour"
          code="ROLES"
          lede="Only roles are public. A component that names a primitive pins itself to one theme, so the ramps behind these stay private to the token file."
        >
          <div className="artinos-swatches">
            {COLOR_ROLES.map(role => (
              <div className="artinos-swatch" key={role.token} title={role.note}>
                <i aria-hidden style={{ background: `var(${role.token})` }} />
                <span>
                  <b>{role.label}</b>
                  <code>{role.token}</code>
                </span>
              </div>
            ))}
          </div>
        </ShowcaseSection>

        {/* ── type ───────────────────────────────────────────────────── */}
        <ShowcaseSection
          id="type"
          title="Type"
          code="SCALE"
          lede="Numerals are always mono and tabular, so a changing digit cannot shift a column. Nothing renders below 8.5px."
        >
          <div className="artinos-scale">
            {TYPE_SCALE.map(entry => (
              <div key={entry.token}>
                <code>{entry.token}</code>
                <small>{entry.use}</small>
                <span style={{ font: `var(${entry.token})`, color: 'var(--text-hi)' }}>{entry.sample}</span>
              </div>
            ))}
          </div>
        </ShowcaseSection>

        {/* ── space ──────────────────────────────────────────────────── */}
        <ShowcaseSection id="space" title="Space, radius & height" code="METRICS" lede="A 2px base in eight steps, four radii, and exactly three control heights.">
          <div className="artinos-showcase-grid">
            <Specimen name="Spacing" code="--space-*">
              <div className="artinos-scale">
                {SPACE_SCALE.map(token => (
                  <div key={token} style={{ gridTemplateColumns: '104px 56px minmax(0,1fr)' }}>
                    <code>{token}</code>
                    <small>{`var(${token})`}</small>
                    <i className="artinos-ruler" style={{ width: `var(${token})` }} />
                  </div>
                ))}
              </div>
            </Specimen>
            <Specimen name="Radius" code="--radius-*">
              <div className="artinos-specimen-stage is-row" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
                {RADIUS_SCALE.map(token => (
                  <div key={token} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    <i
                      style={{
                        display: 'block',
                        width: 46,
                        height: 46,
                        borderRadius: `var(${token})`,
                        background: 'var(--bg-raised)',
                        boxShadow: 'inset 0 0 0 1px var(--line)',
                      }}
                    />
                    <code style={{ font: '300 8px/1 var(--font-num)', color: 'var(--text-ghost)' }}>{token.replace('--radius-', '')}</code>
                  </div>
                ))}
              </div>
            </Specimen>
            <Specimen name="Control height" code="24 / 28 / 32" note="A one-off height means the component is doing two jobs.">
              <div className="artinos-specimen-stage is-row" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
                {HEIGHT_SCALE.map(token => (
                  <div
                    key={token}
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      height: `var(${token})`,
                      padding: '0 13px',
                      borderRadius: 'var(--radius-control)',
                      background: 'var(--bg-hover)',
                      boxShadow: 'inset 0 0 0 1px var(--line-subtle)',
                      font: '400 9px/1 var(--font-num)',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--text-mid)',
                    }}
                  >
                    {token.replace('--control-h', '').replace('-', '') || 'base'}
                  </div>
                ))}
              </div>
            </Specimen>
          </div>
        </ShowcaseSection>

        {/* ── elevation ──────────────────────────────────────────────── */}
        <ShowcaseSection id="elevation" title="Elevation" code="e0 – e3" lede="One meaning each. Recessed means editable; frost means floating chrome.">
          <div className="artinos-showcase-grid">
            {ELEVATIONS.map(step => (
              <Specimen key={step.token} name={step.label} code={step.token} note={step.meaning}>
                <i
                  style={{
                    display: 'block',
                    height: 56,
                    borderRadius: 'var(--radius-card)',
                    background: 'var(--bg-surface)',
                    boxShadow: `var(${step.token})`,
                  }}
                />
              </Specimen>
            ))}
          </div>
        </ShowcaseSection>

        {/* ── motion ─────────────────────────────────────────────────── */}
        <ShowcaseSection
          id="motion"
          title="Motion"
          code="DURATION · EASING"
          lede="Named by what moves, not by milliseconds. Entering and leaving are different gestures: something arriving decelerates into place, something leaving accelerates away and takes less time."
        >
          <div className="artinos-scale">
            {MOTION.map(entry => (
              <div key={entry.token} style={{ gridTemplateColumns: '132px minmax(0,1fr)' }}>
                <code>{entry.token}</code>
                <small style={{ color: 'var(--text-low)' }}>{entry.use}</small>
              </div>
            ))}
          </div>
        </ShowcaseSection>

        {/* ── numeric ────────────────────────────────────────────────── */}
        <ShowcaseSection
          id="numeric"
          title="Numeric controls"
          code="PL.03 · PL.04"
          lede="The scrub cell is the flagship: the row is the drag surface, the fill is the value and the hairline is its exact position. Drag it, or focus it and use the arrows."
        >
          <div className="artinos-showcase-grid">
            <Specimen name="Scrub cell" code="Slider" note="Drag anywhere on the row. Shift ×10, Alt ×0.1, double-click to type, Escape cancels.">
              <Slider label="Exposure" value={exposure} min={0} max={4} step={0.001} unit="EV" onChange={setExposure} />
              <Slider label="Bias" value={bias} min={-1} max={1} step={0.01} detents={[0]} onChange={setBias} />
              <Slider label="Gain" value={gain} min={0} max={1} step={0.01} binding="orb-pulse" status="bound" onChange={setGain} />
            </Specimen>
            <Specimen name="Range" code="RangeSlider" note="Pushing one handle past the other carries it rather than inverting.">
              <RangeSlider label="Clip range" value={clip} min={0} max={1} step={0.01} onChange={setClip} />
            </Specimen>
            <Specimen name="Dial" code="Dial" row note="Vertical drag; the same keyboard model as the scrub cell.">
              <Dial label="Feedback" value={gain} min={0} max={1} step={0.01} onChange={setGain} />
              <Dial label="Bias" value={bias} min={-1} max={1} step={0.01} onChange={setBias} />
            </Specimen>
            <Specimen name="Number" code="NumberField" note="For a value that is typed more often than dragged.">
              <NumberField label="Samples" value={samples} min={1} max={1048576} step={1} onChange={setSamples} />
            </Specimen>
          </div>
        </ShowcaseSection>

        {/* ── choice ─────────────────────────────────────────────────── */}
        <ShowcaseSection
          id="choice"
          title="Choice"
          code="PL.02 · PL.05"
          lede="Segmented up to four options; a select past that. State is never colour alone — a toggle carries its ON/OFF caption."
        >
          <div className="artinos-showcase-grid">
            <Specimen name="Toggle" code="Toggle">
              <Toggle label="Denoise" value={denoise} onChange={setDenoise} />
              <Toggle label="Motion blur" value={motionBlur} onChange={setMotionBlur} />
              <Toggle label="Locked" value={false} disabled onChange={() => {}} />
            </Specimen>
            <Specimen name="Checkbox" code="Checkbox" row note="The inline-flag idiom: the label is the state, so there is no caption.">
              <Checkbox label="Denoise" value={denoise} onChange={setDenoise} />
              <Checkbox label="Motion blur" value={motionBlur} onChange={setMotionBlur} />
              <Checkbox label="GPU" value={gpu} onChange={setGpu} />
            </Specimen>
            <Specimen name="Segmented" code="Segmented">
              <Segmented label="Shading" value={shading} options={['solid', 'wire', 'matcap']} onChange={setShading} />
            </Specimen>
            <Specimen name="Select" code="Select">
              <Select
                label="Colour space"
                value={colorspace}
                options={[
                  { label: 'ACEScg', value: 'acescg' },
                  { label: 'sRGB', value: 'srgb' },
                  { label: 'Rec.709', value: 'rec709' },
                  { label: 'Linear', value: 'linear' },
                ]}
                onChange={value => setColorspace(String(value))}
              />
            </Specimen>
            <Specimen name="Tabs" code="Tabs" note="Flush labels on a shared rule; only weight and brightness mark the active one.">
              <Tabs
                value={tab}
                items={[
                  { id: 'scene', label: 'Scene' },
                  { id: 'camera', label: 'Camera' },
                  { id: 'render', label: 'Render' },
                ]}
                onChange={setTab}
              />
            </Specimen>
          </div>
        </ShowcaseSection>

        {/* ── text & files ───────────────────────────────────────────── */}
        <ShowcaseSection id="text" title="Text, colour & files" code="PL.05" lede="Entry surfaces are recessed, because recessed means editable.">
          <div className="artinos-showcase-grid">
            <Specimen name="Text" code="TextField · TextArea">
              <TextField label="Name" value={name} onChange={setName} />
              <TextArea label="Notes" value={notes} rows={3} onChange={setNotes} />
            </Specimen>
            <Specimen name="Search" code="SearchField">
              <SearchField value={query} placeholder="Search project controls" onChange={setQuery} />
            </Specimen>
            <Specimen name="Colour" code="ColorField">
              <ColorField label="Tint" value={tint} onChange={setTint} />
            </Specimen>
            <Specimen name="Vector" code="VectorField" note="Two to four components under one label, each on the same numeric scale.">
              <VectorField label="Position" value={position} dimensions={3} onChange={setPosition} />
            </Specimen>
            <Specimen name="Files" code="FileField · DropZone">
              <FileField label="HDR / EXR" accept=".hdr,.exr" onFiles={() => {}} />
              <DropZone onFiles={() => {}}>Drop an environment map</DropZone>
            </Specimen>
            <Specimen name="Shortcut" code="KeyCapture" note="Click, then press the combination you want to bind.">
              <KeyCapture label="Re-render" value={shortcut} onChange={setShortcut} />
            </Specimen>
          </div>
        </ShowcaseSection>

        {/* ── instrument ─────────────────────────────────────────────── */}
        <ShowcaseSection
          id="instrument"
          title="Instrument controls"
          code="PL.04 · PL.07"
          lede="For creative work the value is a shape, not a number: a field, a curve, a ramp. These read live."
        >
          <div className="artinos-showcase-grid">
            <Specimen name="XY pad" code="XYPad" note="Two coupled values on one planar surface.">
              <InstrumentXYPad label="Offset" value={pad} min={[0, 0]} max={[1, 1]} onChange={setPad} />
            </Specimen>
            <Specimen name="Knob" code="Knob" row note="Angular, with detents, for dense racks.">
              <Knob label="Drive" value={gain} min={0} max={1} step={0.01} detents={[0.5]} onChange={setGain} />
              <Knob label="Mix" value={exposure / 4} min={0} max={1} step={0.01} onChange={v => setExposure(v * 4)} />
            </Specimen>
            <Specimen name="Meter" code="Meter">
              <InstrumentMeter label="Output" value={gain} status="live" unit="dB" />
              <InstrumentMeter label="Headroom" value={0.86} status="warn" />
              <InstrumentMeter label="Clip" value={0.98} status="fault" />
            </Specimen>
            <Specimen name="Waveform" code="Waveform" note="A sample buffer as a signal trace.">
              <Waveform label="Bass" samples={wave} status="live" />
            </Specimen>
            <Specimen name="Envelope" code="Envelope">
              <Envelope
                label="Attack / decay"
                points={[
                  { time: 0, value: 0 },
                  { time: 0.18, value: 1 },
                  { time: 0.5, value: 0.62 },
                  { time: 1, value: 0 },
                ]}
                status="live"
              />
            </Specimen>
            <Specimen name="Gradient" code="GradientBar">
              <GradientBar
                label="Ramp"
                stops={[
                  { offset: 0, color: '#08090a' },
                  { offset: 0.5, color: tint },
                  { offset: 1, color: '#f4f4f4' },
                ]}
              />
            </Specimen>
            <Specimen name="Curve" code="CurveEditor" note="Drag a breakpoint to reshape the response.">
              <CurveEditor label="Response" points={curve} onChange={setCurve} />
            </Specimen>
          </div>
        </ShowcaseSection>

        {/* ── display ────────────────────────────────────────────────── */}
        <ShowcaseSection id="display" title="Display" code="PL.06 · PL.07" lede="Read-only surfaces. A state is always a word as well as a hue.">
          <div className="artinos-showcase-grid">
            <Specimen name="Badges" code="Badge" row>
              <Badge>neutral</Badge>
              <Badge tone="accent">live</Badge>
              <Badge tone="warn">degraded</Badge>
              <Badge tone="danger">stopped</Badge>
            </Specimen>
            <Specimen name="Key / value" code="KeyValue">
              <KeyValue label="Backend" value="WebGPU" />
              <KeyValue label="Colour space" value="ACEScg" />
              <KeyValue label="Environment" value="STUDIO_SOFT_4K" />
            </Specimen>
            <Specimen name="Progress" code="Progress">
              <Progress label="Bake · 512 samples" value={0.68} />
            </Specimen>
            <Specimen name="Sparkline" code="Sparkline" note="Small enough to sit inside a row.">
              <Sparkline values={trend} />
            </Specimen>
            <Specimen name="Empty" code="Empty" note="An empty state should feel designed, not like a bug.">
              <Empty>No bindings yet — drag a parameter onto a controller channel.</Empty>
            </Specimen>
          </div>
        </ShowcaseSection>

        {/* ── composition ────────────────────────────────────────────── */}
        <ShowcaseSection
          id="composition"
          title="Composition"
          code="AS.01 · §38"
          lede="PropertyRow is the structural unit of the inspector: it gives label, control, unit, status, reset and actions one consistent relationship, so no panel re-invents that arrangement."
        >
          <div className="artinos-showcase-grid">
            <Specimen name="Property rows" code="PropertyRow">
              <PropertyRow label="Exposure" unit="EV" onReset={() => setExposure(1)}>
                <Slider label="Exposure" value={exposure} min={0} max={4} step={0.001} onChange={setExposure} />
              </PropertyRow>
              <PropertyRow label="Gain" binding="orb-pulse" status="bound">
                <Slider label="Gain" value={gain} min={0} max={1} step={0.01} onChange={setGain} />
              </PropertyRow>
              <PropertyRow label="Samples" status="warn" message="Above the budget for interactive preview.">
                <NumberField label="Samples" value={samples} onChange={setSamples} />
              </PropertyRow>
              <PropertyRow label="Output" status="fault" message="Path is not writable.">
                <TextField label="Output" value="/renders/final" onChange={() => {}} />
              </PropertyRow>
              <PropertyRow label="Mixed" mixed>
                <NumberField label="Mixed" value={0} onChange={() => {}} />
              </PropertyRow>
            </Specimen>
            <Specimen name="Section & stack" code="Section · Stack">
              <Section title="Environment" description="Lighting and the image-based rig.">
                <Stack>
                  <Toggle label="Denoise" value={denoise} onChange={setDenoise} />
                  <Slider label="Intensity" value={gain} min={0} max={2} step={0.01} onChange={setGain} />
                </Stack>
              </Section>
            </Specimen>
            <Specimen name="Collapsible" code="Collapsible">
              <Collapsible title="Advanced" badge={<Badge>6</Badge>} defaultOpen={false}>
                <Stack>
                  <Toggle label="GPU" value={gpu} onChange={setGpu} />
                  <NumberField label="Shadow map" value={2048} step={256} onChange={() => {}} />
                </Stack>
              </Collapsible>
            </Specimen>
            <Specimen name="Toolbar" code="Toolbar" note="Button hierarchy: one primary, the rest quiet.">
              <Toolbar>
                <Button active onClick={() => {}}>
                  Render
                </Button>
                <Button onClick={() => {}}>Preview</Button>
                <IconButton title="Reset" onClick={() => {}}>
                  ↺
                </IconButton>
              </Toolbar>
            </Specimen>
          </div>
        </ShowcaseSection>

        {/* ── states ─────────────────────────────────────────────────── */}
        <ShowcaseSection
          id="states"
          title="States"
          code="§15–16"
          lede="Every control carries the same vocabulary. Colour marks the state, but a word always carries it too — bound rows name their driver and faults carry text."
        >
          <div className="artinos-showcase-grid">
            <Specimen name="Scrub cell states" code="data-state">
              <Slider label="Rest" value={0.4} onChange={() => {}} />
              <Slider label="Bound" value={0.55} binding="orb-pulse" status="bound" onChange={() => {}} />
              <Slider label="Degraded" value={0.72} status="warn" onChange={() => {}} />
              <Slider label="Invalid" value={0.9} status="fault" onChange={() => {}} />
              <Slider label="Disabled" value={0.3} disabled onChange={() => {}} />
            </Specimen>
            <Specimen name="Signal meaning" code="--sig-*">
              <KeyValue label="Teal" value="running · armed · enabled" />
              <KeyValue label="Azure" value="externally driven" />
              <KeyValue label="Amber" value="degraded but proceeding" />
              <KeyValue label="Rose" value="stopped · invalid · destructive" />
            </Specimen>
          </div>
        </ShowcaseSection>

        {/* ── catalog ────────────────────────────────────────────────── */}
        <ShowcaseSection id="catalog" title="Component catalog" code={`${catalog.length} ENTRIES`} lede="Every component with its category and the states it can hold.">
          <div className="artinos-catalog">
            <div className="is-head">
              <span>Component</span>
              <span>Category</span>
              <span>Description</span>
              <span>States</span>
            </div>
            {catalog.map(entry => (
              <div key={entry.name}>
                <b>{entry.name}</b>
                <code>{entry.category}</code>
                <small>{entry.description}</small>
                <code>{entry.states}</code>
              </div>
            ))}
          </div>
        </ShowcaseSection>

        {/* ── accessibility ──────────────────────────────────────────── */}
        <ShowcaseSection id="a11y" title="Accessibility floor" code="NON-NEGOTIABLE" lede="These are not targets. A change that breaks one of them is a regression.">
          <div className="artinos-scale">
            {A11Y.map(line => (
              <div key={line} style={{ gridTemplateColumns: '18px minmax(0,1fr)' }}>
                <span style={{ color: 'var(--sig-live)', fontSize: 9 }}>◆</span>
                <small style={{ color: 'var(--text-mid)', lineHeight: 1.7 }}>{line}</small>
              </div>
            ))}
          </div>
        </ShowcaseSection>
      </main>
      </div>

      <TokenStudio />
    </div>
  )
}
