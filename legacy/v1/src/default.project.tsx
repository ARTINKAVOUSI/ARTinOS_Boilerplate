import { Float } from '@artinos/modules/drei'
import { ReactiveOrb, SignalParticles } from '@artinos/modules'
import { defineArtinosProject } from '@artinos/r3f'
import type { GraphDefinition } from '@artinos/graph'
import type { ParameterDefinition } from '@artinos/runtime'

function Content(){
  if(new URLSearchParams(location.search).has('fail-startup'))throw new Error('Forced startup failure for recovery verification')
  return <group>
    <SignalParticles count={1800} signal="audio.bass" radius={2.8} size={.014}/>
    <Float speed={1.2} rotationIntensity={.18} floatIntensity={.35}>
      <ReactiveOrb signal="audio.bass" parameter="visual.orb.energy"/>
    </Float>
    <mesh rotation-x={-Math.PI/2} position-y={-1.15} receiveShadow>
      <circleGeometry args={[4,96]}/>
      <meshStandardMaterial color="#777876" roughness={.88}/>
    </mesh>
  </group>
}

const orbEnergy:ParameterDefinition={
  id:'visual.orb.energy',label:'Orb Energy',type:'number',defaultValue:0,
  min:0,max:1.5,step:.01,group:'Project',modulatable:true,
}

/**
 * Audio energy → orb, authored as a graph rather than a binding so the Graph
 * panel opens on something real. Open it and drag the Remap outputs while the
 * scene runs. One parameter should have one writer: adding a binding to
 * `visual.orb.energy` as well would make the two fight over the resolved value.
 */
const orbPulse:GraphDefinition={
  id:'orb-pulse',name:'Orb Pulse',domain:'signal',enabled:true,
  nodes:[
    {id:'bass',type:'signal',x:36,y:36,data:{id:'audio.bass'}},
    {id:'settle',type:'smooth',x:300,y:36,data:{amount:.82}},
    {id:'shape',type:'remap',x:564,y:36,data:{inMin:0,inMax:1,outMin:0,outMax:1.35}},
    {id:'limit',type:'clamp',x:300,y:264,data:{min:0,max:1.5}},
    {id:'drive',type:'write-parameter',x:564,y:264,data:{id:'visual.orb.energy'}},
  ],
  edges:[
    {id:'e1',from:'bass',to:'settle',output:'value',input:'value',order:0},
    {id:'e2',from:'settle',to:'shape',output:'value',input:'value',order:0},
    {id:'e3',from:'shape',to:'limit',output:'value',input:'value',order:0},
    {id:'e4',from:'limit',to:'drive',output:'value',input:'value',order:0},
  ],
}

export default defineArtinosProject({
  id:'default',name:'ARTINOS Boilerplate',version:'1.0.0',
  description:'Default reactive WebGPU stage',default:false,shell:'studio',
  renderer:{backend:'auto',dpr:[.75,2],shadows:true,postfx:true,alpha:false,antialias:false,powerPreference:'high-performance',threeInspector:true,threeInspectorVisible:false},
  Content,
  parameters:[orbEnergy],
  graphs:[orbPulse],
})
