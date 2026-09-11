import { lazy, Suspense, useMemo, type CSSProperties, type PropsWithChildren } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useArtinosRuntime } from './runtime'
import { RuntimeFrameBridge } from './frame-bridge'
import { PostFXProvider, type PostFXController } from './postfx'
import { ThreeInspectorRuntime } from './three-inspector'

const RenderPipelineSystem=lazy(()=>import('./postfx-pipeline').then(module=>({default:module.RenderPipelineSystem})))

export interface ArtinosCanvasProps extends PropsWithChildren { dpr?: number | [number, number]; shadows?: boolean; className?: string; style?: CSSProperties; backend?: 'auto' | 'webgpu' | 'webgl2'; postfx?: boolean; alpha?: boolean; antialias?: boolean; powerPreference?: 'default' | 'high-performance' | 'low-power'; controller?: PostFXController; threeInspector?: boolean; threeInspectorVisible?: boolean }
export function ArtinosCanvas({ children, dpr = [1, 2], shadows = true, className, style, backend = 'auto', postfx = true, alpha = false, antialias = true, powerPreference = 'high-performance', controller, threeInspector = false, threeInspectorVisible = false }: ArtinosCanvasProps) {
  const runtime = useArtinosRuntime(), CanvasV10 = Canvas as any
  const renderer = useMemo(() => async (props: any) => {
    const instance = new THREE.WebGPURenderer({ ...props, antialias, alpha, powerPreference, trackTimestamp: threeInspector, ...(backend === 'webgl2' ? { forceWebGL: true } : {}) } as any)
    ;(instance as any).__artinosManaged = true
    // R3F does not apply its `dpr` prop to a renderer instance we construct ourselves, so the
    // clamp has to be pinned on the renderer: `setPixelRatio` is wrapped to refuse anything above
    // the display's own ratio, including the values R3F sets on every resize.
    const maxDpr = Math.min(Array.isArray(dpr) ? dpr[1] : dpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
    const setPixelRatio = instance.setPixelRatio?.bind(instance)
    if (setPixelRatio) instance.setPixelRatio = (value: number) => setPixelRatio(Math.min(value, maxDpr))
    instance.setPixelRatio?.(maxDpr)
    await instance.init()
    runtime.telemetry.set('renderer.backend.requested', backend, { group: 'renderer' })
    runtime.telemetry.set('inspector.three.enabled', threeInspector, { group: 'runtime' })
    runtime.logger.info(`Renderer requested: ${backend}`, { source: 'scene' })
    return instance
  }, [backend, runtime, alpha, antialias, powerPreference, threeInspector, dpr])
  // Never shade above the display's own pixel ratio. R3F takes dpr as a [min,max] range and
  // will happily pick the max, so a project asking for [.75,2] rendered 3532x2499 (8.8 MP) on a
  // 1.25-DPR screen -- 2.6x the pixels the monitor can show, downsampled away by the compositor
  // and costing the frame budget for nothing. Deliberate supersampling belongs in the SSAA effect.
  const deviceDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const clampedDpr = Array.isArray(dpr) ? [Math.min(dpr[0], deviceDpr), Math.min(dpr[1], deviceDpr)] as [number, number] : Math.min(dpr, deviceDpr)

  return <div className={className} style={{ position: 'absolute', inset: 0, ...style }} data-artinos-canvas><CanvasV10 dpr={clampedDpr} shadows={shadows} renderer={renderer}><RuntimeFrameBridge/><PostFXProvider controller={controller}><>{children}{postfx&&<Suspense fallback={null}><RenderPipelineSystem/></Suspense>}</></PostFXProvider>{threeInspector&&<ThreeInspectorRuntime visible={threeInspectorVisible}/>}</CanvasV10></div>
}
