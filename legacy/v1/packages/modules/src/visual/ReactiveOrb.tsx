import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3, type Mesh } from 'three'
import { useArtinosRuntime } from '@artinos/runtime'
export function ReactiveOrb({signal='audio.bass',parameter='visual.orb.energy',color='#79ffe1'}:{signal?:string;parameter?:string;color?:string}){const mesh=useRef<Mesh>(null),runtime=useArtinosRuntime(),target=useRef(new Vector3(1,1,1));useFrame((_s,d)=>{if(!mesh.current)return;const signalValue=Number(runtime.signals.get(signal)??0),parameterValue=Number(runtime.parameters.get(parameter)??0),energy=Math.max(0,Math.max(signalValue,parameterValue));mesh.current.rotation.y+=d*(.25+energy*.2);const scale=1+energy*.35;target.current.setScalar(scale);mesh.current.scale.lerp(target.current,.12)});return <mesh ref={mesh} castShadow><icosahedronGeometry args={[1,8]}/><meshPhysicalMaterial color={color} roughness={.18} metalness={.05} transmission={.12} clearcoat={1} emissive={color} emissiveIntensity={.35}/></mesh>}
