import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  NeutralToneMapping,
  NoToneMapping,
  PCFShadowMap,
  PCFSoftShadowMap,
  ReinhardToneMapping,
  VSMShadowMap,
  BasicShadowMap,
  type ToneMapping,
  type ShadowMapType,
} from 'three'
import type { Feature } from '../../app/feature'

export type ToneMappingName = 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces' | 'agx' | 'neutral'
export type ShadowType = 'basic' | 'pcf' | 'pcf-soft' | 'vsm'

const TONE: Record<ToneMappingName, ToneMapping> = {
  none: NoToneMapping,
  linear: LinearToneMapping,
  reinhard: ReinhardToneMapping,
  cineon: CineonToneMapping,
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
  neutral: NeutralToneMapping,
}

const SHADOW: Record<ShadowType, ShadowMapType> = {
  basic: BasicShadowMap,
  pcf: PCFShadowMap,
  'pcf-soft': PCFSoftShadowMap,
  vsm: VSMShadowMap,
}

export interface RenderSettingsProps {
  toneMapping?: ToneMappingName
  exposure?: number
  shadows?: boolean
  shadowType?: ShadowType
  /** Upper bound for the pixel ratio (never above the display's). */
  maxPixelRatio?: number
}

/** RenderSettings — tone mapping, exposure, shadow filtering and resolution for the renderer. */
export function RenderSettings({ toneMapping = 'agx', exposure = 1, shadows = true, shadowType = 'pcf-soft', maxPixelRatio = 2 }: RenderSettingsProps) {
  const gl = useThree(state => state.gl)
  const setDpr = useThree(state => state.setDpr)
  const scene = useThree(state => state.scene)

  useEffect(() => {
    gl.toneMapping = TONE[toneMapping] ?? AgXToneMapping
    gl.toneMappingExposure = exposure
  }, [gl, toneMapping, exposure])

  useEffect(() => {
    gl.shadowMap.enabled = shadows
    gl.shadowMap.type = SHADOW[shadowType] ?? PCFSoftShadowMap
    // Materials cache their shadow setup; force a refresh.
    scene.traverse(object => {
      const material = (object as { material?: { needsUpdate: boolean } | { needsUpdate: boolean }[] }).material
      for (const m of Array.isArray(material) ? material : material ? [material] : []) m.needsUpdate = true
    })
  }, [gl, scene, shadows, shadowType])

  useEffect(() => {
    setDpr(Math.min(maxPixelRatio, window.devicePixelRatio || 1))
  }, [setDpr, maxPixelRatio])

  return null
}

export default RenderSettings

export const feature: Feature = {
  id: 'scene.render',
  label: 'Render',
  kind: 'scene',
  group: 'Render',
  order: 1,
  component: RenderSettings,
  controls: {
    toneMapping: { type: 'select', value: 'agx', options: ['none', 'linear', 'reinhard', 'cineon', 'aces', 'agx', 'neutral'], label: 'Tone map' },
    exposure: { type: 'number', value: 1, min: 0, max: 4, step: 0.01 },
    shadows: { type: 'boolean', value: true },
    shadowType: { type: 'select', value: 'pcf-soft', options: ['basic', 'pcf', 'pcf-soft', 'vsm'], label: 'Shadow filter' },
    maxPixelRatio: { type: 'number', value: 2, min: 0.5, max: 3, step: 0.05, label: 'Max DPR' },
  },
}
