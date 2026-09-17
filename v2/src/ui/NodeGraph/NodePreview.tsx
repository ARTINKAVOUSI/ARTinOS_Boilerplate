import { memo } from 'react'

export const PREVIEW_W = 168
export const PREVIEW_H = 44

/** A readback of a compiled node, produced by the host's renderer. */
export interface PreviewFrame {
  width: number
  height: number
  pixels: Uint8Array
  updatedAt: number
}

const histories = new Map<string, number[]>()
const HISTORY = 64

export function sampleHistory(key: string, value: number) {
  const list = histories.get(key) ?? []
  if (list.length && list.at(-1) === value && list.length > 2) return list
  list.push(value)
  if (list.length > HISTORY) list.splice(0, list.length - HISTORY)
  histories.set(key, list)
  return list
}
export const clearHistory = (key: string) => histories.delete(key)

/** SVG keeps previews renderer-neutral: no second canvas is ever created. */
export const ValuePreview = memo(function ValuePreview({ nodeKey, value }: { nodeKey: string; value: number }) {
  const history = sampleHistory(nodeKey, value)
  if (history.length < 2) return <svg className="ngraph-preview-canvas" viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} />
  let min = Math.min(...history)
  let max = Math.max(...history)
  if (max - min < 1e-6) {
    min -= 0.5
    max += 0.5
  }
  const span = max - min
  const points = history.map((item, index) => `${(index / (history.length - 1)) * PREVIEW_W},${PREVIEW_H - ((item - min) / span) * (PREVIEW_H - 3) - 1.5}`).join(' ')
  return (
    <svg className="ngraph-preview-canvas" viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} preserveAspectRatio="none">
      <line x1="0" x2={PREVIEW_W} y1={PREVIEW_H / 2} y2={PREVIEW_H / 2} stroke="currentColor" opacity=".12" />
      <polygon points={`0,${PREVIEW_H} ${points} ${PREVIEW_W},${PREVIEW_H}`} fill="currentColor" opacity=".16" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  )
})

/** Downsampled GPU readback, drawn as cells — the panel never owns a renderer. */
export const RenderPreview = memo(function RenderPreview({ frame }: { frame?: PreviewFrame }) {
  if (!frame) return <div className="ngraph-preview-pending">compiling…</div>
  const columns = Math.min(32, frame.width)
  const rows = Math.min(16, frame.height)
  const cellW = PREVIEW_W / columns
  const cellH = PREVIEW_H / rows
  const cells = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const sx = Math.floor((x / columns) * frame.width)
      const sy = Math.floor(((rows - 1 - y) / rows) * frame.height)
      const index = (sy * frame.width + sx) * 4
      const r = frame.pixels[index] ?? 0
      const g = frame.pixels[index + 1] ?? 0
      const b = frame.pixels[index + 2] ?? 0
      cells.push(<rect key={`${x}:${y}`} x={x * cellW} y={y * cellH} width={cellW + 0.2} height={cellH + 0.2} fill={`rgb(${r},${g},${b})`} />)
    }
  }
  return (
    <svg className="ngraph-preview-canvas is-render" viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} preserveAspectRatio="none" shapeRendering="crispEdges">
      {cells}
    </svg>
  )
})
