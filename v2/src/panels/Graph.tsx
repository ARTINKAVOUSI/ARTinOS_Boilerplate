import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { PanelManifest } from '../app/panel'
import { GRAPH_TEMPLATES, effectOptions, graphs, objectOptions, parameterOptions, useGraphs } from '../app/graphs'
import { applyLiveControl, buildLiveGraph } from '../app/live-graph'
import { nodePreviews } from '../app/node-preview'
import { PanelBar } from '../app/studio/PanelBar'
import { Icons } from '../app/studio/icons'
import { NodeGraph } from '../ui/NodeGraph/NodeGraph'
import { LiveGraph } from '../ui/NodeGraph/LiveGraph'
import { GRAPH_DOMAINS, type GraphDiagnostic, type GraphDomain } from '../ui/NodeGraph/graph'
import { useSignalSnapshot } from '../features/input/signals'
import { Segmented } from '../ui/Segmented/Segmented'
import { Select } from '../ui/Select/Select'
import { Button } from '../ui/Button/Button'
import { IconButton } from '../ui/IconButton/IconButton'
import { TextField } from '../ui/TextField/TextField'
import { Toggle } from '../ui/Toggle/Toggle'
import { Menu, type MenuEntry } from '../ui/Menu/Menu'
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
  const { documents, readouts, diagnostics: runtimeNotes, compiled } = useGraphs()
  const frames = useSyncExternalStore(nodePreviews.subscribe, nodePreviews.getFrames, nodePreviews.getFrames)
  const [view, setView] = useState<View>('live')
  const [activeId, setActiveId] = useState<string | null>(documents[0]?.id ?? null)
  const [diagnostics, setDiagnostics] = useState<GraphDiagnostic[]>([])
  const [renaming, setRenaming] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const active = documents.find(document => document.id === activeId) ?? documents[0] ?? null
  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id)
  }, [active, activeId])

  // GPU nodes get rendered thumbnails; ask only for the graph on screen.
  const build = active && active.domain === 'gpu' ? compiled[active.id] : undefined
  useEffect(() => {
    if (view !== 'edit' || !build) {
      nodePreviews.keepOnly([])
      return
    }
    for (const [nodeId, node] of build.values) nodePreviews.request(nodeId, node)
    nodePreviews.keepOnly([...build.values.keys()])
  }, [view, build])

  const signals = useSignalSnapshot(4).map(([name]) => name)
  const parameters = useMemo(parameterOptions, [])
  const effects = useMemo(effectOptions, [])
  const sources = useMemo(() => ({ signals, parameters, effects, objects: objectOptions() }), [signals, parameters, effects])

  const blocked = diagnostics.some(item => item.severity === 'error')
  const running = documents.filter(document => document.running).length
  const notes = useMemo(
    () => (active ? [...(runtimeNotes[active.id] ?? []), ...(active.domain === 'gpu' ? compiled[active.id]?.diagnostics ?? [] : [])] : []),
    [active, runtimeNotes, compiled],
  )

  const newFrom = (templateId: string) => {
    const template = GRAPH_TEMPLATES.find(item => item.id === templateId) ?? GRAPH_TEMPLATES[0]
    setActiveId(graphs.create(template.id === 'blank' ? `Graph ${documents.length + 1}` : template.name, template.domain, template.build()))
    setView('edit')
  }

  const templateMenu: MenuEntry[] = [
    { type: 'label', label: 'New graph from' },
    ...GRAPH_TEMPLATES.map<MenuEntry>(template => ({
      id: template.id,
      label: `${template.name} · ${template.domain}`,
      onSelect: () => newFrom(template.id),
    })),
  ]

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
            <Select size="sm" label="Graph" value={active?.id ?? ''} onChange={setActiveId} options={documents.map(document => ({ value: document.id, label: document.name }))} />
            {active && (
              <Select<GraphDomain>
                size="sm"
                label="Domain"
                value={active.domain}
                onChange={domain => graphs.setDomain(active.id, domain)}
                options={GRAPH_DOMAINS.map(domain => ({ value: domain, label: domain }))}
              />
            )}
            {active && (
              <label className="v2-inline-toggle">
                Run
                <Toggle size="sm" label={`Run ${active.name}`} checked={active.running} disabled={blocked && !active.running} onChange={value => graphs.setRunning(active.id, value)} />
              </label>
            )}
          </>
        )}
        {view === 'live' && (
          <span className="artinos-panel-summary v2-bar-summary">
            {running} OF {documents.length} GRAPHS RUNNING
          </span>
        )}

        <span className="v2-spacer" />
        <Menu align="end" items={templateMenu} trigger={<Button size="sm" icon={Icons.plus}>New</Button>} />
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
          No graphs yet. A graph wires live signals into the pipeline — audio into bloom, an oscillator into an object, a TSL chain into the effect stack.
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            {GRAPH_TEMPLATES.slice(1).map(template => (
              <Button key={template.id} size="sm" variant={template.id === 'audio-pulse' ? 'primary' : 'ghost'} onClick={() => newFrom(template.id)} title={template.description}>
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        active && (
          <>
            {active.domain === 'gpu' && <div className="artinos-panel-notice">A GPU graph renders through the Graph effect in PostFX; switch that effect on to see it.</div>}
            <NodeGraph
              key={active.id}
              className="v2-graph-editor"
              value={active.graph}
              onChange={graph => graphs.setGraph(active.id, graph)}
              readouts={readouts[active.id]}
              frames={frames}
              sources={sources}
              runtimeDiagnostics={notes}
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
  keywords: ['nodes', 'pipeline', 'modulation', 'binding', 'signals', 'reactive', 'live', 'tsl'],
  order: 4,
  footer: GraphFooter,
  component: Graph,
}
