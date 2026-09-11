import { createNode } from './schema'
import type { GraphDefinition, GraphDomain, GraphEdge, GraphNode } from './types'

export interface GraphTemplate{id:string;name:string;domain:GraphDomain;description:string;build(id:string):GraphDefinition}

const chain=(nodes:GraphNode[],links:Array<[number,number,string?,string?]>):GraphEdge[]=>
  links.map(([from,to,input,output],index)=>({id:`edge-${index}`,from:nodes[from].id,to:nodes[to].id,input:input??'value',output:output??'value',order:index}))

const column=(index:number)=>36+index*236
const row=(index:number)=>36+index*168

export const GRAPH_TEMPLATES:readonly GraphTemplate[]=[
  {id:'blank',name:'Blank',domain:'signal',description:'An empty canvas.',
    build:id=>({id,name:'Untitled Graph',domain:'signal',enabled:true,nodes:[],edges:[]})},

  {id:'audio-pulse',name:'Audio Pulse → Parameter',domain:'signal',description:'Smooths audio bass, shapes it and drives a parameter every frame.',
    build:id=>{
      const nodes=[
        createNode('signal',column(0),row(0),{id:'audio.bass'}),
        createNode('smooth',column(1),row(0),{amount:.82}),
        createNode('remap',column(2),row(0),{inMin:0,inMax:1,outMin:0,outMax:1.4}),
        createNode('clamp',column(3),row(0),{min:0,max:1.5}),
        createNode('write-parameter',column(4),row(0),{id:'visual.orb.energy'}),
      ]
      return {id,name:'Audio Pulse',domain:'signal',enabled:true,nodes,edges:chain(nodes,[[0,1],[1,2],[2,3],[3,4]])}
    }},

  {id:'oscillator',name:'Oscillator → Signal',domain:'signal',description:'A free-running waveform published as a signal any binding can read.',
    build:id=>{
      const nodes=[
        createNode('oscillator',column(0),row(0),{wave:'sine',frequency:.25,amplitude:.5,offset:.5}),
        createNode('write-signal',column(1),row(0),{id:'graph.oscillator'}),
      ]
      return {id,name:'Oscillator',domain:'signal',enabled:true,nodes,edges:chain(nodes,[[0,1]])}
    }},

  {id:'reactive-bloom',name:'Reactive Bloom',domain:'render',description:'Drives PostFX bloom strength from smoothed audio energy.',
    build:id=>{
      const nodes=[
        createNode('signal',column(0),row(0),{id:'audio.bass'}),
        createNode('smooth',column(1),row(0),{amount:.78}),
        createNode('remap',column(2),row(0),{inMin:0,inMax:1,outMin:.15,outMax:1.2}),
        createNode('effect-parameter',column(3),row(0),{id:'bloom',parameter:'strength'}),
      ]
      return {id,name:'Reactive Bloom',domain:'render',enabled:true,nodes,edges:chain(nodes,[[0,1],[1,2],[2,3]])}
    }},

  {id:'scene-motion',name:'Scene Motion',domain:'scene',description:'Floats a named scene object on a sine wave.',
    build:id=>{
      const nodes=[
        createNode('oscillator',column(0),row(0),{wave:'sine',frequency:.3,amplitude:.4,offset:0}),
        createNode('scene-object',column(0),row(1),{object:''}),
        createNode('transform',column(2),row(0),{}),
      ]
      return {id,name:'Scene Motion',domain:'scene',enabled:true,
        nodes,edges:[
          {id:'edge-0',from:nodes[1].id,to:nodes[2].id,output:'object',input:'object',order:0},
          {id:'edge-1',from:nodes[0].id,to:nodes[2].id,output:'value',input:'positionY',order:1},
        ]}
    }},

  {id:'tsl-pulse',name:'TSL Pulse',domain:'gpu',description:'Compiles a signal-driven TSL node published as graph.<id>.tsl.',
    build:id=>{
      const nodes=[
        createNode('signal',column(0),row(0),{id:'audio.bass'}),
        createNode('smoothstep',column(1),row(0),{min:0,max:1}),
        createNode('output',column(2),row(0),{target:'resource'}),
      ]
      return {id,name:'TSL Pulse',domain:'gpu',enabled:true,nodes,edges:chain(nodes,[[0,1],[1,2]])}
    }},
]

export const templatesForDomain=(domain:GraphDomain)=>GRAPH_TEMPLATES.filter(template=>template.domain===domain||template.id==='blank')
