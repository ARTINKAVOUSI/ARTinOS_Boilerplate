import { useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { consoleStore, useConsoleEntries, type LogLevel } from '../app/console'
import { PanelBar } from '../app/studio/PanelBar'
import { TextField } from '../ui/TextField/TextField'
import { Select } from '../ui/Select/Select'
import { Button } from '../ui/Button/Button'
import { Switch } from '../ui/Switch/Switch'

const LEVELS = ['all', 'error', 'warn', 'info', 'log'] as const
const title = (value: string) => value[0].toUpperCase() + value.slice(1)

function Console() {
  const entries = useConsoleEntries()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('all')
  const [paused, setPaused] = useState(consoleStore.isPaused())
  const needle = query.trim().toLowerCase()
  const visible = entries.filter(entry => (level === 'all' || entry.level === (level as LogLevel)) && (!needle || entry.detail.toLowerCase().includes(needle))).slice(-300).reverse()
  const count = (value: LogLevel) => entries.filter(entry => entry.level === value).length

  return (
    <div className="artinos-panel-suite">
      {/* The same toolbar row every panel has: it rides in the dock strip when there is room. */}
      <PanelBar>
        {/* Filters the captured log, which the palette cannot do — not the studio search. */}
        <TextField type="search" size="sm" value={query} onChange={setQuery} label="Filter messages" placeholder="Filter messages" />
        <Select
          appearance="well"
          label="Level"
          value={level}
          onChange={setLevel}
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
      </PanelBar>
      {visible.length === 0 ? (
        <div className="v2-empty">
          <b>{entries.length ? 'No message matches' : 'Nothing logged yet'}</b>
          {entries.length ? 'Nothing in the log fits this filter and level.' : 'Warnings, errors and console output from the runtime land here as they happen.'}
        </div>
      ) : (
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
      )}
    </div>
  )
}

export default Console

export const panel: PanelManifest = {
  id: 'console',
  title: 'Console',
  description: 'Runtime log output',
  keywords: ['logs', 'errors', 'warnings', 'output'],
  order: 8,
  footer: () => <>RUNTIME LOG</>,
  component: Console,
}
