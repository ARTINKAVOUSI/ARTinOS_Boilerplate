import type { ArtinosRuntime, ParameterDefinition, ParameterValue } from '@artinos/runtime'

export type SceneObjectLike = Record<string, any>
export interface SceneParameterBinding { definition: ParameterDefinition; read(): ParameterValue; write(value: ParameterValue): void }

const vector = (value: any, fallback: number) => [value?.x ?? fallback, value?.y ?? fallback, value?.z ?? fallback]
const color = (value: any) => value?.getHexString ? `#${value.getHexString()}` : '#ffffff'
const safeId = (object: SceneObjectLike) => String(object.uuid ?? object.name ?? object.type ?? 'object').replace(/[^a-z0-9_-]/gi, '-').toLowerCase()

/** Creates semantic definitions and real setters from public Three.js surfaces only. */
export function sceneObjectBindings(object: SceneObjectLike): SceneParameterBinding[] {
  const prefix = `selection.${safeId(object)}`
  const bindings: SceneParameterBinding[] = []
  const add = (suffix: string, definition: Omit<ParameterDefinition, 'id' | 'defaultValue'>, read: () => ParameterValue, write: (value: any) => void) => bindings.push({ definition: { ...definition, id: `${prefix}.${suffix}`, defaultValue: read(), metadata: { ...definition.metadata, sceneObject: object.uuid, scenePath: suffix } }, read, write })
  add('name', { label: 'Name', type: 'string', group: 'Identity' }, () => object.name ?? '', value => { object.name = value })
  add('visible', { label: 'Visible', type: 'boolean', group: 'Identity' }, () => object.visible !== false, value => { object.visible = value })
  if ('castShadow' in object) add('castShadow', { label: 'Cast Shadow', type: 'boolean', group: 'Identity' }, () => Boolean(object.castShadow), value => { object.castShadow = value })
  if ('receiveShadow' in object) add('receiveShadow', { label: 'Receive Shadow', type: 'boolean', group: 'Identity' }, () => Boolean(object.receiveShadow), value => { object.receiveShadow = value })
  for (const [key, label, fallback] of [['position', 'Position', 0], ['rotation', 'Rotation', 0], ['scale', 'Scale', 1]] as const) add(key, { label, type: 'vec3', group: 'Transform', step: .01 }, () => vector(object[key], fallback), value => object[key]?.set?.(...value))
  if (object.isCamera) for (const [key, label, min, max, step] of [['near', 'Near', .0001, 1000, .001], ['far', 'Far', .01, 100000, 1], ['zoom', 'Zoom', .01, 1000, .01], ...(object.isPerspectiveCamera ? [['fov', 'FOV', 1, 179, .1] as const] : [])] as const) add(key, { label, type: 'number', group: 'Camera', min, max, step }, () => Number(object[key]), value => { object[key] = value; object.updateProjectionMatrix?.() })
  if (object.isLight) {
    if (object.color) add('color', { label: 'Color', type: 'color', group: 'Light' }, () => color(object.color), value => object.color.set(value))
    for (const [key, label, min, max, step] of [['intensity', 'Intensity', 0, 1000, .05], ['distance', 'Distance', 0, 10000, .1], ['decay', 'Decay', 0, 10, .05], ['angle', 'Angle', .001, Math.PI / 2, .01], ['penumbra', 'Penumbra', 0, 1, .01]] as const) if (key in object) add(key, { label, type: 'number', group: 'Light', min, max, step }, () => Number(object[key]), value => { object[key] = value })
  }
  const materials = (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean)
  materials.forEach((material: any, index: number) => {
    const group = materials.length > 1 ? `Material ${index + 1}` : 'Material'
    const commit = (key: string, value: any) => { material[key] = value; material.needsUpdate = true }
    if (material.color) add(`material.${index}.color`, { label: 'Color', type: 'color', group }, () => color(material.color), value => { material.color.set(value); material.needsUpdate = true })
    for (const [key, label] of [['roughness', 'Roughness'], ['metalness', 'Metalness'], ['opacity', 'Opacity']] as const) if (key in material) add(`material.${index}.${key}`, { label, type: 'number', group, min: 0, max: 1, step: .01 }, () => Number(material[key]), value => commit(key, value))
    for (const [key, label] of [['transparent', 'Transparent'], ['wireframe', 'Wireframe'], ['depthWrite', 'Depth Write']] as const) if (key in material) add(`material.${index}.${key}`, { label, type: 'boolean', group }, () => Boolean(material[key]), value => commit(key, value))
  })
  return bindings
}

export function connectSceneObject(runtime: ArtinosRuntime, object: SceneObjectLike): { ids: string[]; dispose(): void } {
  const bindings = sceneObjectBindings(object)
  const unbind = bindings.map(binding => {
    runtime.parameters.ensure(binding.definition)
    runtime.parameters.set(binding.definition.id, binding.read(), 'snapshot')
    return runtime.parameters.subscribeBase(binding.definition.id, () => binding.write(runtime.parameters.getBase(binding.definition.id) as ParameterValue))
  })
  return { ids: bindings.map(binding => binding.definition.id), dispose: () => unbind.forEach(dispose => dispose()) }
}
