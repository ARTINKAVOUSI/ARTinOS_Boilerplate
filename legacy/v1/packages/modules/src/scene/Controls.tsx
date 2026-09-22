import { CameraControls, FlyControls, MapControls, OrbitControls, PointerLockControls, TrackballControls, TransformControls, PresentationControls, PivotControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { PropsWithChildren } from 'react'

export type ControlsMode = 'none' | 'orbit' | 'map' | 'trackball' | 'fly' | 'camera' | 'pointer-lock'
export interface ControlsProps { mode?: ControlsMode; makeDefault?: boolean; enabled?: boolean; damping?: boolean; dampingFactor?: number; minDistance?: number; maxDistance?: number; minPolarAngle?: number; maxPolarAngle?: number; autoRotate?: boolean; autoRotateSpeed?: number; enablePan?: boolean; enableZoom?: boolean; enableRotate?: boolean }
export function Controls({ mode = 'orbit', makeDefault = true, enabled = true, damping = true, dampingFactor = .08, minDistance = 0, maxDistance = Infinity, minPolarAngle = 0, maxPolarAngle = Math.PI, autoRotate = false, autoRotateSpeed = 2, enablePan = true, enableZoom = true, enableRotate = true }: ControlsProps) {
  if (mode === 'none' || !enabled) return null
  return <ReadyControls mode={mode} makeDefault={makeDefault} damping={damping} dampingFactor={dampingFactor} minDistance={minDistance} maxDistance={maxDistance} minPolarAngle={minPolarAngle} maxPolarAngle={maxPolarAngle} autoRotate={autoRotate} autoRotateSpeed={autoRotateSpeed} enablePan={enablePan} enableZoom={enableZoom} enableRotate={enableRotate}/>
}
function ReadyControls(props:Required<Pick<ControlsProps,'mode'|'makeDefault'|'damping'|'dampingFactor'|'minDistance'|'maxDistance'|'minPolarAngle'|'maxPolarAngle'|'autoRotate'|'autoRotateSpeed'|'enablePan'|'enableZoom'|'enableRotate'>>){
  const renderer=useThree((state:any)=>state.gl),domElement=renderer?.domElement as HTMLElement|undefined
  if(!domElement)return null
  if(props.mode==='map')return <MapControls domElement={domElement} makeDefault={props.makeDefault} enableDamping={props.damping} dampingFactor={props.dampingFactor} minDistance={props.minDistance} maxDistance={props.maxDistance}/>
  if(props.mode==='trackball')return <TrackballControls domElement={domElement} makeDefault={props.makeDefault}/>
  if(props.mode==='fly')return <FlyControls domElement={domElement} makeDefault={props.makeDefault}/>
  if(props.mode==='camera')return <CameraControls domElement={domElement} makeDefault={props.makeDefault}/>
  if(props.mode==='pointer-lock')return <PointerLockControls domElement={domElement} makeDefault={props.makeDefault}/>
  return <OrbitControls domElement={domElement} makeDefault={props.makeDefault} enableDamping={props.damping} dampingFactor={props.dampingFactor} minDistance={props.minDistance} maxDistance={props.maxDistance} minPolarAngle={props.minPolarAngle} maxPolarAngle={props.maxPolarAngle} autoRotate={props.autoRotate} autoRotateSpeed={props.autoRotateSpeed} enablePan={props.enablePan} enableZoom={props.enableZoom} enableRotate={props.enableRotate}/>
}
export function Presentation({ children, global = true, snap = true, speed = 1, zoom = 1, polar = [-Math.PI / 3, Math.PI / 3], azimuth = [-Infinity, Infinity] }: PropsWithChildren<{ global?: boolean; snap?: boolean | number; speed?: number; zoom?: number; polar?: [number, number]; azimuth?: [number, number] }>) { const renderer=useThree((state:any)=>state.gl),domElement=renderer?.domElement as HTMLElement|undefined;return domElement?<PresentationControls domElement={domElement} global={global} snap={snap} speed={speed} zoom={zoom} polar={polar} azimuth={azimuth}>{children}</PresentationControls>:null }
export { TransformControls, PivotControls }
