import { useMemo, useState } from 'react'
import { Activity, Cpu, Database, Gauge } from 'lucide-react'
import { useArtinosRuntime, type FrameProfileResource } from '@artinos/runtime'
import { Button, KeyValue, Sparkline, VirtualList } from '../primitives'
import { useTelemetry } from '../hooks'
import { formatBytes } from './format'

const GROUPS = ['performance', 'renderer', 'memory', 'postfx', 'runtime', 'input', 'graph', 'all']
const ROW_HEIGHT = 24

export function TelemetryPanel() {
  const runtime = useArtinosRuntime()
  const metrics = useTelemetry()
  const [group, setGroup] = useState('performance')
  const [selected, setSelected] = useState('performance.fps')

  const filtered = useMemo(() => metrics.filter(metric => group === 'all' || metric.group === group), [metrics, group])
  const numeric = useMemo(() => filtered.filter(metric => typeof metric.value === 'number'), [filtered])

  const metricId = numeric.some(metric => metric.id === selected) ? selected : numeric[0]?.id ?? selected
  const history = runtime.telemetry.history(metricId)
  const profile = runtime.resources.get<FrameProfileResource>('telemetry.frameProfile')?.current

  const find = (id: string) => metrics.find(metric => metric.id === id)
  const stat = (id: string, fallback = '—') => {
    const metric = find(id)
    if (!metric) return fallback
    const value = typeof metric.value === 'number' ? metric.value.toFixed(metric.value >= 100 ? 0 : 1) : metric.value
    return `${value}${metric.unit ? ` ${metric.unit}` : ''}`
  }

  const budget = 1000 / runtime.quality.getState().targetFps
  const cpuWidth = Math.min(100, ((profile?.cpuMs ?? 0) / budget) * 100)
  const gpuWidth = Math.min(100 - cpuWidth, ((profile?.gpuMs ?? 0) / budget) * 100)
  const memoryBytes = Number(find('memory.totalBytes')?.value ?? find('memory.estimatedBytes')?.value ?? 0)
  const latest = history.at(-1)
  const minimum = history.length ? Math.min(...history) : 0
  const maximum = history.length ? Math.max(...history) : 0

  return (
    <div className="artinos-telemetry-dashboard">
      <div className="artinos-telemetry-kpis">
        <article>
          <Gauge />
          <span>
            <small>Frame rate</small>
            <b>{stat('performance.fps')}</b>
          </span>
        </article>
        <article>
          <Cpu />
          <span>
            <small>CPU render</small>
            <b>{stat('performance.cpuLoad')}</b>
          </span>
        </article>
        <article>
          <Activity />
          <span>
            <small>GPU render</small>
            {/* GPU load comes from WebGPU timestamp queries only — never estimated. */}
            <b>{find('performance.gpuLoad') ? stat('performance.gpuLoad') : 'timestamp unavailable'}</b>
          </span>
        </article>
        <article>
          <Database />
          <span>
            <small>GPU memory</small>
            <b>{memoryBytes ? formatBytes(memoryBytes) : 'collecting'}</b>
          </span>
        </article>
      </div>

      <section className="artinos-frame-profile" aria-label="Resolved frame profile">
        <header>
          <span>
            <small>Frame profile</small>
            <b>{profile?.source ?? 'Waiting for Three Inspector'}</b>
          </span>
          <strong>
            {profile?.totalMs.toFixed(2) ?? '—'} <small>ms total</small>
          </strong>
        </header>
        <div className="artinos-frame-budget">
          <i className="is-cpu" style={{ width: `${cpuWidth}%` }} />
          <i className="is-gpu" style={{ width: `${gpuWidth}%` }} />
          <span style={{ left: `${Math.min(100, (1000 / 60 / budget) * 100)}%` }} />
        </div>
        <footer>
          <span>
            <i className="is-cpu" />
            CPU {profile?.cpuMs.toFixed(2) ?? '—'} ms
          </span>
          <span>
            <i className="is-gpu" />
            GPU {profile?.timestampAvailable ? `${profile.gpuMs.toFixed(2)} ms` : 'timestamp unavailable'}
          </span>
          <span>{profile?.passes.length ?? 0} passes</span>
          {profile?.passes.slice(0, 4).map(pass => (
            <button key={pass.id} title={`${pass.name}: CPU ${pass.cpuMs.toFixed(2)} ms${pass.gpuAvailable ? ` · GPU ${pass.gpuMs.toFixed(2)} ms` : ''}`}>
              {pass.kind} · {pass.name}
            </button>
          ))}
        </footer>
      </section>

      <div className="artinos-telemetry-command">
        <label>
          Explore
          <select value={group} onChange={event => setGroup(event.target.value)}>
            {GROUPS.map(id => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <span>{filtered.length} live metrics</span>
        <Button onClick={() => runtime.telemetry.clearHistory()}>Reset history</Button>
      </div>

      <div className="artinos-telemetry-main">
        <section className="artinos-telemetry-metrics" aria-label="Runtime metrics">
          <VirtualList items={filtered} itemHeight={ROW_HEIGHT} empty={<KeyValue label="Status" value="Waiting for runtime samples" />}>
            {metric => (
              <button
                className={`artinos-telemetry-row ${metricId === metric.id ? 'is-selected' : ''}`}
                onClick={() => typeof metric.value === 'number' && setSelected(metric.id)}
              >
                <span>
                  <small>{metric.group}</small>
                  {metric.id.replace(`${metric.group}.`, '')}
                </span>
                <output>
                  {typeof metric.value === 'number' ? metric.value.toFixed(metric.value >= 100 ? 0 : 2) : String(metric.value)}
                  {metric.unit ? ` ${metric.unit}` : ''}
                </output>
              </button>
            )}
          </VirtualList>
        </section>

        <section className="artinos-telemetry-chart">
          <header>
            <span>
              <small>Selected metric</small>
              <b>{metricId}</b>
            </span>
            <strong>{latest?.toFixed(2) ?? '—'}</strong>
          </header>
          {history.length > 1 ? <Sparkline values={history} width={640} height={118} /> : <div className="artinos-chart-empty">Collecting history…</div>}
          <footer>
            <span>
              MIN <b>{minimum.toFixed(2)}</b>
            </span>
            <span>
              MAX <b>{maximum.toFixed(2)}</b>
            </span>
            <span>
              SAMPLES <b>{history.length}</b>
            </span>
          </footer>
        </section>
      </div>
    </div>
  )
}
