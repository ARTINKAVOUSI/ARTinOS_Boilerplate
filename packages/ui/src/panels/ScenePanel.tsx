import { useState, useSyncExternalStore } from 'react'
import { useArtinosRuntime, useParameter, type ParameterDefinition } from '@artinos/runtime'
import { Button, ColorField, FileField, KeyValue, NumberField, ObjectInspectorPanel, ParameterControl, QualityPanel, Section, Select, Tabs, TextField, Toggle, Toolbar, VectorField } from '../foundation'
import { defs } from '@artinos/modules'
import { SceneTreePanel } from './SceneTreePanel'
import { ProjectPanel } from './ProjectPanel'

const groups = {
  scene: [defs.fog, defs.fogColor, defs.fogNear, defs.fogFar, defs.fogDensity, defs.grid, defs.gridSize, defs.gridDivisions, defs.gridColor, defs.gridSectionColor, defs.gridFade],
  environment: [defs.environment, defs.environmentIntensity, defs.environmentBlur, defs.environmentRotation, defs.backgroundMode, defs.backgroundColor, defs.ground, defs.groundColor, defs.groundY],
  camera: [defs.cameraMode, defs.cameraPreset, defs.cameraTarget, defs.cameraLensPreset, defs.fov, defs.lens, defs.filmGauge, defs.cameraZoom, defs.cameraNear, defs.cameraFar, defs.viewLayout],
  controls: [defs.controls, defs.controlDamping, defs.controlDampingFactor, defs.autoRotate, defs.autoRotateSpeed, defs.minDistance, defs.maxDistance, defs.enablePan, defs.enableZoom, defs.enableRotate],
  lighting: [defs.lighting, defs.lightIntensity, defs.lightKey, defs.lightFill, defs.lightRim, defs.lightTemperature, defs.lightColor, defs.lightShadowMap],
  shadows: [defs.shadows, defs.shadowOpacity, defs.shadowBlur, defs.shadowSize, defs.shadowFar, defs.shadowSamples, defs.shadowFocus, defs.shadowColor],
  render: [defs.renderPreset, defs.shadowMap, defs.toneMapping, defs.outputColorSpace, defs.exposure, defs.clearAlpha],
} as const
const descriptions: Record<keyof typeof groups, string> = {
  scene: 'Set the atmosphere and ground guides.', environment: 'Shape the world, background and reflections.', camera: 'Compose your shot with lens and framing controls.', controls: 'Choose how you navigate the viewport.', lighting: 'Balance a lighting rig or add individual lights.', shadows: 'Control contact, softness and shadow detail.', render: 'Choose output appearance and performance.',
}
type SavedView = { position: number[]; target: number[]; fov: number; zoom: number }
export function ScenePanel() {
  const runtime = useArtinosRuntime()
  useSyncExternalStore(callback => runtime.presets.subscribe(callback), () => runtime.presets.revision, () => 0)
  const [tab, setTab] = useState<keyof typeof groups | 'objects' | 'project'>('scene')
  const [preset, setPreset] = useParameter(defs.scenePreset)
  const [viewName, setViewName] = useState('View 1'), [advanced, setAdvanced] = useState(false), [notice, setNotice] = useState('')
  const [, refresh] = useState(0)
  // Conditional controls subscribe to their actual switches, not every live parameter.
  const [fog] = useParameter(defs.fog), [grid] = useParameter(defs.grid), [background] = useParameter(defs.backgroundMode), [ground] = useParameter(defs.ground), [cameraMode] = useParameter(defs.cameraMode), [shadows] = useParameter(defs.shadows)
  const cameraViews = runtime.projectState.get<Record<string, SavedView>>('camera.views') ?? {}
  const persistViews = (views: Record<string, SavedView>) => { runtime.projectState.set('camera.views', views); runtime.persistence.save(); refresh(value => value + 1) }
  const captureView = () => {
    const camera = runtime.resources.get<any>('three.camera')
    if (!camera || !viewName.trim()) return
    persistViews({ ...cameraViews, [viewName.trim()]: { position: camera.position.toArray(), target: runtime.parameters.getBase<number[]>('camera.target') ?? [0, 0, 0], fov: Number(camera.fov ?? 45), zoom: Number(camera.zoom ?? 1) } })
    setNotice(`Saved “${viewName.trim()}”.`)
  }
  const applyView = (name: string) => {
    const view = cameraViews[name], camera = runtime.resources.get<any>('three.camera')
    if (!view || !camera) return
    runtime.transact(`Recall ${name}`, () => { runtime.setParameter('camera.target', view.target); runtime.setParameter('camera.fov', view.fov); runtime.setParameter('camera.zoom', view.zoom) })
    camera.position.fromArray(view.position); camera.lookAt(...view.target); camera.updateProjectionMatrix?.()
    setNotice(`Recalled “${name}”.`)
  }
  const importEnvironment = (files: File[]) => {
    const file = files[0]; if (!file) return
    const reader = new FileReader()
    reader.onerror = () => setNotice('Could not read this environment file. Try another HDR or EXR.')
    reader.onload = () => {
      runtime.transact('Import environment', () => { runtime.setParameter('scene.environment', 'hdr'); runtime.setParameter('scene.environment.hdr', String(reader.result ?? '')) })
      runtime.projectState.set('environment.asset', { name: file.name, type: file.type, size: file.size }); runtime.persistence.save(); setNotice(`Loaded ${file.name}.`)
    }
    reader.readAsDataURL(file)
  }
  const visible = (definition: ParameterDefinition) => {
    if (definition.advanced && !advanced) return false
    if (definition.id.startsWith('scene.fog.')) return fog !== 'off' && (definition === defs.fogDensity ? fog === 'exp2' : definition === defs.fogNear || definition === defs.fogFar ? fog === 'linear' : true)
    if (definition.id.startsWith('scene.grid.')) return Boolean(grid)
    if (definition === defs.backgroundColor) return background === 'color'
    if (definition === defs.groundColor || definition === defs.groundY) return Boolean(ground)
    if (definition === defs.cameraZoom) return cameraMode === 'orthographic'
    if ([defs.fov, defs.lens, defs.filmGauge, defs.cameraLensPreset].some(item => item.id === definition.id)) return cameraMode === 'perspective'
    if (definition.id.startsWith('scene.shadows.')) return shadows !== 'off'
    return true
  }
  return <div className="artinos-scene-layout">
    <Tabs value={tab} onChange={value => { setTab(value as typeof tab); setNotice('') }} items={[...Object.keys(groups).map(id => ({ id, label: id === 'scene' ? 'Atmosphere' : id })), { id: 'objects', label: 'Objects' }, { id: 'project', label: 'Project' }]} />
    {notice && <div className="artinos-panel-notice" role="status">{notice}</div>}
    {tab === 'objects' ? <div className="artinos-scene-object-layout"><SceneTreePanel /><ObjectInspectorPanel /></div> : tab === 'project' ? <ProjectPanel /> : <>
      <Toolbar><Toggle label="Advanced controls" value={advanced} onChange={setAdvanced} />{tab === 'scene' && <Select label="Scene preset" value={String(preset)} options={runtime.presets.list('scene').map(item => ({ value: item.label, label: item.label }))} onChange={value => { const match = runtime.presets.list('scene').find(item => item.label === value); if (match) { setPreset(value); runtime.presets.apply(match.id); setNotice(`Applied ${match.label}.`) } }} />}</Toolbar>
      <div className="artinos-scene-grid"><Section title={tab === 'scene' ? 'Atmosphere' : tab} description={descriptions[tab]}>{groups[tab].filter(visible).map(definition => <SceneParam key={definition.id} definition={definition} onChange={definition === defs.cameraLensPreset ? value => { const focal = ({ 'ultra-wide': 14, wide: 24, standard: 50, portrait: 85, telephoto: 135, macro: 100 } as Record<string, number>)[String(value)]; if (focal) runtime.setParameter('camera.lens', focal) } : undefined} />)}</Section>
      {tab === 'environment' && <Section title="Environment file" description="Use a local HDR or EXR for lighting and reflections."><FileField label="HDR / EXR" accept=".hdr,.exr,image/vnd.radiance" onFiles={importEnvironment} /><KeyValue label="Current asset" value={String(runtime.projectState.get<any>('environment.asset')?.name ?? 'Built-in environment')} /></Section>}
      {tab === 'camera' && <Section title="Saved views" description="Save your current camera position and lens settings."><TextField label="View name" value={viewName} onChange={setViewName} /><Button disabled={!viewName.trim()} onClick={captureView}>{cameraViews[viewName.trim()] ? 'Update saved view' : 'Save current view'}</Button>{Object.keys(cameraViews).map(name => <div className="artinos-button-row" key={name}><Button onClick={() => applyView(name)}>{name}</Button><Button title={`Remove saved view ${name}`} onClick={() => { const next = { ...cameraViews }; delete next[name]; persistViews(next) }}>Remove</Button></div>)}</Section>}
      {tab === 'lighting' && <CustomLightsEditor />}{tab === 'render' && <QualityPanel />}</div>
    </>}
  </div>
}
function SceneParam({ definition, onChange }: { definition: ParameterDefinition; onChange?: (value: unknown) => void }) {
  const runtime = useArtinosRuntime(), [value, setValue] = useParameter(definition)
  return <ParameterControl definition={definition} value={value} onChange={next => { setValue(next); onChange?.(next) }} onGestureStart={() => runtime.beginTransaction(`Adjust ${definition.label}`)} onGestureEnd={() => runtime.commitTransaction()} />
}
type ManagedLight={id:string;name:string;type:'ambient'|'hemisphere'|'directional'|'point'|'spot'|'rect-area';color:string;groundColor?:string;intensity:number;position:[number,number,number];castShadow:boolean;distance?:number;decay?:number;angle?:number;penumbra?:number;width?:number;height?:number;shadowMapSize?:number;visible:boolean}
const defaultLight=(type:ManagedLight['type']='directional'):ManagedLight=>({id:`light-${Date.now().toString(36)}`,name:`Custom ${type}`,type,color:'#ffffff',groundColor:'#667788',intensity:1,position:[3,5,4],castShadow:type==='directional'||type==='point'||type==='spot',distance:0,decay:2,angle:Math.PI/3,penumbra:.25,width:4,height:4,shadowMapSize:2048,visible:true})
function parseLights(json:unknown):ManagedLight[]{try{const value=JSON.parse(String(json??'[]'));return Array.isArray(value)?value:[]}catch{return[]}}
function CustomLightsEditor(){
 const[value,setValue]=useParameter(defs.customLights),[newType,setNewType]=useState<ManagedLight['type']>('directional'),lights=parseLights(value)
 const save=(next:ManagedLight[])=>setValue(JSON.stringify(next) as any),patch=(index:number,p:Partial<ManagedLight>)=>save(lights.map((light,i)=>i===index?{...light,...p}:light))
 return <Section title="Custom Lights" description="Add arbitrary Three lights on top of the selected lighting rig; project persistence stores the collection."><Select label="New Light Type" value={newType} options={['ambient','hemisphere','directional','point','spot','rect-area'].map(value=>({label:value,value}))} onChange={v=>setNewType(v as ManagedLight['type'])}/><Button onClick={()=>save([...lights,defaultLight(newType)])}>Add {newType}</Button>{lights.map((light,index)=><div className="artinos-light-card" key={light.id}><div className="artinos-module-head"><b>{light.name||light.type}</b><Button onClick={()=>save(lights.filter((_,i)=>i!==index))}>Remove</Button></div><Select label="Type" value={light.type} options={['ambient','hemisphere','directional','point','spot','rect-area'].map(v=>({label:v,value:v}))} onChange={v=>patch(index,{type:v as ManagedLight['type']})}/><Toggle label="Visible" value={light.visible!==false} onChange={visible=>patch(index,{visible})}/><ColorField label="Color" value={light.color??'#ffffff'} onChange={color=>patch(index,{color})}/>{light.type==='hemisphere'&&<ColorField label="Ground Color" value={light.groundColor??'#667788'} onChange={groundColor=>patch(index,{groundColor})}/>}<NumberField label="Intensity" value={light.intensity??1} min={0} max={100} step={.05} onChange={intensity=>patch(index,{intensity})}/>{light.type!=='ambient'&&<VectorField label="Position" value={light.position??[3,5,4]} dimensions={3} onChange={position=>patch(index,{position:position as [number,number,number]})}/>} {['directional','point','spot'].includes(light.type)&&<Toggle label="Cast Shadow" value={Boolean(light.castShadow)} onChange={castShadow=>patch(index,{castShadow})}/>} {['point','spot'].includes(light.type)&&<><NumberField label="Distance" value={light.distance??0} min={0} max={1000} step={.1} onChange={distance=>patch(index,{distance})}/><NumberField label="Decay" value={light.decay??2} min={0} max={8} step={.05} onChange={decay=>patch(index,{decay})}/></>} {light.type==='spot'&&<><NumberField label="Angle" value={light.angle??Math.PI/3} min={.01} max={Math.PI/2} step={.01} onChange={angle=>patch(index,{angle})}/><NumberField label="Penumbra" value={light.penumbra??.25} min={0} max={1} step={.01} onChange={penumbra=>patch(index,{penumbra})}/></>} {light.type==='rect-area'&&<><NumberField label="Width" value={light.width??4} min={.1} max={100} step={.1} onChange={width=>patch(index,{width})}/><NumberField label="Height" value={light.height??4} min={.1} max={100} step={.1} onChange={height=>patch(index,{height})}/></>} {light.castShadow&&<NumberField label="Shadow Map" value={light.shadowMapSize??2048} min={256} max={8192} step={256} onChange={shadowMapSize=>patch(index,{shadowMapSize})}/>}</div>)}{!lights.length&&<small>No custom lights. The selected rig still provides its preset lighting.</small>}</Section>
}

