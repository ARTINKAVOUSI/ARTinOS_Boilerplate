import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  GRAPH_CATEGORIES,
  NODE_SCHEMAS,
  connectionError,
  createNode,
  edgesInto,
  fieldsOf,
  fieldValue,
  inputsOf,
  outputsOf,
  schemaFor,
  validateGraph,
  type GraphDefinition,
  type GraphDiagnostic,
  type GraphEdge,
  type GraphNode,
} from './graph'
import './NodeGraph.css'

const NODE_WIDTH = 190
const HEADER_H = 26
const PORT_TOP = 16
const PORT_GAP = 17
const FIELD_H = 24
const BODY_PAD = 8
const GRID = 10

type Side = 'in' | 'out'
interface Point {
  x: number
  y: number
}

const portsOf = (node: GraphNode, side: Side) => (side === 'out' ? outputsOf(node) : inputsOf(node))
const nodeHeight = (node: GraphNode) => HEADER_H + PORT_TOP + Math.max(inputsOf(node).length, outputsOf(node).length) * PORT_GAP + fieldsOf(node).length * FIELD_H + BODY_PAD
const anchor = (node: GraphNode, side: Side, portId: string): Point => {
  const index = Math.max(0, portsOf(node, side).findIndex(port => port.id === portId))
  return { x: node.x + (side === 'out' ? NODE_WIDTH : 0), y: node.y + HEADER_H + PORT_TOP + index * PORT_GAP }
}
const wirePath = (a: Point, b: Point) => {
  const bend = Math.max(30, Math.min(140, Math.abs(b.x - a.x) * 0.55))
  return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`
}
const snap = (value: number) => Math.round(value / GRID) * GRID
const round = (value: number) => (Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2))

export interface ParameterOption {
  id: string
  label: string
}

export interface NodeGraphProps {
  value: GraphDefinition
  onChange: (next: GraphDefinition) => void
  /** Each node's last output, shown on the node. */
  readouts?: ReadonlyMap<string, number>
  /** Choices for the `signal` and `parameter` fields. Free text without them. */
  signals?: readonly string[]
  parameters?: readonly ParameterOption[]
  /** Called with the current diagnostics after every change. */
  onDiagnostics?: (diagnostics: GraphDiagnostic[]) => void
  className?: string
}

interface Drag {
  kind: 'node' | 'pan' | 'wire'
  pointerId: number
  /** node drag: which nodes move, and where they started. */
  nodes?: { id: string; x: number; y: number }[]
  /** pan: view offset at grab time. */
  from?: Point
  origin: Point
  /** wire: the port being dragged from. */
  port?: { nodeId: string; side: Side; portId: string }
  cursor?: Point
}

/**
 * NodeGraph — a pannable, zoomable node editor: drag nodes, drag from a port to
 * wire it, click a wire to cut it, add from the palette, edit fields in place.
 *
 * The component owns only its view (pan, zoom, selection, the wire being
 * dragged). The graph itself is the caller's state: every edit arrives through
 * `onChange` with a new definition.
 */
export function NodeGraph({ value, onChange, readouts, signals, parameters, onDiagnostics, className }: NodeGraphProps) {
  const surface = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 40, y: 20, scale: 1 })
  const [selected, setSelected] = useState<string[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const [palette, setPalette] = useState<Point | null>(null)
  const [refused, setRefused] = useState<string | null>(null)

  const nodes = useMemo(() => new Map(value.nodes.map(node => [node.id, node])), [value.nodes])
  const diagnostics = useMemo(() => validateGraph(value), [value])
  useEffect(() => onDiagnostics?.(diagnostics), [diagnostics, onDiagnostics])

  const byNode = useMemo(() => {
    const map = new Map<string, GraphDiagnostic[]>()
    for (const item of diagnostics) if (item.nodeId) map.set(item.nodeId, [...(map.get(item.nodeId) ?? []), item])
    return map
  }, [diagnostics])

  /** Pointer position in graph space. */
  const toGraph = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const box = surface.current?.getBoundingClientRect()
      return { x: ((event.clientX - (box?.left ?? 0)) / view.scale) - view.x, y: ((event.clientY - (box?.top ?? 0)) / view.scale) - view.y }
    },
    [view],
  )

  const patch = (nodeId: string, data: Record<string, string | number>) =>
    onChange({ ...value, nodes: value.nodes.map(node => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node)) })

  const removeNodes = (ids: string[]) => {
    const gone = new Set(ids)
    onChange({ nodes: value.nodes.filter(node => !gone.has(node.id)), edges: value.edges.filter(edge => !gone.has(edge.from) && !gone.has(edge.to)) })
    setSelected(current => current.filter(id => !gone.has(id)))
  }

  const addNode = (type: string, at: Point) => {
    const node = createNode(type, snap(at.x), snap(at.y))
    onChange({ ...value, nodes: [...value.nodes, node] })
    setSelected([node.id])
    setPalette(null)
  }

  // Delete and Escape work whenever the editor has focus.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setPalette(null)
      setSelected([])
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected.length) {
      removeNodes(selected)
      event.preventDefault()
    }
  }

  const startNodeDrag = (event: ReactPointerEvent, node: GraphNode) => {
    event.stopPropagation()
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    const group = additive ? [...new Set([...selected, node.id])] : selected.includes(node.id) ? selected : [node.id]
    setSelected(group)
    event.currentTarget.setPointerCapture(event.pointerId)
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

  const startPan = (event: ReactPointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return
    setSelected([])
    setPalette(null)
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ kind: 'pan', pointerId: event.pointerId, origin: { x: event.clientX, y: event.clientY }, from: { x: view.x, y: view.y } })
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    if (drag.kind === 'pan' && drag.from) {
      setView(current => ({ ...current, x: drag.from!.x + (event.clientX - drag.origin.x) / current.scale, y: drag.from!.y + (event.clientY - drag.origin.y) / current.scale }))
      return
    }
    const point = toGraph(event)
    if (drag.kind === 'wire') {
      setDrag({ ...drag, cursor: point })
      return
    }
    if (drag.kind === 'node' && drag.nodes) {
      const dx = point.x - drag.origin.x
      const dy = point.y - drag.origin.y
      const moved = new Map(drag.nodes.map(item => [item.id, { x: snap(item.x + dx), y: snap(item.y + dy) }]))
      onChange({ ...value, nodes: value.nodes.map(node => (moved.has(node.id) ? { ...node, ...moved.get(node.id)! } : node)) })
    }
  }

  /** Finish a wire drag on a port: the drop decides which end is the source. */
  const dropOnPort = (node: GraphNode, side: Side, portId: string) => {
    const port = drag?.port
    if (!port || port.side === side) return
    const from = side === 'in' ? nodes.get(port.nodeId) : node
    const to = side === 'in' ? node : nodes.get(port.nodeId)
    if (!from || !to) return
    const outputId = side === 'in' ? port.portId : portId
    const inputId = side === 'in' ? portId : port.portId
    const error = connectionError(value, from, outputId, to, inputId)
    if (error) {
      setRefused(error)
      return
    }
    const edge: GraphEdge = { id: `edge-${Date.now().toString(36)}-${value.edges.length}`, from: from.id, output: outputId, to: to.id, input: inputId }
    onChange({ ...value, edges: [...value.edges, edge] })
  }

  const onPointerUp = (event: ReactPointerEvent) => {
    if (drag && event.pointerId === drag.pointerId) setDrag(null)
  }

  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) {
      setView(current => ({ ...current, x: current.x - event.deltaX / current.scale, y: current.y - event.deltaY / current.scale }))
      return
    }
    const box = surface.current?.getBoundingClientRect()
    const local = { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
    setView(current => {
      const scale = Math.max(0.35, Math.min(2, current.scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1)))
      // Keep the point under the cursor still while zooming.
      return { scale, x: local.x / scale - (local.x / current.scale - current.x), y: local.y / scale - (local.y / current.scale - current.y) }
    })
  }

  useEffect(() => {
    if (!refused) return
    const timer = setTimeout(() => setRefused(null), 2200)
    return () => clearTimeout(timer)
  }, [refused])

  const wireEnd = drag?.kind === 'wire' && drag.port && drag.cursor ? drag.cursor : null
  const wireStart = drag?.kind === 'wire' && drag.port ? anchor(nodes.get(drag.port.nodeId)!, drag.port.side, drag.port.portId) : null

  return (
    <div className={`ngraph ${className ?? ''}`.trim()} onKeyDown={onKeyDown} tabIndex={0}>
      <div
        ref={surface}
        className="ngraph-surface"
        onPointerDown={startPan}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={event => setPalette(toGraph(event))}
        onContextMenu={event => {
          event.preventDefault()
          setPalette(toGraph(event))
        }}
      >
        <div className="ngraph-world" style={{ transform: `scale(${view.scale}) translate(${view.x}px, ${view.y}px)` }}>
          <svg className="ngraph-wires" aria-hidden>
            {value.edges.map(edge => {
              const from = nodes.get(edge.from)
              const to = nodes.get(edge.to)
              if (!from || !to) return null
              const path = wirePath(anchor(from, 'out', edge.output ?? 'value'), anchor(to, 'in', edge.input ?? 'value'))
              return (
                <g key={edge.id} className="ngraph-wire">
                  <path className="ngraph-wire-line" d={path} />
                  {/* A fat transparent copy makes the thin wire clickable. */}
                  <path className="ngraph-wire-hit" d={path} onClick={() => onChange({ ...value, edges: value.edges.filter(item => item.id !== edge.id) })}>
                    <title>Click to disconnect</title>
                  </path>
                </g>
              )
            })}
            {wireStart && wireEnd && <path className="ngraph-wire-line is-live" d={wirePath(drag!.port!.side === 'out' ? wireStart : wireEnd, drag!.port!.side === 'out' ? wireEnd : wireStart)} />}
          </svg>

          {value.nodes.map(node => {
            const schema = schemaFor(node.type)
            const problems = byNode.get(node.id) ?? []
            const readout = readouts?.get(node.id)
            return (
              <div
                key={node.id}
                className={`ngraph-node${selected.includes(node.id) ? ' is-selected' : ''}${problems.some(item => item.severity === 'error') ? ' is-error' : ''}`}
                style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: nodeHeight(node) }}
                title={problems.map(item => item.message).join('\n') || schema?.description}
              >
                <header className="ngraph-node-head" onPointerDown={event => startNodeDrag(event, node)}>
                  <span className="ngraph-node-title">{schema?.label ?? node.type}</span>
                  {readout !== undefined && <b className="ngraph-node-readout">{round(readout)}</b>}
                </header>

                {portsOf(node, 'in').map((port, index) => (
                  <button
                    key={`in-${port.id}`}
                    type="button"
                    className={`ngraph-port is-in${edgesInto(value, node.id, port.id).length ? ' is-wired' : ''}${port.required ? ' is-required' : ''}`}
                    style={{ top: HEADER_H + PORT_TOP + index * PORT_GAP }}
                    title={`${port.label ?? port.id}${port.multiple ? ' (accepts several)' : ''}`}
                    onPointerDown={event => startWire(event, node, 'in', port.id)}
                    onPointerUp={() => dropOnPort(node, 'in', port.id)}
                  >
                    <span className="ngraph-port-dot" />
                    <span className="ngraph-port-label">{port.label ?? port.id}</span>
                  </button>
                ))}

                {portsOf(node, 'out').map((port, index) => (
                  <button
                    key={`out-${port.id}`}
                    type="button"
                    className="ngraph-port is-out"
                    style={{ top: HEADER_H + PORT_TOP + index * PORT_GAP }}
                    title={port.label ?? port.id}
                    onPointerDown={event => startWire(event, node, 'out', port.id)}
                    onPointerUp={() => dropOnPort(node, 'out', port.id)}
                  >
                    <span className="ngraph-port-dot" />
                  </button>
                ))}

                <div className="ngraph-fields" style={{ top: HEADER_H + PORT_TOP + Math.max(inputsOf(node).length, outputsOf(node).length) * PORT_GAP }}>
                  {fieldsOf(node).map(field => {
                    const current = fieldValue(node, field.id)
                    const options = field.kind === 'signal' ? signals : undefined
                    return (
                      <label key={field.id} className="ngraph-field">
                        <span>{field.label}</span>
                        {field.kind === 'number' && (
                          <input
                            type="number"
                            value={Number(current ?? 0)}
                            step={field.step ?? 0.01}
                            min={field.min}
                            max={field.max}
                            onPointerDown={event => event.stopPropagation()}
                            onChange={event => patch(node.id, { [field.id]: Number(event.target.value) })}
                          />
                        )}
                        {field.kind === 'select' && (
                          <select value={String(current ?? '')} onPointerDown={event => event.stopPropagation()} onChange={event => patch(node.id, { [field.id]: event.target.value })}>
                            {(field.options ?? []).map(option => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        )}
                        {field.kind === 'parameter' && (
                          <select value={String(current ?? '')} onPointerDown={event => event.stopPropagation()} onChange={event => patch(node.id, { [field.id]: event.target.value })}>
                            <option value="">Choose…</option>
                            {(parameters ?? []).map(option => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                        {field.kind === 'signal' &&
                          (options?.length ? (
                            <select value={String(current ?? '')} onPointerDown={event => event.stopPropagation()} onChange={event => patch(node.id, { [field.id]: event.target.value })}>
                              <option value="">Choose…</option>
                              {options.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input type="text" value={String(current ?? '')} onPointerDown={event => event.stopPropagation()} onChange={event => patch(node.id, { [field.id]: event.target.value })} />
                          ))}
                        {field.kind === 'text' && (
                          <input type="text" value={String(current ?? '')} onPointerDown={event => event.stopPropagation()} onChange={event => patch(node.id, { [field.id]: event.target.value })} />
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {palette && (
          <div className="ngraph-palette" style={{ left: (palette.x + view.x) * view.scale, top: (palette.y + view.y) * view.scale }} onPointerDown={event => event.stopPropagation()}>
            {GRAPH_CATEGORIES.map(category => {
              const items = NODE_SCHEMAS.filter(schema => schema.category === category)
              if (!items.length) return null
              return (
                <div key={category} className="ngraph-palette-group">
                  <b>{category}</b>
                  {items.map(schema => (
                    <button key={schema.type} type="button" title={schema.description} onClick={() => addNode(schema.type, palette)}>
                      {schema.label}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="ngraph-status">
        <span>{value.nodes.length} nodes · {value.edges.length} wires</span>
        <span className="ngraph-status-hint">Double-click to add · drag a port to wire · click a wire to cut · Delete removes</span>
        {refused && <span className="ngraph-status-error">{refused}</span>}
        {!refused && diagnostics.length > 0 && <span className="ngraph-status-error">{diagnostics[0].message}</span>}
        <button type="button" onClick={() => setView({ x: 40, y: 20, scale: 1 })}>
          Reset view
        </button>
      </div>
    </div>
  )
}

export default NodeGraph
