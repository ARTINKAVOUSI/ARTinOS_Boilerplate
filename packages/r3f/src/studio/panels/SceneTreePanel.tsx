import { useEffect, useRef, useState } from 'react'
import { Group } from 'three'
import { useArtinosRuntime, useResource } from '@artinos/runtime'
import { Button, KeyValue, SearchField, Section } from '../foundation'

export function SceneTreePanel(){
  const runtime=useArtinosRuntime(),scene=useResource<any>('three.scene'),[selected,setSelected]=useState<string>(''),[query,setQuery]=useState(''),[,refresh]=useState(0),cleanup=useRef<()=>void>(()=>{})
  useEffect(()=>()=>cleanup.current(),[])
  if(!scene)return <Section title="Scene Tree"><KeyValue label="Status" value="Waiting for scene"/></Section>
  const rows:Array<{depth:number;object:any;name:string;type:string;visible:boolean}>=[]
  const visit=(object:any,depth:number)=>{const name=object.name||object.type||object.uuid?.slice(0,8)||'Object';if(!query||`${name} ${object.type}`.toLowerCase().includes(query.toLowerCase()))rows.push({depth,object,name,type:object.type??'Object3D',visible:object.visible!==false});for(const child of object.children??[])visit(child,depth+1)}
  visit(scene,0)
  const select=(object:any)=>{cleanup.current();cleanup.current=runtime.resources.set('selection.objects',[object],{kind:'selection',owner:'scene-tree'});setSelected(object.uuid);runtime.signals.set('selection.count',1);runtime.signals.set('selection.uuid',object.uuid)}
  const selectedObject=scene.getObjectByProperty?.('uuid',selected)
  const persist=()=>{const objects:Record<string,unknown>={};scene.traverse((object:any)=>{if(!object.uuid)return;objects[object.uuid]={name:object.name,visible:object.visible,position:object.position?.toArray?.(),rotation:object.rotation?.toArray?.().slice(0,3),scale:object.scale?.toArray?.()}});runtime.projectState.set('scene.objects',objects);runtime.persistence.save();refresh(value=>value+1)}
  const addGroup=()=>{const object=new Group();object.name='New Group';scene.add(object);select(object);persist()}
  const duplicate=()=>{if(!selectedObject?.parent)return;const clone=selectedObject.clone(true);clone.traverse?.((object:any)=>{if(object.geometry)object.geometry=object.geometry.clone();if(object.material)object.material=Array.isArray(object.material)?object.material.map((material:any)=>material.clone()):object.material.clone()});clone.name=`${selectedObject.name||selectedObject.type} Copy`;selectedObject.parent.add(clone);select(clone);persist()}
  const remove=()=>{if(!selectedObject?.parent)return;selectedObject.parent.remove(selectedObject);selectedObject.traverse?.((object:any)=>{object.geometry?.dispose?.();const materials=Array.isArray(object.material)?object.material:[object.material];materials.filter(Boolean).forEach((material:any)=>material.dispose?.())});cleanup.current();setSelected('');persist()}
  const clear=()=>{cleanup.current();cleanup.current=()=>{};setSelected('');runtime.signals.set('selection.count',0)}
  return <Section title="Scene Tree" description={`${rows.length} objects · live hierarchy and selection`}><SearchField value={query} onChange={setQuery} placeholder="Find object"/><div className="artinos-button-row"><Button onClick={addGroup}>Add Group</Button><Button disabled={!selectedObject} onClick={duplicate}>Duplicate</Button><Button disabled={!selectedObject?.parent} onClick={remove}>Delete</Button><Button disabled={!selected} onClick={clear}>Clear</Button></div><div className="artinos-scene-tree">{rows.slice(0,500).map(row=><button key={row.object.uuid} className={selected===row.object.uuid?'is-selected':''} onClick={()=>select(row.object)} style={{paddingLeft:row.depth*10,opacity:row.visible?1:.45}}><b>{row.name}</b><small>{row.type}</small></button>)}</div></Section>
}
