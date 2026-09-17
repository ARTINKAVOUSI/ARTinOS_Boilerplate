import { useCallback, useEffect, useRef } from 'react'
import { usePanZoom, wirePath, type Point } from './view'
import './NodeGraph.css'

export const LIVE_NODE_WIDTH = 210
const HEADER_H = 34
const ROW_H = 22
const PAD = 8
const COLUMN_GAP = 80
export const LIVE_COLUMN_STEP = LIVE_NODE_WIDTH + COLUMN_GAP

export type LiveControl =
  | { kind: 'number'; id: string; label: string; value: number; min?: number; max?: number; step?: number }
  | { kind: 'boolean'; id: string; label: string; value: boolean }
  | { kind: 'readout'; id: string; label: string; value: string }

export interface LiveNode {
  id: string
  title: string
  subtitle?: string
  detail?: string
  /** Right-hand readout in the node header. */
  value?: string
  /** 0-based column index; the builder decides what each column means. */
  column: number
  y: number
  controls?: LiveControl[]
  /** Drawn dimmed: present but not doing anything right now. */
  muted?: boolean
  /** Colour family: input, logic, parameter, scene, render, output. */
  tone?: 'input' | 'logic' | 'parameter' | 'scene' | 'render' | 'output'
}

export interface LiveEdge {
  id: string
  from: string
  to: string
}

export interface LiveGraphData {
  nodes: LiveNode[]
  edges: LiveEdge[]
  columns: string[]
}

export const liveNodeHeight = (node: LiveNode) => HEADER_H + (node.controls?.length ?? 0) * ROW_H + PAD
const nodeX = (node: LiveNode) => node.column * LIVE_COLUMN_STEP
const anchorIn = (node: LiveNode): Point => ({ x: nodeX(node), y: node.y + HEADER_H / 2 })
const anchorOut = (node: LiveNode): Point => ({ x: nodeX(node) + LIVE_NODE_WIDTH, y: node.y + HEADER_H / 2 })

export interface LiveGraphProps {
  data: LiveGraphData
  /** A control on a node was changed. */
  onControl?: (nodeId: string, controlId: string, value: number | boolean) => void
  /** A node header was clicked. */
  onSelect?: (nodeId: string) => void
  selected?: string | null
  className?: string
}

/**
 * LiveGraph — a read-back view of a running system: columns of nodes wired in
 * the order the work actually happens, each carrying the live controls of the
 * thing it stands for.
 *
 * The component draws and edits; it never decides what is in the graph. The
 * caller builds `data` from whatever is running and handles `onControl`.
 */
export function LiveGraph({ data, onControl, onSelect, selected, className }: LiveGraphProps) {
  const { surface, transform, startPan, movePan, endPan, onWheel, setView, view } = usePanZoom({ x: 16, y: 34, scale: 0.85 })
  const byId = new Map(data.nodes.map(node => [node.id, node]))

  const fit = useCallback(() => {
    const box = surface.current?.getBoundingClientRect()
    if (!box || !data.nodes.length) return
    const width = Math.max(...data.nodes.map(node => node.column)) * LIVE_COLUMN_STEP + LIVE_NODE_WIDTH
    // Fit the columns across, never below readable. A pipeline taller than the
    // panel is scrolled, not shrunk into illegibility.
    const scale = Math.max(0.5, Math.min(1, (box.width - 24) / width))
    setView({ scale, x: 12 / scale, y: 34 / scale })
  }, [data.nodes, setView, surface])

  // Frame the pipeline once; after that the view is the reader's to move.
  const framed = useRef(false)
  useEffect(() => {
    if (framed.current || !data.nodes.length) return
    framed.current = true
    fit()
  }, [data.nodes.length, fit])

  return (
    <div className={`ngraph nglive ${className ?? ''}`.trim()}>
      <div ref={surface} className="ngraph-surface" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onWheel={onWheel}>
        <div className="ngraph-world" style={{ transform }}>
          <svg className="ngraph-wires" aria-hidden>
            {data.edges.map(edge => {
              const from = byId.get(edge.from)
              const to = byId.get(edge.to)
              if (!from || !to) return null
              return <path key={edge.id} className={`ngraph-wire-line${from.muted || to.muted ? ' is-muted' : ''}`} d={wirePath(anchorOut(from), anchorIn(to))} />
            })}
          </svg>

          {data.columns.map((title, index) => (
            <div key={title} className="nglive-column" style={{ left: index * LIVE_COLUMN_STEP, width: LIVE_NODE_WIDTH }}>
              {title}
            </div>
          ))}

          {data.nodes.map(node => (
            <div
              key={node.id}
              className={`ngraph-node nglive-node${node.muted ? ' is-muted' : ''}${selected === node.id ? ' is-selected' : ''}`}
              style={{ left: nodeX(node), top: node.y, width: LIVE_NODE_WIDTH, height: liveNodeHeight(node) }}
              data-tone={node.tone}
              title={node.detail}
            >
              <header className="ngraph-node-head nglive-head" onClick={() => onSelect?.(node.id)}>
                <span className="nglive-titles">
                  <span className="ngraph-node-title">{node.title}</span>
                  {node.subtitle && <small>{node.subtitle}</small>}
                </span>
                {node.value !== undefined && <b className="ngraph-node-readout">{node.value}</b>}
              </header>
              <div className="nglive-controls">
                {(node.controls ?? []).map(control => (
                  <label key={control.id} className="nglive-control">
                    <span>{control.label}</span>
                    {control.kind === 'number' && (
                      <>
                        <input
                          type="range"
                          value={control.value}
                          min={control.min ?? 0}
                          max={control.max ?? 1}
                          step={control.step ?? 0.01}
                          onPointerDown={event => event.stopPropagation()}
                          onChange={event => onControl?.(node.id, control.id, Number(event.target.value))}
                        />
                        <b>{Math.abs(control.value) >= 100 ? control.value.toFixed(0) : control.value.toFixed(2)}</b>
                      </>
                    )}
                    {control.kind === 'boolean' && (
                      <input type="checkbox" checked={control.value} onPointerDown={event => event.stopPropagation()} onChange={event => onControl?.(node.id, control.id, event.target.checked)} />
                    )}
                    {control.kind === 'readout' && <b>{control.value}</b>}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ngraph-status">
        <span>
          {data.nodes.length} nodes · {data.edges.length} links · {Math.round(view.scale * 100)}%
        </span>
        <span className="ngraph-status-hint">Live view of what is running · drag to pan · ⌘/Ctrl + scroll to zoom</span>
        <button type="button" onClick={fit}>
          Fit
        </button>
      </div>
    </div>
  )
}

export default LiveGraph
