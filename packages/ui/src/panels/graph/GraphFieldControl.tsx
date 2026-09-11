import type { ReactNode } from 'react'
import type { GraphField } from '@artinos/graph'
import { NumberField, Select, TextField, Toggle, VectorField } from '../../primitives'

export interface FieldSources{signals:readonly string[];parameters:readonly string[];effects:readonly string[];effectParameters:Record<string,readonly string[]>;objects:readonly string[]}
export const emptySources:FieldSources={signals:[],parameters:[],effects:[],effectParameters:{},objects:[]}

const options=(values:readonly string[],current:string)=>{
  const list=values.includes(current)||!current?values:[current,...values]
  return [{label:list.length?'—':'none available',value:''},...list.map(value=>({label:value,value}))]
}

/**
 * Renders one schema field. `compact` is the inline form drawn on the node body;
 * the inspector uses the full form with labels and ranges.
 */
export function GraphFieldControl({field,value,sources,onChange,compact=false,effectId}:{
  field:GraphField;value:unknown;sources:FieldSources;onChange(value:unknown):void;compact?:boolean;effectId?:string
}){
  const label=field.label
  const wrap=(children:ReactNode)=><div className={`artinos-gfield ${compact?'is-compact':''}`} title={field.description}>{children}</div>
  if(field.kind==='boolean')return wrap(<Toggle label={label} value={Boolean(value??field.default)} onChange={onChange}/>)
  if(field.kind==='number')return wrap(<NumberField label={label} value={Number(value??field.default??0)} min={field.min} max={field.max} step={field.step??.01} onChange={onChange}/>)
  if(field.kind==='select')return wrap(<Select label={label} value={String(value??field.default??'')} options={(field.options??[]).map(item=>({label:item,value:item}))} onChange={onChange}/>)
  if(field.kind==='signal')return wrap(<Select label={label} value={String(value??'')} options={options(sources.signals,String(value??''))} onChange={onChange}/>)
  if(field.kind==='parameter')return wrap(<Select label={label} value={String(value??'')} options={options(sources.parameters,String(value??''))} onChange={onChange}/>)
  if(field.kind==='effect')return wrap(<Select label={label} value={String(value??'')} options={options(sources.effects,String(value??''))} onChange={onChange}/>)
  if(field.kind==='effect-parameter')return wrap(<Select label={label} value={String(value??'')} options={options(sources.effectParameters[effectId??'']??[],String(value??''))} onChange={onChange}/>)
  if(field.kind==='scene-object')return wrap(<Select label={label} value={String(value??'')} options={options(sources.objects,String(value??''))} onChange={onChange}/>)
  if(field.kind==='vector3')return wrap(<VectorField label={label} value={Array.isArray(value)?value as number[]:(field.default as number[])??[0,0,0]} dimensions={3} onChange={onChange}/>)
  return wrap(<TextField label={label} value={String(value??'')} onChange={onChange}/>)
}
