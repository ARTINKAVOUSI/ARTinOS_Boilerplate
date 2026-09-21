import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { PanelManifest } from '../app/panel'
import { GRAPH_TEMPLATES, effectOptions, graphs, objectOptions, parameterOptions, useGraphs } from '../app/graphs'
import { applyLiveControl, buildLiveGraph, liveNodeForStage, liveTarget } from '../app/live-graph'
import { nodePreviews } from '../app/node-preview'
import { pipelineStages } from '../app/pipeline-stages'
import { LiveInspector } from '../app/studio/LiveInspector'
import { NodeGraph } from '../ui/NodeGraph/NodeGraph'
import { LiveGraphView, type LiveNode } from '../ui/NodeGraph/LiveGraphView'
import { GRAPH_DOMAINS, type GraphDiagnostic, type GraphDomain } from '../ui/NodeGraph/graph'
import { useSignalSnapshot } from '../features/input/signals'
import { Select } from '../ui/Select/Select'
import { Button } from '../ui/Button/Button'
import { Badge } from '../ui/Badge/Badge'
import { useToast } from '../ui/Toast/Toast'

type Mode = 'live' | 'edit'

const LIVE_HINT = 'Generated from the running runtime: live signals, the logic consuming them, the parameters they drive, the objects in the viewport and the render pipeline.'
const DOMAIN_HELP: Record<GraphDomain, string> = {
  signal: 'Shapes live signals and writes them back as signals or controls.',
  parameter: 'Reads and writes controls, on every frame the graph runs.',
  scene: 'Resolves named objects in the live scene and drives their transform, visibility and material.',
  render: 'Switches, reorders and drives the effects in the shared pipeline.',
  gpu: 'Compiles to TSL. The Graph effect renders what the TSL Output publishes.',
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Graph() {
  const toast = useToast()
  const { documents, readouts, diagnostics: runtimeNotes, compiled } = useGraphs()
  const stages = useSyncExternalStore(pipelineStages.subscribe, pipelineStages.getStages, pipelineStages.getStages)
  const previews = useSyncExternalStore(nodePreviews.subscribe, nodePreviews.getFrames, nodePreviews.getFrames)

  const [mode, setMode] = useState<Mode>('live')
  const [overlay, setOverlay] = useState<'inspector' | 'graph' | null>('inspector')
  const [liveSelected, setLiveSelected] = useState<LiveNode | null>(null)
  const [activeId, setActiveId] = useState<string | null>(documents[0]?.id ?? null)
  const [diagnostics, setDiagnostics] = useState<GraphDiagnostic[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const file = useRef<HTMLInputElement>(null)

  const active = documents.find(document => document.id === activeId) ?? documents[0] ?? null
  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id)
  }, [active, activeId])

  // Like the original pipeline, the live view has normal and velocity rendered
  // so the G-buffer passes exist to be seen; released when the view closes.
  useEffect(() => {
    if (mode !== 'live') return
    pipelineStages.want(['normal', 'velocity'])
    return () => pipelineStages.want([])
  }, [mode])

  // The live view is rebuilt from the runtime a few times a second.
  useEffect(() => {
    if (mode !== 'live') return
    const timer = setInterval(() => setTick(value => value + 1), 250)
    return () => clearInterval(timer)
  }, [mode])
  const liveGraph = useMemo(() => (mode === 'live' ? buildLiveGraph() : null), [mode, tick])

  // Thumbnails: every pass and effect in the live view, or the compiled nodes of
  // a GPU graph in the editor. The service renders one per interval.
  const build = active && active.domain === 'gpu' ? compiled[active.id] : undefined
  useEffect(() => {
    if (mode === 'live') {
      for (const stage of stages) nodePreviews.request(liveNodeForStage(stage.id), stage.node)
      nodePreviews.keepOnly(stages.map(stage => liveNodeForStage(stage.id)))
      return
    }
    if (!build) {
      nodePreviews.keepOnly([])
      return
    }
    for (const [nodeId, node] of build.values) nodePreviews.request(nodeId, node)
    nodePreviews.keepOnly([...build.values.keys()])
  }, [mode, stages, build])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 2600)
    return () => clearTimeout(timer)
  }, [notice])

  const signals = useSignalSnapshot(4).map(([name]) => name)
  const parameters = useMemo(parameterOptions, [])
  const effects = useMemo(effectOptions, [])
  const sources = useMemo(() => ({ signals, parameters, effects, objects: objectOptions() }), [signals, parameters, effects])

  const notes = useMemo(
    () => (active ? [...(runtimeNotes[active.id] ?? []), ...(active.domain === 'gpu' ? (compiled[active.id]?.diagnostics ?? []) : [])] : []),
    [active, runtimeNotes, compiled],
  )
  const errors = diagnostics.filter(item => item.severity === 'error').length
  const warnings = diagnostics.length - errors

  const create = (templateId: string) => {
    const template = GRAPH_TEMPLATES.find(item => item.id === templateId) ?? GRAPH_TEMPLATES[0]
    setActiveId(graphs.create(template.id === 'blank' ? `Graph ${documents.length + 1}` : template.name, template.domain, template.build()))
    setMode('edit')
    setNotice(`Created ${template.name}`)
  }

  return (
    <div className="artinos-graph-studio">
      <div className="artinos-graph-bar">
        <div className="artinos-lmode" role="tablist" aria-label="Graph mode">
          <button role="tab" aria-selected={mode === 'live'} className={mode === 'live' ? 'is-active' : ''} onClick={() => setMode('live')} title="What is running right now">
            Live
          </button>
          <button role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'is-active' : ''} onClick={() => setMode('edit')} title="Author node graphs">
            Edit
          </button>
        </div>

        {mode === 'edit' && documents.length > 0 && (
          <Select
            size="sm"
            label="Graph"
            value={active?.id ?? ''}
            onChange={setActiveId}
            options={documents.map(document => ({ value: document.id, label: `${document.name}${document.running ? '' : ' · off'}` }))}
          />
        )}

        {mode === 'edit' && active ? (
          <>
            <Badge tone={!active.running ? 'neutral' : errors ? 'danger' : 'live'}>{!active.running ? 'paused' : errors ? `${errors} error${errors > 1 ? 's' : ''}` : 'live'}</Badge>
            <span className="artinos-graph-meta">
              {active.graph.nodes.length}n · {active.graph.edges.length}w · {active.domain}
            </span>
          </>
        ) : (
          <span className="artinos-graph-meta">
            {liveGraph?.nodes.length ?? 0} nodes · {liveGraph?.edges.length ?? 0} links · reading the live runtime
          </span>
        )}

        <div className="artinos-graph-bar-actions">
          {mode === 'edit' && active && (
            <>
              <Select<GraphDomain>
                size="sm"
                label="Domain"
                value={active.domain}
                onChange={domain => graphs.setDomain(active.id, domain)}
                options={GRAPH_DOMAINS.map(domain => ({ value: domain, label: domain }))}
              />
              <button type="button" className={active.running ? 'is-active' : ''} title={active.running ? 'Pause evaluation' : 'Resume evaluation'} onClick={() => graphs.setRunning(active.id, !active.running)}>
                {active.running ? '❙❙' : '▶'}
              </button>
            </>
          )}
          <button type="button" className={overlay === 'inspector' ? 'is-active' : ''} title="Inspector" onClick={() => setOverlay(value => (value === 'inspector' ? null : 'inspector'))}>
            ◧
          </button>
          <button type="button" className={overlay === 'graph' ? 'is-active' : ''} title="Graphs, templates and import/export" onClick={() => setOverlay(value => (value === 'graph' ? null : 'graph'))}>
            ⚙
          </button>
        </div>
      </div>

      <div className="artinos-graph-stage">
        {mode === 'live' && liveGraph && (
          <LiveGraphView
            graph={liveGraph}
            previews={previews}
            insetRight={overlay ? 280 : 0}
            onInspect={node => {
              setLiveSelected(node)
              setOverlay('inspector')
            }}
            onControl={(node, control, value) => applyLiveControl(node.id, control.id, value)}
          />
        )}

        {mode === 'edit' &&
          (active ? (
            <NodeGraph
              key={active.id}
              value={active.graph}
              onChange={graph => graphs.setGraph(active.id, graph)}
              readouts={readouts[active.id]}
              frames={previews}
              sources={sources}
              runtimeDiagnostics={notes}
              onDiagnostics={setDiagnostics}
            />
          ) : (
            <p className="artinos-gempty">No graphs yet. Open the ⚙ panel to create one from a template.</p>
          ))}

        {overlay && (
          <aside className="artinos-graph-overlay">
            <header>
              <b>{overlay === 'inspector' ? (mode === 'live' ? 'Live' : 'Node') : 'Graph'}</b>
              <button type="button" title="Close" onClick={() => setOverlay(null)}>
                ×
              </button>
            </header>
            <div className="artinos-graph-overlay-body">
              {overlay === 'graph' ? (
                <GraphLibrary
                  documents={documents.map(document => ({ id: document.id, name: document.name, domain: document.domain }))}
                  activeId={active?.id ?? null}
                  onSelect={id => {
                    setActiveId(id)
                    setMode('edit')
                  }}
                  onCreate={create}
                  onExport={() => download('artinos-graphs.json', graphs.exportJSON())}
                  onImport={() => file.current?.click()}
                  onDelete={() => {
                    if (!active) return
                    graphs.remove(active.id)
                    setNotice(`Deleted ${active.name}`)
                  }}
                />
              ) : mode === 'live' ? (
                <LiveInspector
                  node={liveSelected}
                  target={liveSelected ? liveTarget(liveSelected.id) : undefined}
                  onOpenGraph={id => {
                    setActiveId(id)
                    setMode('edit')
                  }}
                />
              ) : (
                <p className="artinos-graph-hint">Select a node in the canvas; its fields are edited in place and in the inspector beside it.</p>
              )}
            </div>
          </aside>
        )}

        {mode === 'edit' && diagnostics.length > 0 && (
          <div className="artinos-graph-issues">
            <details>
              <summary>
                <Badge tone={errors ? 'danger' : 'warm'}>{errors ? `${errors} error${errors > 1 ? 's' : ''}` : `${warnings} warning${warnings > 1 ? 's' : ''}`}</Badge>
              </summary>
              {diagnostics.map((item, index) => (
                <button key={`${item.message}-${index}`} type="button" className={`artinos-gdiagnostic is-${item.severity}`}>
                  <Badge tone={item.severity === 'error' ? 'danger' : 'warm'}>{item.severity}</Badge>
                  <span>{item.message}</span>
                </button>
              ))}
            </details>
          </div>
        )}

        {notice && <div className="artinos-gnotice">{notice}</div>}
        <p className="artinos-graph-hint">{mode === 'live' ? LIVE_HINT : active ? DOMAIN_HELP[active.domain] : ''}</p>
      </div>

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

