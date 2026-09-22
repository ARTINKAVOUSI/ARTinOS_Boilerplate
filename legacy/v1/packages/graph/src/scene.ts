import * as THREE from 'three'
import { evaluateNumeric, isNumericNode } from './numeric'
import { edgesInto, fieldValue, topologicalOrder } from './schema'
import { SCENE_NODE_TYPES, NUMERIC_NODE_TYPES, type GraphDiagnostic, type GraphDomainExecutor, type GraphNode } from './types'

const vector=(value:unknown,fallback:[number,number,number]):[number,number,number]=>
  Array.isArray(value)&&value.length>=3?[Number(value[0])||0,Number(value[1])||0,Number(value[2])||0]:fallback

export const sceneExecutor:GraphDomainExecutor<unknown>={domain:'scene',nodeTypes:[...SCENE_NODE_TYPES,...NUMERIC_NODE_TYPES],schedule:'frame',
  evaluate(context){
    const started=performance.now(),{runtime,graph}=context,values=new Map<string,unknown>(),diagnostics:GraphDiagnostic[]=[]
    const scene=runtime.resources.get<THREE.Scene>('three.scene')
    if(!scene)return {graphId:graph.id,domain:'scene',values,elapsedMs:0,diagnostics:[{severity:'warning',message:'Waiting for the scene to mount'}]}
    const numbers=evaluateNumeric(context)
    for(const [id,value] of numbers)values.set(id,value)
    /** A connected number wins over the authored field, so scene channels can be signal-driven. */
    const driven=(node:GraphNode,portId:string)=>{
      const edge=edgesInto(graph,node.id,portId)[0]
      return edge?numbers.get(edge.from):undefined
    }
    const resolve=(node:GraphNode):THREE.Object3D|undefined=>{
      const edge=edgesInto(graph,node.id,'object')[0]
      if(edge)return values.get(edge.from) as THREE.Object3D|undefined
      const name=String(fieldValue(node,'object')??'')
      return name?scene.getObjectByName(name)??undefined:undefined
    }

    for(const node of topologicalOrder(graph).order){
      if(isNumericNode(node))continue
      if(node.type==='scene-object'){
        const name=String(fieldValue(node,'object')??''),object=name?scene.getObjectByName(name):undefined
        if(!object){diagnostics.push({severity:'warning',message:`Scene object "${name||'—'}" was not found`,nodeId:node.id});continue}
        values.set(node.id,object);continue
      }
      const object=resolve(node)
      if(!object){diagnostics.push({severity:'warning',message:'No scene object is connected',nodeId:node.id});continue}
      if(node.type==='transform'){
        const position=vector(fieldValue(node,'position'),[0,0,0]),rotation=vector(fieldValue(node,'rotation'),[0,0,0]),scale=vector(fieldValue(node,'scale'),[1,1,1])
        object.position.set(driven(node,'positionX')??position[0],driven(node,'positionY')??position[1],driven(node,'positionZ')??position[2])
        object.rotation.set(driven(node,'rotationX')??rotation[0],driven(node,'rotationY')??rotation[1],driven(node,'rotationZ')??rotation[2])
        const uniform=driven(node,'scale')
        object.scale.set(uniform??scale[0],uniform??scale[1],uniform??scale[2])
      }else if(node.type==='visible'){
        const connected=driven(node,'value')
        object.visible=connected===undefined?Boolean(fieldValue(node,'value')):connected>.5
      }else if(node.type==='material-parameter'){
        const material=(object as THREE.Mesh).material as (THREE.Material&Record<string,unknown>)|undefined
        const property=String(fieldValue(node,'property')??'')
        if(!material||Array.isArray(material)){diagnostics.push({severity:'warning',message:'This object has no single material',nodeId:node.id});continue}
        if(!property||!(property in material)){diagnostics.push({severity:'warning',message:`Material has no property "${property}"`,nodeId:node.id});continue}
        const next=driven(node,'value')??Number(fieldValue(node,'value')??0)
        if(material[property]!==next){material[property]=next;material.needsUpdate=true}
      }
      values.set(node.id,object)
    }
    return {graphId:graph.id,domain:'scene',values,elapsedMs:performance.now()-started,diagnostics}
  }}
