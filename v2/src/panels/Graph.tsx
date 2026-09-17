import { useEffect, useMemo, useRef, useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { graphs, parameterOptions, useGraphs } from '../app/graphs'
import { applyLiveControl, buildLiveGraph } from '../app/live-graph'
import { PanelBar } from '../app/studio/PanelBar'
import { Icons } from '../app/studio/icons'
import { NodeGraph } from '../ui/NodeGraph/NodeGraph'
import { LiveGraph } from '../ui/NodeGraph/LiveGraph'
import type { GraphDiagnostic } from '../ui/NodeGraph/graph'
import { useSignalSnapshot } from '../features/input/signals'
import { Segmented } from '../ui/Segmented/Segmented'
import { Select } from '../ui/Select/Select'
import { Button } from '../ui/Button/Button'
import { IconButton } from '../ui/IconButton/IconButton'
import { TextField } from '../ui/TextField/TextField'
import { Toggle } from '../ui/Toggle/Toggle'
import { useToast } from '../ui/Toast/Toast'

type View = 'live' | 'edit'

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * The pipeline as it is running right now: inputs, the graphs shaping their
 * signals, the controls being driven, the scene features that draw and the
 * effect chain to the canvas. Every switch and slider on a node edits the real
 * thing — this is the studio, drawn as a graph.
 */
function LivePipeline() {
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    const timer = setInterval(() => setTick(value => value + 1), 250)
    return () => clearInterval(timer)
  }, [])
  const data = useMemo(buildLiveGraph, [tick])
  return <LiveGraph className="v2-graph-editor" data={data} selected={selected} onSelect={setSelected} onControl={applyLiveControl} />
}

function Graph() {
  const toast = useToast()
  const { documents, readouts } = useGraphs()
  const [view, setView] = useState<View>('live')
  const [activeId, setActiveId] = useState<string | null>(documents[0]?.id ?? null)
  const [diagnostics, setDiagnostics] = useState<GraphDiagnostic[]>([])
  const [renaming, setRenaming] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const active = documents.find(document => document.id === activeId) ?? documents[0] ?? null
  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id)
  }, [active, activeId])

  const signals = useSignalSnapshot(4).map(([name]) => name)
  const parameters = useMemo(parameterOptions, [])
  const blocked = diagnostics.some(item => item.severity === 'error')
  const running = documents.filter(document => document.running).length

  const newGraph = () => {
    setActiveId(graphs.create(documents.length ? undefined : 'Modulation'))
    setView('edit')
  }

  return (
    <div className="artinos-panel-suite v2-graph-suite">
      <PanelBar>
        <Segmented<View>
          size="sm"
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'live', label: 'Live pipeline' },
            { value: 'edit', label: `Graphs · ${documents.length}` },
          ]}
        />

        {view === 'edit' && documents.length > 0 && (
          <>
            <Select
              size="sm"
              label="Graph"
              value={active?.id ?? ''}
              onChange={setActiveId}
              options={documents.map(document => ({ value: document.id, label: document.name }))}
            />
            {active && (
              <label className="v2-inline-toggle">
                Run
                <Toggle size="sm" label={`Run ${active.name}`} checked={active.running} disabled={blocked && !active.running} onChange={value => graphs.setRunning(active.id, value)} />
              </label>
            )}
          </>
        )}
        {view === 'live' && <span className="artinos-panel-summary v2-bar-summary">{running} OF {documents.length} GRAPHS RUNNING</span>}

        <span className="v2-spacer" />
        <IconButton size="sm" label="New graph" icon={Icons.plus} onClick={newGraph} />
        {view === 'edit' && active && <IconButton size="sm" label={`Rename ${active.name}`} icon={Icons.bookmark} onClick={() => setRenaming(true)} />}
        <IconButton size="sm" label="Export graphs" icon={Icons.download} onClick={() => download('artinos-graphs.json', graphs.exportJSON())} />
        <IconButton size="sm" label="Import graphs" icon={Icons.upload} onClick={() => file.current?.click()} />
        {view === 'edit' && active && (
          <IconButton
            size="sm"
            label={`Delete ${active.name}`}
            icon={Icons.trash}
            onClick={() => {
              graphs.remove(active.id)
              toast({ title: `Deleted “${active.name}”` })
            }}
          />
        )}
      </PanelBar>

      {renaming && active && view === 'edit' && (
        <div className="v2-panel-bar">
          <TextField
            size="sm"
            label="Graph name"
            value={active.name}
            autoFocus
            onChange={name => graphs.rename(active.id, name)}
            onKeyDown={event => event.key === 'Enter' && setRenaming(false)}
            onBlur={() => setRenaming(false)}
          />
        </div>
      )}

      {view === 'live' ? (
        <LivePipeline />
      ) : !documents.length ? (
        <div className="v2-empty">
          No graphs yet. A graph shapes live signals into controls — audio.bass into Bloom strength, an oscillator into camera height. It then appears in the live pipeline, wired to what it drives.
          <div style={{ marginTop: 10 }}>
            <Button size="sm" variant="primary" icon={Icons.plus} onClick={newGraph}>
              New graph
            </Button>
          </div>
        </div>
      ) : (
        active && (
          <>
            {blocked && !active.running && <div className="artinos-panel-notice">Fix the errors below to run this graph.</div>}
            <NodeGraph
              key={active.id}
              className="v2-graph-editor"
              value={active.graph}
              onChange={graph => graphs.setGraph(active.id, graph)}
              readouts={readouts[active.id]}
              signals={signals}
              parameters={parameters}
              onDiagnostics={setDiagnostics}
            />
          </>
        )
      )}

      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async event => {
          const picked = event.target.files?.[0]
          event.target.value = ''
          if (!picked) return
          try {
            graphs.importJSON(await picked.text())
            toast({ tone: 'success', title: 'Graphs imported', description: picked.name })
          } catch (error) {
            toast({ tone: 'error', title: 'Import failed', description: error instanceof Error ? error.message : String(error) })
          }
        }}
      />
    </div>
  )
}

function GraphFooter() {
  const { documents } = useGraphs()
  const running = documents.filter(document => document.running).length
  return (
    <>
      PIPELINE · {documents.length} GRAPHS · {running} RUNNING
    </>
  )
}

export default Graph

export const panel: PanelManifest = {
  id: 'graph',
  title: 'Graph',
  description: 'The running pipeline as nodes, and the graphs that drive it',
  keywords: ['nodes', 'pipeline', 'modulation', 'binding', 'signals', 'reactive', 'live'],
  order: 4,
  footer: GraphFooter,
  component: Graph,
}
