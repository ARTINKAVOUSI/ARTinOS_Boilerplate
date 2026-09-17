import { useMemo, useState } from 'react'
import { Button, SearchField, Select, Toolbar, VirtualList } from '@artinos/ui'
import { useSignals } from '../hooks'
import { formatValue } from '@artinos/ui'
export function SignalsPanel() {
  const signals = useSignals()
  const [query, setQuery] = useState(''), [source, setSource] = useState('all')
  const [frozen, setFrozen] = useState<typeof signals | null>(null)
  const samples = frozen ?? signals
  const sources = [...new Set(samples.map(signal => signal.id.split('.')[0]))].sort()
  const filtered = useMemo(() => samples.filter(signal => (source === 'all' || signal.id.startsWith(`${source}.`)) && signal.id.toLowerCase().includes(query.toLowerCase())), [samples, source, query])
  return <div className="artinos-signals-panel">
    <Toolbar><SearchField value={query} onChange={setQuery} placeholder="Search signals" /><Select label="Source" value={source} options={[{ value: 'all', label: 'All sources' }, ...sources.map(value => ({ value, label: value }))]} onChange={setSource} /><Button active={frozen !== null} onClick={() => setFrozen(frozen ? null : [...signals])}>{frozen ? 'Resume monitor' : 'Freeze values'}</Button></Toolbar>
    <div className="artinos-panel-summary"><span>{filtered.length} signals · {frozen ? 'frozen snapshot' : 'live values'}</span><span>Source / last update / value</span></div>
    <VirtualList items={filtered} itemHeight={48} empty={query || source !== 'all' ? 'No signals match these filters.' : 'Connect a device to publish live signals.'}>
      {signal => <div className="artinos-signal-row"><span title={signal.id}>{signal.id}<small>{Math.max(0, performance.now() - signal.timestamp).toFixed(0)}ms ago · {Array.isArray(signal.value) ? 'vector' : typeof signal.value}</small></span><output title={formatValue(signal.value)}>{formatValue(signal.value)}</output></div>}
    </VirtualList>
  </div>
}
