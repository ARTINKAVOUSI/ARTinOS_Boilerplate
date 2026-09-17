import { useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { consoleStore, useConsoleEntries, type LogLevel } from '../app/console'
import { TextField } from '../ui/TextField/TextField'
import { Select } from '../ui/Select/Select'
import { Button } from '../ui/Button/Button'
import { Toggle } from '../ui/Toggle/Toggle'

const LEVELS = ['all', 'error', 'warn', 'info', 'log'] as const

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
      <div className="v2-panel-bar">
        <TextField type="search" size="sm" value={query} onChange={setQuery} label="Search the log" placeholder="Search messages" />
        <Select
          size="sm"
          label="Level"
          value={level}
          onChange={setLevel}
          options={LEVELS.map(value => ({ value, label: value === 'all' ? `All · ${entries.length}` : `${value} · ${count(value)}` }))}
        />
        <span className="v2-spacer" />
        <label className="v2-inline-toggle">
          Pause
          <Toggle
            size="sm"
            label="Pause capture"
            checked={paused}
            onChange={value => {
              consoleStore.setPaused(value)
              setPaused(value)
            }}
          />
        </label>
        <Button size="sm" onClick={() => consoleStore.clear()}>
          Clear
        </Button>
      </div>
      {visible.length === 0 ? (
        <div className="v2-empty">{entries.length ? 'No message matches.' : 'Nothing logged yet.'}</div>
      ) : (
        <div className="artinos-console-entries">
          {visible.map(entry => (
            <details key={entry.id} className={`artinos-console-entry log-${entry.level}`}>
              <summary>
                <time>{new Date(entry.time).toLocaleTimeString()}</time>
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
