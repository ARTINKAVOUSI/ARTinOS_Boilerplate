import { useState, useSyncExternalStore, type CSSProperties } from 'react'
import type { PanelManifest } from '../app/panel'
import { consoleStore, useConsoleEntries, type LogLevel } from '../app/console'
import { formatBytes, useProfiler, type PassStat } from '../app/profiler'
import { PanelBar } from '../app/studio/PanelBar'
import { TextField } from '../ui/TextField/TextField'
import { Select } from '../ui/Select/Select'
import { Segmented } from '../ui/Segmented/Segmented'
import { Sparkline } from '../ui/Sparkline/Sparkline'
import { Button } from '../ui/Button/Button'
import { Switch } from '../ui/Switch/Switch'
import './Console.css'

const LEVELS = ['all', 'error', 'warn', 'info', 'log'] as const
const VIEWS = ['log', 'performance', 'memory'] as const
type View = (typeof VIEWS)[number]
const title = (value: string) => value[0].toUpperCase() + value.slice(1)
const ms = (value: number) => (value >= 10 ? value.toFixed(1) : value.toFixed(2))

/**
 * The runtime's console: the captured log, and the renderer as three.js's
 * Inspector sees it — every pass of a frame with its CPU and GPU time, and the
 * GPU memory by kind (`app/profiler`, measured only while a view is open).
 */
function Console() {
  const [view, setView] = useState<View>('log')
  const entries = useConsoleEntries()
  const errors = entries.filter(entry => entry.level === 'error').length

  return (
    <div className="artinos-panel-suite">
      <PanelBar>
        <Segmented<View>
          className="console-views"
          label="Console view"
          value={view}
          onChange={setView}
          options={VIEWS.map(value => ({ value, label: value === 'log' && errors ? `Log · ${errors}` : title(value) }))}
        />
        {view === 'log' && <LogControls />}
      </PanelBar>
      {view === 'log' && <LogView />}
      {view === 'performance' && <PerformanceView />}
      {view === 'memory' && <MemoryView />}
    </div>
  )
}

/* ── log ───────────────────────────────────────────────────────────────── */

type Level = (typeof LEVELS)[number]
/** The filter is shared by the bar (which may ride in the dock strip) and the list. */
let logFilter: { query: string; level: Level } = { query: '', level: 'all' }
const filterListeners = new Set<() => void>()
const setFilter = (next: Partial<typeof logFilter>) => {
  logFilter = { ...logFilter, ...next }
  filterListeners.forEach(listener => listener())
}
const subscribeFilter = (listener: () => void) => {
  filterListeners.add(listener)
  return () => filterListeners.delete(listener)
}
const useFilter = () => useSyncExternalStore(subscribeFilter, () => logFilter)

function LogControls() {
  const entries = useConsoleEntries()
  const filter = useFilter()
  const [paused, setPaused] = useState(consoleStore.isPaused())
  const count = (value: LogLevel) => entries.filter(entry => entry.level === value).length
  return (
    <>
      <TextField type="search" size="sm" value={filter.query} onChange={value => setFilter({ query: value })} label="Filter messages" placeholder="Filter messages" />
      <Select
        appearance="well"
        label="Level"
        value={filter.level}
        onChange={value => setFilter({ level: value })}
        options={LEVELS.map(value => ({ value, label: value === 'all' ? `All · ${entries.length}` : `${title(value)} · ${count(value)}` }))}
      />
      <label className="v2-inline-toggle">
        Pause
        <Switch
          variant="compact"
          label="Pause capture"
          value={paused}
          onChange={value => {
            consoleStore.setPaused(value)
            setPaused(value)
          }}
        />
      </label>
      <Button size="sm" disabled={!entries.length} onClick={() => consoleStore.clear()}>
        Clear
      </Button>
    </>
  )
}

function LogView() {
  const entries = useConsoleEntries()
  const filter = useFilter()
  const needle = filter.query.trim().toLowerCase()
  const visible = entries
    .filter(entry => (filter.level === 'all' || entry.level === (filter.level as LogLevel)) && (!needle || entry.detail.toLowerCase().includes(needle)))
    .slice(-300)
    .reverse()

  if (visible.length === 0)
    return (
      <div className="v2-empty">
        <b>{entries.length ? 'No message matches' : 'Nothing logged yet'}</b>
        {entries.length ? 'Nothing in the log fits this filter and level.' : 'Warnings, errors and console output from the runtime land here as they happen.'}
      </div>
    )
  return (
    <div className="artinos-console-entries">
      {visible.map(entry => (
        <details key={entry.id} className={`artinos-console-entry log-${entry.level}`}>
          <summary>
            <time>{new Date(entry.time).toLocaleTimeString([], { hour12: false })}</time>
            <b>{entry.level}</b>
            <b>{entry.source}</b>
            <span>{entry.message}</span>
          </summary>
          <pre>{entry.detail}</pre>
        </details>
      ))}
    </div>
  )
}

/* ── performance ───────────────────────────────────────────────────────── */

