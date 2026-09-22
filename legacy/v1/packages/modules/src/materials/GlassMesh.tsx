import { forwardRef, type ComponentProps } from 'react'
import type { Mesh } from 'three'
import { GlassMaterial, type GlassMaterialProps } from './GlassMaterial'

export type GlassMeshProps = Omit<ComponentProps<'mesh'>, 'material'> & { glass?: GlassMaterialProps }

/** Reusable glass around any supplied geometry; the shared pipeline owns its captures. */
export const GlassMesh = forwardRef<Mesh, GlassMeshProps>(function GlassMesh({ glass, children, ...props }, ref) {
  return <mesh {...props} ref={ref}>{children}<GlassMaterial {...glass} /></mesh>
})
