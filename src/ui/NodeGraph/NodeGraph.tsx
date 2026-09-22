import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  GRAPH_CATEGORIES,
  edgesInto,
  fieldValue,
  fieldsOf,
  inputsOf,
  labelOf,
  outputsOf,
  schemaFor,
  schemasForDomain,
  validateGraph,
  type GraphDefinition,
  type GraphDiagnostic,
  type GraphNode,
} from './graph'
import { useGraphEditor, snap } from './editor'
import { NodeField, type GraphSources } from './NodeFields'
import { PREVIEW_H, RenderPreview, ValuePreview, type PreviewFrame } from './NodePreview'
import { usePanZoom, wirePath, type Point } from './view'
import './NodeGraph.css'

const NODE_WIDTH = 188
const HEADER_H = 26
const PORT_TOP = 15
const PORT_GAP = 17
const FIELD_H = 24
const BODY_PAD = 8
const GROUP_PAD = 16
const GROUP_HEAD = 18

type Side = 'in' | 'out'

const portsOf = (node: GraphNode, side: Side) => (side === 'out' ? outputsOf(node) : inputsOf(node))
const portRows = (node: GraphNode) => Math.max(inputsOf(node).length, outputsOf(node).length)

/** A node's preview: numbers get a plot, TSL nodes get a rendered thumbnail. */
const previewKind = (node: GraphNode, domain: string): 'value' | 'render' | 'none' => {
  const schema = schemaFor(node.type)
  if (!schema || !schema.outputs.length) return 'none'
  if (domain === 'gpu') return 'render'
  if (schema.category === 'Scene') return 'none'
  return schema.outputs.some(port => port.type === 'number') ? 'value' : 'none'
}

const nodeHeight = (node: GraphNode, domain: string, collapsed: boolean) => {
  if (collapsed) return HEADER_H
  const preview = previewKind(node, domain) === 'none' ? 0 : PREVIEW_H + 6
  return HEADER_H + PORT_TOP + portRows(node) * PORT_GAP + fieldsOf(node).length * FIELD_H + preview + BODY_PAD
}

const anchor = (node: GraphNode, side: Side, portId: string, collapsed: boolean): Point => {
  if (collapsed) return { x: node.x + (side === 'out' ? NODE_WIDTH : 0), y: node.y + HEADER_H / 2 }
  const index = Math.max(0, portsOf(node, side).findIndex(port => port.id === portId))
  return { x: node.x + (side === 'out' ? NODE_WIDTH : 0), y: node.y + HEADER_H + PORT_TOP + index * PORT_GAP }
}

const format = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? (Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(3)) : '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value && typeof value === 'object') return (value as { name?: string }).name || 'object'
  return value === undefined ? '' : String(value)
}

export interface NodeGraphProps {
  value: GraphDefinition
  onChange: (next: GraphDefinition) => void
  /** Each node's last output, for the header readout and the value plots. */
  readouts?: ReadonlyMap<string, unknown>
  /** GPU thumbnails the host rendered, keyed by node id. */
  frames?: ReadonlyMap<string, PreviewFrame>
  /** What the pickers can offer. */
  sources?: GraphSources
  /** Diagnostics from the last evaluation, merged with the static ones. */
  runtimeDiagnostics?: readonly GraphDiagnostic[]
  onDiagnostics?: (diagnostics: GraphDiagnostic[]) => void
  className?: string
}

interface Drag {
  kind: 'node' | 'pan' | 'wire' | 'marquee'
  pointerId: number
  origin: Point
  nodes?: { id: string; x: number; y: number }[]
  port?: { nodeId: string; side: Side; portId: string }
  cursor?: Point
}

/**
 * NodeGraph — the editor: drag nodes, wire ports, cut wires, marquee-select,
 * group, collapse, duplicate, copy/paste, undo/redo, auto-layout, and edit
 * every field in place or in the inspector.
 *
 * The component owns its view and selection; the graph is the caller's state
 * and every edit arrives through `onChange` as a new definition.
 */