function Figure({ label, value, unit, values, tone, max }: { label: string; value: string; unit?: string; values?: number[]; tone?: 'live' | 'warm' | 'neutral'; max?: number }) {
  return (
    <div className="console-figure">
      <small>{label}</small>
      <strong>
        {value}
        {unit && <span>{unit}</span>}
      </strong>
      {values && <Sparkline values={values} min={0} max={max} width={160} height={24} tone={tone} label={`${label}, recent history`} />}
    </div>
  )
}

function PerformanceView() {
  const profile = useProfiler()
  const frame = profile.fps > 0 ? 1000 / profile.fps : 0
  const scale = Math.max(frame, profile.cpu + profile.gpu, 0.001)
  const peak = Math.max(16.7, ...profile.cpuHistory, ...profile.gpuHistory)

  if (!profile.attached) return <div className="v2-empty"><b>Waiting for the renderer</b>The profiler attaches as soon as the canvas has a renderer.</div>

  const rows: Array<{ pass: PassStat; depth: number }> = []
  const walk = (pass: PassStat, depth: number) => {
    rows.push({ pass, depth })
    pass.children.forEach(child => walk(child, depth + 1))
  }
  profile.passes.forEach(pass => walk(pass, 0))

  return (
    <div className="console-view">
      <div className="console-figures">
        <Figure label="Frame rate" value={String(Math.round(profile.fps))} unit="fps" />
        <Figure label="CPU" value={ms(profile.cpu)} unit="ms" values={profile.cpuHistory} max={peak} />
        <Figure label="GPU" value={profile.gpuTimings ? ms(profile.gpu) : '—'} unit={profile.gpuTimings ? 'ms' : undefined} values={profile.gpuTimings ? profile.gpuHistory : undefined} tone="warm" max={peak} />
        <Figure label="Idle" value={ms(profile.idle)} unit="ms" />
      </div>
      {!profile.gpuTimings && <p className="v2-note">GPU times need the device's <code>timestamp-query</code> feature, which this browser or adapter does not expose. CPU times are measured either way.</p>}

      <div className="console-table console-passes" role="table" aria-label="Render and compute passes">
        <div className="console-table__head" role="row">
          <span role="columnheader">Pass</span>
          <span role="columnheader">CPU</span>
          <span role="columnheader">GPU</span>
          <span role="columnheader">Share of frame</span>
        </div>
        {rows.length === 0 && <div className="console-table__empty">No passes recorded yet.</div>}
        {rows.map(({ pass, depth }) => (
          <div key={pass.id} className="console-table__row" role="row" data-depth={depth} style={{ '--depth': depth } as CSSProperties}>
            <span role="cell" className="console-table__name">
              {pass.name}
              {pass.kind === 'compute' && <em>compute</em>}
            </span>
            <span role="cell">{ms(pass.cpu)}</span>
            <span role="cell">{profile.gpuTimings ? ms(pass.gpu) : '—'}</span>
            <span role="cell" className="console-bar" aria-label={`${Math.round(((pass.cpu + pass.gpu) / scale) * 100)}% of the frame`}>
              <i style={{ width: `${Math.min(100, (pass.cpu / scale) * 100)}%` }} />
              <i data-gpu style={{ width: `${Math.min(100, (pass.gpu / scale) * 100)}%` }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── memory ────────────────────────────────────────────────────────────── */

function MemoryView() {
  const profile = useProfiler()
  if (!profile.attached) return <div className="v2-empty"><b>Waiting for the renderer</b>The profiler attaches as soon as the canvas has a renderer.</div>
  const largest = Math.max(1, ...profile.memory.map(row => row.bytes ?? 0))

  return (
    <div className="console-view">
      <div className="console-figures">
        <Figure label="GPU memory" value={formatBytes(profile.memoryTotal)} values={profile.memoryHistory} />
        <Figure label="Textures" value={String(profile.memory.find(row => row.name === 'Textures')?.count ?? 0)} />
        <Figure label="Geometries" value={String(profile.memory.find(row => row.name === 'Geometries')?.count ?? 0)} />
        <Figure label="Programs" value={String(profile.memory.find(row => row.name === 'Programs')?.count ?? 0)} />
      </div>
      <div className="console-table console-memory" role="table" aria-label="Renderer memory by kind">
        <div className="console-table__head" role="row">
          <span role="columnheader">Kind</span>
          <span role="columnheader">Count</span>
          <span role="columnheader">Size</span>
          <span role="columnheader">Share</span>
        </div>
        {profile.memory.map(row => (
          <div key={row.name} className="console-table__row" role="row" data-empty={row.count === 0 || undefined}>
            <span role="cell" className="console-table__name">{row.name}</span>
            <span role="cell">{row.count}</span>
            <span role="cell">{row.bytes === null ? '—' : formatBytes(row.bytes)}</span>
            <span role="cell" className="console-bar">{row.bytes !== null && <i style={{ width: `${(row.bytes / largest) * 100}%` }} />}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Console

export const panel: PanelManifest = {
  id: 'console',
  title: 'Console',
  description: 'Runtime log, render passes with CPU and GPU time, and GPU memory',
  keywords: ['logs', 'errors', 'warnings', 'output', 'performance', 'profiler', 'gpu', 'memory', 'passes', 'inspector'],
  order: 8,
  footer: () => <>RUNTIME LOG · PROFILER</>,
  component: Console,
}
