import { useMemo, useState } from 'react'
import { useArtinosRuntime, type RuntimeLog } from '@artinos/runtime'
import { Button, SearchField, Select, Toolbar } from '@artinos/ui'
import { useLogs } from '../hooks'
import { PanelEmpty } from '@artinos/ui'

export function ConsolePanel() {
  const runtime = useArtinosRuntime(), logs = useLogs()
  const [level, setLevel] = useState('all'), [query, setQuery] = useState('')
  const [paused, setPaused] = useState<RuntimeLog[] | null>(null)
  const source = paused ?? logs
  const visible = useMemo(() => [...source].reverse().filter(log => (level === 'all' || log.level === level) && `${log.message} ${log.source ?? ''}`.toLowerCase().includes(query.toLowerCase())), [source, level, query])
  return <div className="artinos-console-panel">
    <Toolbar>
      <SearchField value={query} onChange={setQuery} placeholder="Search messages or sources" />
      <Select label="Level" value={level} onChange={setLevel} options={['all', 'debug', 'info', 'warn', 'error'].map(value => ({ value, label: value === 'all' ? 'All levels' : `${value} (${source.filter(log => log.level === value).length})` }))} />
      <Button active={paused !== null} onClick={() => setPaused(paused ? null : [...logs])}>{paused ? 'Resume display' : 'Pause display'}</Button>
      <Button disabled={!logs.length && !paused?.length} onClick={() => { runtime.logger.clear(); if (paused) setPaused([]) }}>Clear log</Button>
    </Toolbar>
    <div className="artinos-panel-summary"><span>{visible.length} messages {paused ? '· display paused' : '· live'}</span><span>Newest first · expand to read full message</span></div>
    {visible.length ? <div className="artinos-console-entries">{visible.map(log => <details key={log.id} className={`artinos-console-entry log-${log.level}`}>
      <summary><time>{(log.timestamp / 1000).toFixed(2)}s</time><b>{log.level}</b><span>{log.source ?? 'Runtime'}</span><span>{log.message}</span></summary>
      <pre>{log.message}{log.data !== undefined ? `\n\n${formatData(log.data)}` : ''}</pre>
    </details>)}</div> : <PanelEmpty title={query || level !== 'all' ? 'No matching messages' : 'All clear'} description={query || level !== 'all' ? 'Try another source, search term or severity level.' : 'Runtime messages and errors will appear here as you work.'} />}
  </div>
}
function formatData(data: unknown) { try { return JSON.stringify(data, null, 2) } catch { return String(data) } }
