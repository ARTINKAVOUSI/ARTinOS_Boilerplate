import { useEffect, useRef, useState } from 'react'
import { useArtinosRuntime } from '@artinos/runtime'
export type LightingPreset = 'none' | 'neutral' | 'studio' | 'softbox' | 'product' | 'portrait' | 'dramatic' | 'cinematic' | 'sun' | 'night'

export interface LightingProps {
  preset?: LightingPreset
  shadows?: boolean
  intensity?: number
  keyIntensity?: number
  fill?: number
  rim?: number
  color?: string
  temperature?: number
  shadowMapSize?: number
}

const temperatureColor = (kelvin: number) => {
  const temperature = kelvin / 100
  let red: number
  let green: number
  let blue: number

  if (temperature <= 66) {
    red = 255
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661
    blue = temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307
  } else {
    red = 329.698727446 * Math.pow(temperature - 60, -.1332047592)
    green = 288.1221695283 * Math.pow(temperature - 60, -.0755148492)
    blue = 255
  }

  const hex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${hex(red)}${hex(green)}${hex(blue)}`
}

export function Lighting({
  preset = 'studio',
  shadows = true,
  intensity = 1,
  keyIntensity = 1,
  fill = 1,
  rim = 1,
  color,
  temperature = 5600,
  shadowMapSize = 2048,
}: LightingProps) {
  const runtime=useArtinosRuntime(),[qualityShadowSize,setQualityShadowSize]=useState(shadowMapSize)
  useEffect(()=>runtime.quality.register('scene.lighting.shadows',quality=>{const requested=Math.max(256,Math.floor(shadowMapSize*quality.scalar)),next=Math.min(shadowMapSize,2**Math.round(Math.log2(requested)));setQualityShadowSize(next);runtime.telemetry.set('scene.lighting.shadowMapSize',next,{group:'quality'})}),[runtime,shadowMapSize])
  if (preset === 'none') return null
  const white = color ?? temperatureColor(temperature)

  const KeyDirectional=({position,lightIntensity}:{position:[number,number,number];lightIntensity:number})=>{const ref=useRef<any>(null);useEffect(()=>{if(!ref.current)return;const clean=[runtime.resources.set('scene.mainLight',ref.current,{kind:'light',owner:'scene.lighting'}),runtime.resources.set('scene.godraysLight',ref.current,{kind:'light',owner:'scene.lighting'})];return()=>clean.forEach(dispose=>dispose())},[]);return <directionalLight ref={ref} color={white} castShadow={shadows} position={position} intensity={lightIntensity} shadow-mapSize={[qualityShadowSize,qualityShadowSize]}/>}

  if (preset === 'sun') return <>
    <hemisphereLight intensity={.35 * intensity} />
    <KeyDirectional position={[6,8,3]} lightIntensity={3*intensity*keyIntensity}/>
  </>

  if (preset === 'night') return <>
    <ambientLight intensity={.07 * intensity} />
    <pointLight position={[-3, 2, 2]} color="#4e72ff" intensity={8 * intensity * keyIntensity} />
    <pointLight position={[3, 1, -2]} color="#ff3d88" intensity={5 * intensity * fill} />
  </>

  if (preset === 'dramatic' || preset === 'cinematic') return <>
    <ambientLight intensity={.06 * intensity} />
    <spotLight castShadow={shadows} position={[4, 7, 4]} color={white} intensity={(preset === 'cinematic' ? 9 : 12) * intensity * keyIntensity} angle={.45} penumbra={.55} />
    <pointLight position={[-4, 2, -2]} color="#7ab8ff" intensity={3 * intensity * fill} />
    <pointLight position={[0, 3, -5]} color="#ffa66d" intensity={2.5 * intensity * rim} />
  </>

  if (preset === 'neutral') return <>
    <ambientLight intensity={.7 * intensity} />
    <KeyDirectional position={[4,6,5]} lightIntensity={1.6*intensity*keyIntensity}/>
  </>

  if (preset === 'portrait') return <>
    <ambientLight intensity={.2 * intensity} />
    <spotLight position={[3, 4, 4]} angle={.75} penumbra={.85} intensity={6 * intensity * keyIntensity} color={white} />
    <spotLight position={[-3, 2, 3]} angle={.9} penumbra={.9} intensity={3 * intensity * fill} />
    <pointLight position={[0, 3, -3]} intensity={2 * intensity * rim} />
  </>

  const soft = preset === 'softbox' || preset === 'product'
  return <>
    <ambientLight intensity={.24 * intensity} />
    <hemisphereLight intensity={.2 * intensity} />
    <spotLight color={white} position={[4, 5, 4]} angle={soft ? .8 : .6} penumbra={.9} intensity={(soft ? 7 : 6) * intensity * keyIntensity} />
    <spotLight position={[-4, 2, 2]} angle={.9} penumbra={.95} intensity={3 * intensity * fill} />
    <KeyDirectional position={[2,6,-4]} lightIntensity={1.2*intensity*rim}/>
  </>
}
