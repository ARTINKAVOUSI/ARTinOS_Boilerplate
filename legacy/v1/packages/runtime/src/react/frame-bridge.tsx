import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { installNodePreview } from './node-preview'
import { useArtinosRuntime } from './runtime'

const phases = ['input','signals','parameters','simulation','compute','before-render'] as const
export function RuntimeFrameBridge() {
  const runtime = useArtinosRuntime()
  const frame = useRef(0)
  const context = useRef({time:0,delta:0,frame:0})
  const previousPointer = useRef<[number, number]>([0, 0])
  const scene = useThree((s: any) => s.scene)
  const camera = useThree((s: any) => s.camera)
  const renderer = useThree((s: any) => s.renderer ?? s.gl)

  useEffect(() => {
    const a = runtime.resources.set('three.scene', scene)
    const b = runtime.resources.set('three.camera', camera)
    const c = runtime.resources.set('three.renderer', renderer,{kind:'renderer',owner:'scene'})
    // Node thumbnails render through the same renderer, inside the frame loop.
    const d = installNodePreview(runtime, renderer)
    return () => { d(); a(); b(); c() }
  }, [runtime, scene, camera, renderer])

  useEffect(()=>{let lastSample=-Infinity,lastPipeline='';return runtime.frames.add({id:'core.scene-reflection',phase:'telemetry',priority:900,run:({time})=>{if(time-lastSample<1)return;lastSample=time;let objects=0,meshes=0,lights=0;scene.traverse((object:any)=>{objects++;if(object.isMesh)meshes++;if(object.isLight)lights++});runtime.telemetry.set('scene.objects',objects,{group:'scene'});runtime.telemetry.set('scene.meshes',meshes,{group:'scene'});runtime.telemetry.set('scene.lights',lights,{group:'scene'});const pipeline={postfx:Boolean(runtime.resources.get('render.pipeline')),depth:Boolean(runtime.resources.get('render.depth')),normal:Boolean(runtime.resources.get('render.normal')),velocity:Boolean(runtime.resources.get('render.velocity'))},signature=JSON.stringify(pipeline);if(signature!==lastPipeline){lastPipeline=signature;runtime.projectState.set('render.pipeline',pipeline)}}})},[runtime,scene])

  useFrame((state: any, delta: number) => {
    const time = state.clock?.elapsedTime ?? performance.now()/1000
    const pointer = state.pointer ?? { x: 0, y: 0 }
    const current: [number, number] = [pointer.x, pointer.y]
    const velocity: [number, number] = delta > 0 ? [(current[0]-previousPointer.current[0])/delta, (current[1]-previousPointer.current[1])/delta] : [0,0]
    previousPointer.current = current
    runtime.signals.set('time.elapsed', time)
    runtime.signals.set('time.delta', delta)
    runtime.signals.set('pointer.ndc', current)
    runtime.signals.set('pointer.velocity', velocity)
    runtime.signals.set('viewport.size', [state.size?.width ?? 0, state.size?.height ?? 0])
    const ctx = { time, delta, frame: ++frame.current }
    context.current = ctx
    for (const phase of phases) runtime.frames.run(phase, ctx)
  }, -1000)
  useFrame(() => {
    runtime.frames.run('post-render',context.current)
    runtime.frames.run('telemetry',context.current)
  }, {phase:'finish'})
  return null
}
