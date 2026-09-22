import { Effect, type EffectProps as O } from './effect'
export function Pixelation({pixelSize=6,normalEdge=.3,depthEdge=.4,...rest}:{pixelSize?:number;normalEdge?:number;depthEdge?:number}&O){return <Effect type="pixelation" params={{pixelSize,normalEdge,depthEdge}} {...rest}/>}