/** The ⚙ overlay: the graphs that exist, the templates, and portability. */
function GraphLibrary({
  documents,
  activeId,
  onSelect,
  onCreate,
  onExport,
  onImport,
  onDelete,
}: {
  documents: { id: string; name: string; domain: GraphDomain }[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: (templateId: string) => void
  onExport: () => void
  onImport: () => void
  onDelete: () => void
}) {
  const [template, setTemplate] = useState(GRAPH_TEMPLATES[1]?.id ?? 'blank')
  return (
    <>
      <div className="artinos-graph-hint">Graphs</div>
      {documents.map(document => (
        <button key={document.id} type="button" className={`artinos-gdiagnostic ${document.id === activeId ? 'is-warning' : ''}`} onClick={() => onSelect(document.id)}>
          <span>
            {document.name} · {document.domain}
          </span>
        </button>
      ))}
      <div className="artinos-graph-hint">New graph</div>
      <Select size="sm" label="Template" value={template} onChange={setTemplate} options={GRAPH_TEMPLATES.map(item => ({ value: item.id, label: `${item.name} · ${item.domain}` }))} />
      <div className="v2-panel-bar">
        <Button size="sm" variant="primary" onClick={() => onCreate(template)}>
          Create
        </Button>
        <Button size="sm" onClick={onExport}>
          Export
        </Button>
        <Button size="sm" onClick={onImport}>
          Import
        </Button>
        {documents.length > 0 && (
          <Button size="sm" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </>
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
