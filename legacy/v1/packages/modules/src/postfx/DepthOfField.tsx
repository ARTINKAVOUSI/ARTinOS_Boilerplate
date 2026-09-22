import { Effect, type EffectProps as O } from './effect'
export function DepthOfField({focusDistance=4,focalLength=.02,bokehScale=2,...rest}:{focusDistance?:number;focalLength?:number;bokehScale?:number}&O){return <Effect type="dof" params={{focusDistance,focalLength,bokehScale}} {...rest}/>}
