import { useMemo } from 'react'
import { createAgentAPI, useArtinosRuntime } from '@artinos/runtime'
import { Button, KeyValue, Section } from '@artinos/ui'

export function AgentPanel() {
  const runtime = useArtinosRuntime()
  const api = useMemo(() => createAgentAPI(runtime), [runtime])
  const quality = api.quality.get()

  return (
    <Section title="Semantic Agent API" description="The same semantic runtime used by panels, graph and automation">
      <KeyValue label="Parameters" value={api.parameters.list().length} />
      <KeyValue label="Signals" value={api.signals.list().length} />
      <KeyValue label="Modules" value={api.modules.list().length} />
      <KeyValue label="Resources" value={api.resources.list().length} />
      <KeyValue label="Quality" value={`${quality.tier} / ${quality.scalar.toFixed(2)}`} />
      <Button onClick={() => navigator.clipboard?.writeText(JSON.stringify(api.snapshot(), null, 2))}>Copy Runtime Snapshot</Button>
    </Section>
  )
}