export function NodeGraph({ value, onChange, readouts, frames, sources = {}, runtimeDiagnostics = [], onDiagnostics, className }: NodeGraphProps) {
  const editor = useGraphEditor(value, onChange)
  const { surface, view, setView, toGraph, onWheel, transform } = usePanZoom({ x: 30, y: 20, scale: 1 })
  const [selected, setSelected] = useState<string[]>([])
  const [collapsedNodes, setCollapsedNodes] = useState<string[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const [palette, setPalette] = useState<{ graph: Point; screen: Point } | null>(null)
  const [search, setSearch] = useState('')
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(true)

  const domain = value.domain
  const nodes = useMemo(() => new Map(value.nodes.map(node => [node.id, node])), [value.nodes])
  const diagnostics = useMemo(() => [...validateGraph(value), ...runtimeDiagnostics], [value, runtimeDiagnostics])
  // Report only when the list actually changes: the caller usually turns this
  // into state, and a fresh array every render would loop.
  const reported = useRef('')
  useEffect(() => {
    const signature = JSON.stringify(diagnostics)
    if (signature === reported.current) return
    reported.current = signature
    onDiagnostics?.(diagnostics)
  }, [diagnostics, onDiagnostics])

  const severityOf = useMemo(() => {
    const map = new Map<string, 'error' | 'warning'>()
    for (const item of diagnostics) {
      if (!item.nodeId) continue
      if (item.severity === 'error' || !map.has(item.nodeId)) map.set(item.nodeId, item.severity)
    }
    return map
  }, [diagnostics])

  // A collapsed group hides its members behind one box.
  const hidden = useMemo(() => {
    const set = new Set<string>()
    for (const group of value.groups ?? []) if (group.collapsed) for (const id of group.nodes) set.add(id)
    return set
  }, [value.groups])

  const groupBoxes = useMemo(
    () =>
      (value.groups ?? []).map(group => {
        const members = group.nodes.map(id => nodes.get(id)).filter((node): node is GraphNode => !!node)
        if (!members.length) return null
        const left = Math.min(...members.map(node => node.x)) - GROUP_PAD
        const top = Math.min(...members.map(node => node.y)) - GROUP_PAD - GROUP_HEAD
        const right = Math.max(...members.map(node => node.x + NODE_WIDTH)) + GROUP_PAD
        const bottom = group.collapsed ? top + GROUP_HEAD + 30 : Math.max(...members.map(node => node.y + nodeHeight(node, domain, collapsedNodes.includes(node.id)))) + GROUP_PAD
        return { group, left, top, width: right - left, height: bottom - top, members }
      }),
    [value.groups, nodes, domain, collapsedNodes],
  )

  /** Open the palette at a pointer, clamped so it always fits the editor. */
  const openPalette = (event: { clientX: number; clientY: number }) => {
    const box = root.current?.getBoundingClientRect()
    const screen = box ? { x: Math.max(4, Math.min(event.clientX - box.left, box.width - 348)), y: Math.max(4, Math.min(event.clientY - box.top, box.height - 60)) } : { x: 8, y: 8 }
    setPalette({ graph: toGraph(event), screen })
  }

  const say = (text: string) => setMessage(text)
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 2400)
    return () => clearTimeout(timer)
  }, [message])

  const addNode = (type: string, at: Point) => {
    const node = editor.addNode(type, at.x, at.y)
    setSelected([node.id])
    setPalette(null)
    setSearch('')
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const modifier = event.metaKey || event.ctrlKey
    if (event.key === 'Escape') {
      setPalette(null)
      setSelected([])
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected.length) {
      editor.removeNodes(selected)
      setSelected([])
      event.preventDefault()
      return
    }
    if (!modifier) return
    const key = event.key.toLowerCase()
    if (key === 'z' && !event.shiftKey) {
      editor.undo()
      event.preventDefault()
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      editor.redo()
      event.preventDefault()
    } else if (key === 'c') {
      editor.copy(selected)
      event.preventDefault()
    } else if (key === 'v') {
      setSelected(editor.paste(40, 40))
      event.preventDefault()
    } else if (key === 'd') {
      setSelected(editor.duplicate(selected))
      event.preventDefault()
    } else if (key === 'g') {
      const id = editor.group(selected)
      if (!id) say('Select two or more nodes to group them')
      event.preventDefault()
    } else if (key === 'a') {
      setSelected(value.nodes.map(node => node.id))
      event.preventDefault()
    }
  }

  const startNodeDrag = (event: ReactPointerEvent, node: GraphNode) => {
    event.stopPropagation()
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    const group = additive ? [...new Set([...selected, node.id])] : selected.includes(node.id) ? selected : [node.id]
    setSelected(group)
    event.currentTarget.setPointerCapture(event.pointerId)
    editor.beginGesture()
    setDrag({
      kind: 'node',
      pointerId: event.pointerId,
      origin: toGraph(event),
      nodes: group.map(id => nodes.get(id)).filter((item): item is GraphNode => !!item).map(item => ({ id: item.id, x: item.x, y: item.y })),
    })
  }

  const startWire = (event: ReactPointerEvent, node: GraphNode, side: Side, portId: string) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = toGraph(event)
    setDrag({ kind: 'wire', pointerId: event.pointerId, origin: point, cursor: point, port: { nodeId: node.id, side, portId } })
  }

  const startSurface = (event: ReactPointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return
    setPalette(null)
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = toGraph(event)
    // Space or the middle button pans; a plain drag draws a selection marquee.
    if (event.button === 1 || event.altKey) {
      setDrag({ kind: 'pan', pointerId: event.pointerId, origin: { x: event.clientX, y: event.clientY }, cursor: { x: view.x, y: view.y } })
      return
    }
    if (!event.shiftKey) setSelected([])
    setDrag({ kind: 'marquee', pointerId: event.pointerId, origin: point, cursor: point })
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    if (drag.kind === 'pan' && drag.cursor) {
      setView(current => ({ ...current, x: drag.cursor!.x + (event.clientX - drag.origin.x) / current.scale, y: drag.cursor!.y + (event.clientY - drag.origin.y) / current.scale }))
      return
    }
    const point = toGraph(event)
    if (drag.kind === 'wire' || drag.kind === 'marquee') {
      setDrag({ ...drag, cursor: point })
      return
    }
    if (drag.kind === 'node' && drag.nodes) {
      const dx = point.x - drag.origin.x
      const dy = point.y - drag.origin.y
      const deltas = new Map(drag.nodes.map(item => [item.id, { x: item.x + dx - (nodes.get(item.id)?.x ?? 0), y: item.y + dy - (nodes.get(item.id)?.y ?? 0) }]))
      editor.moveNodes(deltas, snapToGrid)
    }
  }

  const finishDrag = (event: ReactPointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    if (drag.kind === 'node') editor.endGesture()
    if (drag.kind === 'marquee' && drag.cursor) {
      const left = Math.min(drag.origin.x, drag.cursor.x)
      const right = Math.max(drag.origin.x, drag.cursor.x)
      const top = Math.min(drag.origin.y, drag.cursor.y)
      const bottom = Math.max(drag.origin.y, drag.cursor.y)
      if (right - left > 4 || bottom - top > 4) {
        const inside = value.nodes
          .filter(node => !hidden.has(node.id))
          .filter(node => node.x + NODE_WIDTH > left && node.x < right && node.y + nodeHeight(node, domain, collapsedNodes.includes(node.id)) > top && node.y < bottom)
          .map(node => node.id)
        setSelected(current => [...new Set([...(event.shiftKey ? current : []), ...inside])])
      }
    }
    setDrag(null)
  }

  /** Finish a wire drag on a port: the drop decides which end is the source. */
  const dropOnPort = (node: GraphNode, side: Side, portId: string) => {
    const port = drag?.port
    if (!port || port.side === side) return
    const fromId = side === 'in' ? port.nodeId : node.id
    const toId = side === 'in' ? node.id : port.nodeId
    const problem = editor.connect(fromId, side === 'in' ? port.portId : portId, toId, side === 'in' ? portId : port.portId)
    if (problem) say(problem)
  }

  const fit = useCallback(() => {
    const box = surface.current?.getBoundingClientRect()
    if (!box || !value.nodes.length) return
    const left = Math.min(...value.nodes.map(node => node.x))
    const top = Math.min(...value.nodes.map(node => node.y))
    const width = Math.max(...value.nodes.map(node => node.x + NODE_WIDTH)) - left
    const height = Math.max(...value.nodes.map(node => node.y + nodeHeight(node, domain, false))) - top
    const scale = Math.max(0.35, Math.min(1.2, Math.min((box.width - 40) / width, (box.height - 40) / height)))
    setView({ scale, x: 20 / scale - left, y: 20 / scale - top })
  }, [value.nodes, domain, setView, surface])

  const available = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return schemasForDomain(domain).filter(schema => !needle || `${schema.label} ${schema.type} ${schema.description}`.toLowerCase().includes(needle))
  }, [domain, search])

  const inspected = selected.length === 1 ? nodes.get(selected[0]) : undefined
  const wireStart = drag?.kind === 'wire' && drag.port ? anchor(nodes.get(drag.port.nodeId)!, drag.port.side, drag.port.portId, collapsedNodes.includes(drag.port.nodeId)) : null
  const errors = diagnostics.filter(item => item.severity === 'error')

  return (
    <div ref={root} className={`ngraph ${className ?? ''}`.trim()} onKeyDown={onKeyDown} tabIndex={0}>
      <div className="ngraph-toolbar">
        <button type="button" onClick={() => setPalette({ graph: { x: -view.x + 60, y: -view.y + 60 }, screen: { x: 8, y: 34 } })} title="Add a node (or double-click the canvas)">
          + Node
        </button>
        <button type="button" disabled={!editor.canUndo} onClick={editor.undo} title="Undo (⌘/Ctrl + Z)">
          Undo
        </button>
        <button type="button" disabled={!editor.canRedo} onClick={editor.redo} title="Redo (⌘/Ctrl + Y)">
          Redo
        </button>
        <button type="button" disabled={selected.length < 2} onClick={() => editor.group(selected)} title="Group the selection (⌘/Ctrl + G)">
          Group
        </button>
        <button type="button" disabled={!selected.length} onClick={() => setSelected(editor.duplicate(selected))} title="Duplicate (⌘/Ctrl + D)">
          Duplicate
        </button>
        <button type="button" onClick={editor.autoLayout} title="Lay the graph out by dependency depth">
          Arrange
        </button>
        <button type="button" onClick={fit} title="Frame every node">
          Fit
        </button>
        <button type="button" className={snapToGrid ? 'is-on' : ''} onClick={() => setSnapToGrid(value => !value)} title="Snap nodes to the grid">
          Snap
        </button>
        <button type="button" className={showInspector ? 'is-on' : ''} onClick={() => setShowInspector(current => !current)} title="Show the node inspector">
          Inspector
        </button>
        <span className="ngraph-toolbar-gap" />
        <span className={`ngraph-toolbar-count${errors.length ? ' is-error' : ''}`}>
          {value.nodes.length} nodes · {value.edges.length} wires{errors.length ? ` · ${errors.length} error${errors.length > 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div className="ngraph-stage">
        <div
          ref={surface}
          className="ngraph-surface"
          onPointerDown={startSurface}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onWheel={onWheel}
          onDoubleClick={openPalette}
          onContextMenu={event => {
            event.preventDefault()
            openPalette(event)
          }}
        >
          <div className="ngraph-world" style={{ transform }}>
            {groupBoxes.map(box =>
              box ? (
                <div key={box.group.id} className="ngraph-group" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
                  <header onPointerDown={event => event.stopPropagation()}>
                    <button type="button" onClick={() => editor.toggleGroup(box.group.id)} title={box.group.collapsed ? 'Expand group' : 'Collapse group'}>
                      {box.group.collapsed ? '▸' : '▾'}
                    </button>
                    <input
                      value={box.group.label}
                      onChange={event => editor.renameGroup(box.group.id, event.target.value)}
                      onPointerDown={event => event.stopPropagation()}
                      aria-label={`Rename ${box.group.label}`}
                    />
                    <span>{box.members.length}</span>
                    <button type="button" onClick={() => editor.ungroup(box.group.id)} title="Ungroup">
                      ✕
                    </button>
                  </header>
                </div>
              ) : null,
            )}

            <svg className="ngraph-wires" aria-hidden>
              {value.edges.map(edge => {
                const from = nodes.get(edge.from)
                const to = nodes.get(edge.to)
                if (!from || !to) return null
                const muted = hidden.has(from.id) && hidden.has(to.id)
                if (muted) return null
                const path = wirePath(anchor(from, 'out', edge.output ?? 'value', collapsedNodes.includes(from.id)), anchor(to, 'in', edge.input ?? 'value', collapsedNodes.includes(to.id)))
                return (
                  <g key={edge.id} className="ngraph-wire">
                    <path className="ngraph-wire-line" d={path} />
                    {/* A fat transparent copy makes the thin wire clickable. */}
                    <path className="ngraph-wire-hit" d={path} onClick={() => editor.disconnect(edge.id)}>
                      <title>Click to disconnect</title>
                    </path>
                  </g>
                )
              })}
              {wireStart && drag?.cursor && (
                <path className="ngraph-wire-line is-live" d={wirePath(drag.port!.side === 'out' ? wireStart : drag.cursor, drag.port!.side === 'out' ? drag.cursor : wireStart)} />
              )}
            </svg>

            {drag?.kind === 'marquee' && drag.cursor && (
              <div
                className="ngraph-marquee"
                style={{
                  left: Math.min(drag.origin.x, drag.cursor.x),
                  top: Math.min(drag.origin.y, drag.cursor.y),
                  width: Math.abs(drag.cursor.x - drag.origin.x),
                  height: Math.abs(drag.cursor.y - drag.origin.y),
                }}
              />
            )}

            {value.nodes.map(node => {
              if (hidden.has(node.id)) return null
              const schema = schemaFor(node.type)
              const collapsed = collapsedNodes.includes(node.id)
              const severity = severityOf.get(node.id)
              const readout = readouts?.get(node.id)
              const preview = previewKind(node, domain)
              const effectId = String(fieldValue(node, 'id') ?? '')
              return (
                <article
                  key={node.id}
                  className={`ngraph-node${selected.includes(node.id) ? ' is-selected' : ''}${severity ? ` is-${severity}` : ''}`}
                  data-category={schema?.category?.toLowerCase()}
                  style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: nodeHeight(node, domain, collapsed) }}
                >
                  <header className="ngraph-node-head" onPointerDown={event => startNodeDrag(event, node)} title={schema?.description}>
                    <button
                      type="button"
                      className="ngraph-fold"
                      onPointerDown={event => event.stopPropagation()}
                      onClick={() => setCollapsedNodes(current => (current.includes(node.id) ? current.filter(id => id !== node.id) : [...current, node.id]))}
                      title={collapsed ? 'Expand node' : 'Collapse node'}
                    >
                      {collapsed ? '▸' : '▾'}
                    </button>
                    <span className="ngraph-node-title">{labelOf(node)}</span>
                    <output className="ngraph-node-readout">{format(readout)}</output>
                  </header>

                  {!collapsed && (
                    <>
                      <div className="ngraph-ports" style={{ height: PORT_TOP + portRows(node) * PORT_GAP }}>
                        {portsOf(node, 'in').map((port, index) => (
                          <button
                            key={`in-${port.id}`}
                            type="button"
                            className={`ngraph-port is-in type-${port.type}${edgesInto(value, node.id, port.id).length ? ' is-wired' : ''}${port.required ? ' is-required' : ''}`}
                            style={{ top: PORT_TOP + index * PORT_GAP }}
                            title={`${port.label ?? port.id} · ${port.type}${port.required ? ' · required' : ''}${port.multiple ? ' · accepts many' : ''}`}
                            onPointerDown={event => startWire(event, node, 'in', port.id)}
                            onPointerUp={() => dropOnPort(node, 'in', port.id)}
                          >
                            <i />
                            <b>{port.label ?? port.id}</b>
                          </button>
                        ))}
                        {portsOf(node, 'out').map((port, index) => (
                          <button
                            key={`out-${port.id}`}
                            type="button"
                            className={`ngraph-port is-out type-${port.type}${value.edges.some(edge => edge.from === node.id && (edge.output ?? 'value') === port.id) ? ' is-wired' : ''}`}
                            style={{ top: PORT_TOP + index * PORT_GAP }}
                            title={`${port.label ?? port.id} · ${port.type}`}
                            onPointerDown={event => startWire(event, node, 'out', port.id)}
                            onPointerUp={() => dropOnPort(node, 'out', port.id)}
                          >
                            <b>{port.label ?? port.id}</b>
                            <i />
                          </button>
                        ))}
                      </div>

                      <div className="ngraph-fields">
                        {fieldsOf(node).map(field => (
                          <NodeField key={field.id} field={field} value={fieldValue(node, field.id)} sources={sources} effectId={effectId} onChange={next => editor.setField(node.id, field.id, next)} />
                        ))}
                      </div>

                      {preview !== 'none' && (
                        <div className="ngraph-preview" onPointerDown={event => event.stopPropagation()}>
                          {preview === 'render' ? <RenderPreview frame={frames?.get(node.id)} /> : <ValuePreview nodeKey={node.id} value={typeof readout === 'number' ? readout : 0} />}
                        </div>
                      )}
                    </>
                  )}
                </article>
              )
            })}
          </div>

        </div>

        {showInspector && (
          <aside className="ngraph-inspector">
            {inspected ? (
              <>
                <header>
                  <input value={labelOf(inspected)} onChange={event => editor.rename(inspected.id, event.target.value)} aria-label="Node name" />
                  <button type="button" onClick={() => editor.removeNodes([inspected.id])} title="Delete node">
                    ✕
                  </button>
                </header>
                <p className="ngraph-inspector-note">{schemaFor(inspected.type)?.description}</p>
                {fieldsOf(inspected).map(field => (
                  <NodeField
                    key={field.id}
                    field={field}
                    value={fieldValue(inspected, field.id)}
                    sources={sources}
                    effectId={String(fieldValue(inspected, 'id') ?? '')}
                    onChange={next => editor.setField(inspected.id, field.id, next)}
                  />
                ))}
                <div className="ngraph-inspector-rows">
                  <span>Output</span>
                  <b>{format(readouts?.get(inspected.id))}</b>
                </div>
                {inputsOf(inspected).map(port => (
                  <div key={port.id} className="ngraph-inspector-rows">
                    <span>{port.label ?? port.id}</span>
                    <b>{edgesInto(value, inspected.id, port.id).length ? 'wired' : '—'}</b>
                  </div>
                ))}
              </>
            ) : (
              <div className="ngraph-inspector-empty">
                {selected.length > 1 ? `${selected.length} nodes selected` : 'Select a node to inspect it.'}
                <ul>
                  <li>Double-click the canvas to add</li>
                  <li>Drag a port to wire, click a wire to cut</li>
                  <li>⌘/Ctrl + G groups, D duplicates, Z undoes</li>
                </ul>
              </div>
            )}
            {diagnostics.length > 0 && (
              <div className="ngraph-diagnostics">
                {diagnostics.slice(0, 6).map((item, index) => (
                  <button key={index} type="button" className={`is-${item.severity}`} onClick={() => item.nodeId && setSelected([item.nodeId])}>
                    {item.message}
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Outside the canvas so a short panel cannot clip it. */}
      {palette && (
        <div className="ngraph-palette" style={{ left: palette.screen.x, top: palette.screen.y }} onPointerDown={event => event.stopPropagation()}>
          <input autoFocus type="search" value={search} placeholder={`Search ${domain} nodes`} onChange={event => setSearch(event.target.value)} />
          <div className="ngraph-palette-body">
            {GRAPH_CATEGORIES.map(category => {
              const items = available.filter(schema => schema.category === category)
              if (!items.length) return null
              return (
                <div key={category} className="ngraph-palette-group">
                  <b>{category}</b>
                  {items.map(schema => (
                    <button key={schema.type} type="button" title={schema.description} onClick={() => addNode(schema.type, palette.graph)}>
                      {schema.label}
                    </button>
                  ))}
                </div>
              )
            })}
            {!available.length && <div className="ngraph-palette-empty">No node matches.</div>}
          </div>
        </div>
      )}

      <div className="ngraph-status">
        <span>{Math.round(view.scale * 100)}% · {domain} graph</span>
        <span className="ngraph-status-hint">Drag to select · Alt-drag or middle-drag to pan · ⌘/Ctrl + scroll to zoom</span>
        {message && <span className="ngraph-status-error">{message}</span>}
      </div>
    </div>
  )
}

export default NodeGraph
export { snap }
