import { useEffect, useRef } from 'react'

export type SceneEnvironment = 'atelier' | 'garden' | 'studio'

interface Palette {
  base: [string, string, string]
  tile: string
  blobs: string[]
}

const ENVIRONMENTS: Record<SceneEnvironment, Palette> = {
  atelier: { base: ['#7a5a30', '#2d3f42', '#8a6a3a'], tile: 'rgba(230,200,150,.16)', blobs: ['#c98f3e', '#2e6f72', '#8f3f34', '#d8b66a'] },
  garden: { base: ['#2f4a22', '#16301f', '#5a6b2a'], tile: 'rgba(200,230,160,.10)', blobs: ['#6d9b3a', '#243f22', '#a8bd54', '#3b7a55'] },
  studio: { base: ['#2a2e33', '#16181b', '#3a4046'], tile: 'rgba(210,220,235,.08)', blobs: ['#4a5560', '#7d8894', '#2b3138', '#9aa6b2'] },
}

const TAU = 6.283

/** Procedural ornament — an architectural rhythm, not a photograph. */
function ornament(context: CanvasRenderingContext2D, width: number, height: number, tile: string) {
  const size = 76
  context.lineWidth = 1.1
  context.strokeStyle = tile
  for (let y = -size; y < height + size; y += size) {
    for (let x = -size; x < width + size; x += size) {
      const cx = x + size / 2
      const cy = y + size / 2
      const radius = size * 0.4
      context.beginPath()
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4
        const reach = i % 2 ? radius * 0.56 : radius
        const px = cx + Math.cos(angle) * reach
        const py = cy + Math.sin(angle) * reach
        if (i) context.lineTo(px, py)
        else context.moveTo(px, py)
      }
      context.closePath()
      context.stroke()
      context.beginPath()
      context.arc(cx, cy, radius * 0.18, 0, TAU)
      context.stroke()
    }
  }
}

function paint(context: CanvasRenderingContext2D, palette: Palette, seconds: number, width: number, height: number) {
  const ground = context.createLinearGradient(0, 0, width, height)
  ground.addColorStop(0, palette.base[0])
  ground.addColorStop(0.55, palette.base[1])
  ground.addColorStop(1, palette.base[2])
  context.globalAlpha = 1
  context.filter = 'none'
  context.fillStyle = ground
  context.fillRect(0, 0, width, height)

  ornament(context, width, height, palette.tile)

  // Slow drifting light — the scene has to be alive to be worth transmitting.
  context.filter = 'blur(64px)'
  context.globalAlpha = 0.58
  palette.blobs.forEach((colour, i) => {
    const phase = seconds * 0.055 + i * 1.9
    const x = width * (0.5 + Math.cos(phase) * (0.3 + i * 0.05))
    const y = height * (0.5 + Math.sin(phase * 1.28 + i) * (0.3 + i * 0.04))
    context.fillStyle = colour
    context.beginPath()
    context.arc(x, y, Math.min(width, height) * (0.2 + i * 0.035), 0, TAU)
    context.fill()
  })
  context.filter = 'none'
  context.globalAlpha = 1

  // A vignette, so floating panels keep their edge luminance.
  const vignette = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.78)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,.55)')
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
}

/**
 * SceneBackdrop — living content under the glass (reference `#scene`).
 *
 * Frost needs something to transmit: a tiled ornament under slowly drifting
 * light, vignetted so floating panels keep their edge. Pure canvas 2D, sized to
 * its positioned parent. With reduced motion it paints still frames only.
 */
export function SceneBackdrop({ environment = 'atelier', className }: { environment?: SceneEnvironment; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const palette = useRef<Palette>(ENVIRONMENTS[environment] ?? ENVIRONMENTS.atelier)
  const repaint = useRef<() => void>(() => {})

  useEffect(() => {
    palette.current = ENVIRONMENTS[environment] ?? ENVIRONMENTS.atelier
    repaint.current()
  }, [environment])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const started = performance.now()
    let width = 0
    let height = 0
    let handle = 0

    const draw = (now: number) => paint(context, palette.current, (now - started) / 1000, width, height)
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw(performance.now())
    }
    const loop = (now: number) => {
      draw(now)
      handle = requestAnimationFrame(loop)
    }

    repaint.current = () => draw(performance.now())
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    if (!still) handle = requestAnimationFrame(loop)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(handle)
      repaint.current = () => {}
    }
  }, [])

  return <canvas ref={canvasRef} className={className ? `artinos-scene ${className}` : 'artinos-scene'} aria-hidden />
}
