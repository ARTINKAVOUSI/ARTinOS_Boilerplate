import { Effect, type EffectProps as O } from './effect'
export function RadialBlur({strength=.2,...rest}:{strength?:number}&O){return <Effect type="radialBlur" params={{strength}} {...rest}/>}
