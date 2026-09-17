import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'

/**
 * WebGPUCanvas — the one component that owns a canvas and a renderer.
 *
 * A React Three Fiber v10 canvas backed by three's WebGPURenderer. With
 * `backend="auto"` three uses WebGPU when the browser has it and falls back to
 * WebGL2 otherwise; `"webgl2"` forces the fallback. When neither exists the
 * `fallback` node is shown instead of a blank canvas.
 *
 * Requires: three >= 0.185, @react-three/fiber >= 10 (alpha).
 */

export type RendererBackend = 'webgpu' | 'webgl2'

export interface WebGPUCanvasProps {
  children?: ReactNode
  /** Pixel ratio range. Never exceeds the display's own ratio. */
  dpr?: number | [number, number]
  shadows?: boolean
  backend?: 'auto' | 'webgpu' | 'webgl2'
  alpha?: boolean
  antialias?: boolean
  powerPreference?: 'default' | 'high-performance' | 'low-power'
  /** Initial camera. Scene components (a Camera feature) may replace it. */
  camera?: { position?: [number, number, number]; fov?: number; near?: number; far?: number }
  /** Enables GPU timestamp queries — required by the three.js Inspector. */
  trackTimestamp?: boolean
  /** Called once the renderer is initialised, with the renderer and the backend actually in use. */
  onReady?: (renderer: WebGPURenderer, backend: RendererBackend) => void
  /** Shown when the browser supports neither WebGPU nor WebGL2. */
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}

const hasWebGPU = () => typeof navigator !== 'undefined' && 'gpu' in navigator
const hasWebGL2 = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export function WebGPUCanvas({
  children,
  dpr = [1, 2],
  shadows = true,
  backend = 'auto',
  alpha = false,
  antialias = true,
  powerPreference = 'high-performance',
  camera = { position: [0, 1.4, 5.5], fov: 45, near: 0.05, far: 500 },
  trackTimestamp = false,
  onReady,
  fallback,
  className,
  style,
}: WebGPUCanvasProps) {
  const [error, setError] = useState<string | null>(null)
  const supported = useMemo(() => (backend === 'webgpu' ? hasWebGPU() : hasWebGPU() || hasWebGL2()), [backend])

  // Shading above the display's ratio costs frame time the compositor throws
  // away. Deliberate supersampling belongs in an SSAA effect.
  const deviceDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const clamped: number | [number, number] = Array.isArray(dpr)
    ? [Math.min(dpr[0], deviceDpr), Math.min(dpr[1], deviceDpr)]
    : Math.min(dpr, deviceDpr)

  const renderer = useMemo(
    () => async (props: Record<string, unknown>) => {
      const instance = new WebGPURenderer({
        ...props,
        antialias,
        alpha,
        powerPreference,
        trackTimestamp,
        forceWebGL: backend === 'webgl2',
      } as ConstructorParameters<typeof WebGPURenderer>[0])
      // R3F does not apply `dpr` to a renderer it did not construct, so pin the clamp here.
      const max = Array.isArray(clamped) ? clamped[1] : clamped
      const setPixelRatio = instance.setPixelRatio.bind(instance)
      instance.setPixelRatio = (value: number) => setPixelRatio(Math.min(value, max))
      instance.setPixelRatio(max)
      try {
        await instance.init()
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
        throw reason
      }
      const backendObject = (instance as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend
      onReady?.(instance, backendObject?.isWebGPUBackend ? 'webgpu' : 'webgl2')
      return instance
    },
    // The renderer is created once per configuration; dpr changes go through setPixelRatio.
    [backend, alpha, antialias, powerPreference, trackTimestamp],
  )

  const shell: CSSProperties = { position: 'absolute', inset: 0, ...style }

  if (!supported || error) {
    return (
      <div className={className} style={{ ...shell, display: 'grid', placeItems: 'center', color: '#cfd3d6', font: '13px system-ui, sans-serif', background: '#0b0c0d' }}>
        {fallback ?? (
          <p style={{ maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
            {error ? `The renderer failed to start: ${error}` : 'This browser supports neither WebGPU nor WebGL2, so the 3D view cannot be shown.'}
          </p>
        )}
      </div>
    )
  }

  // R3F v10's Canvas accepts an async renderer factory; its types lag behind.
  const V10Canvas = Canvas as unknown as (props: Record<string, unknown>) => ReactNode
  return (
    <div className={className} style={shell}>
      <V10Canvas dpr={clamped} shadows={shadows} renderer={renderer} camera={camera}>
        {children}
      </V10Canvas>
    </div>
  )
}

export default WebGPUCanvas
