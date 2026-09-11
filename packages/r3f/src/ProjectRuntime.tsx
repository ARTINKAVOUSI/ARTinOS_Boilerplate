import { useEffect } from 'react'
import { GraphEngine, GraphRegistry } from '@artinos/graph'
import { defs, nativeModuleCatalog, postFXCatalog, postFXPresets, scenePresets } from '@artinos/modules'
import { useArtinosRuntime, type ArtinosRuntime, type ParameterDefinition, type ParameterValue, type Unsubscribe } from '@artinos/runtime'
import { normalizeCleanup, type ArtinosProject } from './project'

const projectResource=(project:ArtinosProject)=>({id:project.id,name:project.name,version:project.version??'1.0.0',description:project.description})

export function installProject(runtime:ArtinosRuntime,project:ArtinosProject):Unsubscribe {
  const cleanup:Unsubscribe[]=[]
  cleanup.push(runtime.commands.register({id:'project.save',label:'Save Project',execute:()=>{runtime.persistence.save()}}))
  cleanup.push(runtime.commands.register({id:'preset.apply',label:'Apply Preset',execute:context=>{runtime.presets.apply(String(context.value??''))}}))
  cleanup.push(runtime.commands.register({id:'parameter.set',label:'Set Parameter',execute:context=>{const id=String(context.metadata?.parameter??'');if(id)runtime.setParameter(id,context.value as ParameterValue,'Action command')}}))
  cleanup.push(runtime.commands.register({id:'quality.set-tier',label:'Set Quality Tier',execute:context=>runtime.quality.setState({tier:String(context.value??'balanced') as any})}))
  const parameters=[...Object.values(defaultParameterDefinitions()),...(project.parameters??[])]
  for(const definition of parameters)runtime.parameters.ensure(definition)
  for(const effect of postFXCatalog){
    runtime.parameters.ensure({id:`postfx.${effect.type}.enabled`,label:`${effect.label} Enabled`,type:'boolean',defaultValue:['bloom','vignette','fxaa'].includes(effect.type),group:`PostFX / ${effect.label}`,order:0})
    runtime.parameters.ensure({id:`postfx.${effect.type}.order`,label:'Order',type:'number',defaultValue:(postFXCatalog.indexOf(effect)+1)*100,min:0,max:5000,step:10,group:`PostFX / ${effect.label}`,advanced:true})
    for(const parameter of effect.params)runtime.parameters.ensure({id:`postfx.${effect.type}.${parameter.key}`,label:parameter.label,type:parameter.type,defaultValue:parameter.defaultValue,min:parameter.min,max:parameter.max,step:parameter.step,group:`PostFX / ${effect.label}`,modulatable:parameter.type==='number',automatable:parameter.type==='number'} as ParameterDefinition)
  }

  for(const module of [...nativeModuleCatalog,...(project.modules??[])]){
    cleanup.push(runtime.modules.register(module))
    const installed=module.headless?.install(runtime)
    if(installed)cleanup.push(installed)
  }
  for(const [id,preset] of Object.entries(scenePresets))runtime.presets.upsert({id:`scene:${id}`,label:id,group:'scene',values:{'scene.environment':preset.environment,'scene.environment.intensity':preset.environmentIntensity,'scene.lighting':preset.lighting,'scene.lighting.intensity':preset.lightIntensity,'scene.shadows':preset.shadows,'camera.preset':preset.cameraPreset,'render.exposure':preset.exposure,'render.preset':preset.renderPreset,'render.toneMapping':preset.toneMapping,'scene.fog':preset.fog,'scene.grid':preset.grid}})
  for(const [name,effects] of Object.entries(postFXPresets)){const values:Record<string,ParameterValue>={};for(const effect of postFXCatalog)values[`postfx.${effect.type}.enabled`]=false;for(const effect of effects){values[`postfx.${effect.type}.enabled`]=true;for(const[key,value]of Object.entries(effect.params))values[`postfx.${effect.type}.${key}`]=value}runtime.presets.upsert({id:`postfx:${name}`,label:name,group:'postfx',values})}
  for(const preset of project.presets??[])runtime.presets.upsert(preset)
  for(const binding of project.bindings??[])cleanup.push(runtime.bindings.add(binding))

  const graphs=new GraphRegistry(),engine=new GraphEngine(runtime)
  for(const graph of project.graphs??[])graphs.upsert(graph)
  cleanup.push(runtime.resources.set('graph.registry',graphs,{kind:'graph-registry',owner:project.id}))
  cleanup.push(runtime.resources.set('graph.engine',engine,{kind:'graph-engine',owner:project.id}))
  cleanup.push(runtime.resources.set('project.active',projectResource(project),{kind:'project',owner:project.id}))
  cleanup.push(runtime.frames.add({id:`project.${project.id}.graphs`,phase:'parameters',priority:100,run:({time})=>engine.runAll(graphs,time)}))
  cleanup.push(normalizeCleanup(project.setup?.({runtime})))
  runtime.persistence.load()
  for(const graph of runtime.projectState.get<typeof project.graphs>('graphs')??[])if(graph)graphs.upsert(graph)
  cleanup.push(runtime.persistence.enableAutosave(500))
  runtime.telemetry.set('project.active',project.id,{group:'project'})
  runtime.logger.info(`${project.name} initialized`,{source:'project'})
  return()=>{for(let index=cleanup.length-1;index>=0;index--)cleanup[index]();runtime.logger.info(`${project.name} disposed`,{source:'project'})}
}

export function ProjectRuntime({project}:{project:ArtinosProject}){const runtime=useArtinosRuntime();useEffect(()=>installProject(runtime,project),[runtime,project]);return null}

function defaultParameterDefinitions(){
  // Kept as a function so projects can extend definitions without sharing mutable arrays.
  return defs
}
