import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { IESLoader } from 'three/addons/loaders/IESLoader.js'
import { IESSpotLight, LightProbe, SphericalHarmonics3 } from 'three/webgpu'
export type LightType='ambient'|'hemisphere'|'directional'|'point'|'spot'|'rect-area'|'ies'|'probe'
export interface LightProps {type?:LightType;color?:string;groundColor?:string;intensity?:number;position?:[number,number,number];castShadow?:boolean;distance?:number;decay?:number;angle?:number;penumbra?:number;width?:number;height?:number;shadowMapSize?:number;visible?:boolean;layers?:number;iesUrl?:string}
export function Light({type='directional',color='#ffffff',groundColor='#667788',intensity=1,position=[3,5,4],castShadow=false,distance=0,decay=2,angle=Math.PI/3,penumbra=.25,width=4,height=4,shadowMapSize=2048,visible=true,layers=0,iesUrl}:LightProps){
 if(type==='ies'){if(!iesUrl)return null;return <IESLight url={iesUrl} color={color} intensity={intensity} position={position} castShadow={castShadow} distance={distance} decay={decay} angle={angle} penumbra={penumbra} layers={layers} visible={visible}/>;}
 if(type==='probe')return visible?<ProbeLight intensity={intensity} layers={layers}/>:null
 if(type==='ambient')return <ambientLight color={color} intensity={intensity} visible={visible} layers={layers}/>
 if(type==='hemisphere')return <hemisphereLight color={color} groundColor={groundColor} intensity={intensity} position={position} visible={visible} layers={layers}/>
 if(type==='point')return <pointLight color={color} intensity={intensity} position={position} castShadow={castShadow} distance={distance} decay={decay} visible={visible} layers={layers} shadow-mapSize={[shadowMapSize,shadowMapSize]}/>
 if(type==='spot')return <spotLight color={color} intensity={intensity} position={position} castShadow={castShadow} distance={distance} decay={decay} angle={angle} penumbra={penumbra} visible={visible} layers={layers} shadow-mapSize={[shadowMapSize,shadowMapSize]}/>
 if(type==='rect-area')return <rectAreaLight color={color} intensity={intensity} position={position} width={width} height={height} visible={visible} layers={layers}/>
 return <directionalLight color={color} intensity={intensity} position={position} castShadow={castShadow} visible={visible} layers={layers} shadow-mapSize={[shadowMapSize,shadowMapSize]}/>
}
export function IESLight({url,...props}:{url:string}&Omit<LightProps,'type'|'iesUrl'>){const map=useLoader(IESLoader,url),light=useMemo(()=>new IESSpotLight(props.color,props.intensity,props.distance,props.angle,props.penumbra,props.decay),[]);useEffect(()=>{light.iesMap=map;light.position.fromArray(props.position??[3,5,4]);light.castShadow=props.castShadow??false;light.visible=props.visible??true;light.layers.set(props.layers??0);return()=>{map.dispose();light.dispose();}},[light,map,props.position,props.castShadow,props.layers,props.visible]);return <primitive object={light}/>;}
export function ProbeLight({intensity=1,layers=0}:{intensity?:number;layers?:number}){const probe=useMemo(()=>new LightProbe(new SphericalHarmonics3(),intensity),[intensity]);useEffect(()=>{probe.layers.set(layers);return()=>probe.dispose();},[probe,layers]);return <primitive object={probe}/>;}
