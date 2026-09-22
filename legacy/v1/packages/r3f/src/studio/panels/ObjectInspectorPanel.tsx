import { useEffect, useMemo } from 'react'
import { useArtinosRuntime } from '@artinos/runtime'
import { KeyValue, Section } from '@artinos/ui'
import { connectSceneObject, sceneObjectBindings, type SceneObjectLike } from '../adapters/scene-schema'
import { useResources } from '../hooks'
import { ParametersPanel } from './ParametersPanel'

/** Schema-generated editor over public Object3D, camera, light and material properties. */
export function ObjectInspectorPanel() {
  const runtime = useArtinosRuntime()
  useResources()
  const selected = runtime.resources.get<SceneObjectLike[]>('selection.objects') ?? []
  const object = selected[0]
  const ids = useMemo(() => object ? sceneObjectBindings(object).map(binding => binding.definition.id) : [], [object])
  const multiEdit = useMemo(() => {
    if (!object) return {}
    const primary = sceneObjectBindings(object)
    const secondary = selected.slice(1).map(item => sceneObjectBindings(item))
    return Object.fromEntries(primary.map(binding => [binding.definition.id, secondary.map(list => list.find(candidate => candidate.definition.metadata?.scenePath === binding.definition.metadata?.scenePath)?.definition.id).filter((value): value is string => Boolean(value))]))
  }, [object, selected])
  useEffect(() => {
    if (!object) return
    const connections = selected.map(item => connectSceneObject(runtime, item))
    return () => connections.forEach(connection => connection.dispose())
  }, [runtime, object, selected])

  if (!object) return <Section title="Selection"><KeyValue label="Status" value="Select an object in Scene Tree" /></Section>
  return <>
    <Section title="Selected Object">
      <KeyValue label="Type" value={object.type ?? 'Object3D'} />
      <KeyValue label="UUID" value={String(object.uuid ?? '').slice(0, 18)} />
      <KeyValue label="Children" value={object.children?.length ?? 0} />
      {object.geometry && <KeyValue label="Geometry" value={`${object.geometry.type ?? 'BufferGeometry'} · ${object.geometry.attributes?.position?.count ?? 0} vertices`} />}
    </Section>
    <ParametersPanel includeIds={ids} multiEdit={multiEdit} />
  </>
}
