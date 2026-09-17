import { Center, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, Mesh } from 'three'
import type { Feature } from '../../app/feature'

export interface ModelProps {
  /** A .glb / .gltf URL. Draco-compressed files work with the decoder at `dracoPath`. */
  url?: string
  dracoPath?: string
  scale?: number
  position?: [number, number, number]
  /** Radians per second around Y. */
  spin?: number
  /** Centre the model on the origin and rest it on y = floor. */
  center?: boolean
  floor?: number
  shadows?: boolean
}

/** Model — loads any glTF file and drops it into the scene. */
export function Model({ url = '/models/glass-rings.glb', dracoPath = '/draco/', scale = 1, position = [0, 0, 0], spin = 0, center = true, floor = -1.15, shadows = true }: ModelProps) {
  const group = useRef<Group>(null)
  const { scene } = useGLTF(url, dracoPath)
  // A private copy, so two Model features with the same URL do not share one object.
  const object = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    object.traverse(child => {
      const mesh = child as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = shadows
        mesh.receiveShadow = shadows
      }
    })
  }, [object, shadows])

  useFrame((_, delta) => {
    if (group.current && spin) group.current.rotation.y += spin * delta
  })

  return (
    <group ref={group} position={position} scale={scale}>
      {center ? (
        <Center bottom position-y={floor / scale}>
          <primitive object={object} />
        </Center>
      ) : (
        <primitive object={object} />
      )}
    </group>
  )
}

export default Model

export const feature: Feature = {
  id: 'object.model',
  label: 'Model (glTF)',
  kind: 'scene',
  group: 'Objects',
  order: 103,
  enabled: false,
  component: Model,
  controls: {
    url: { type: 'text', value: '/models/glass-rings.glb', label: 'URL' },
    scale: { type: 'number', value: 1, min: 0.01, max: 20, step: 0.01 },
    spin: { type: 'number', value: 0, min: -3, max: 3, step: 0.01 },
    center: { type: 'boolean', value: true },
    shadows: { type: 'boolean', value: true },
  },
}
