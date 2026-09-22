import { Effect, type EffectProps as O } from './effect'
export function Film({intensity=.12,...rest}:{intensity?:number}&O){return <Effect type="film" params={{intensity}} {...rest}/>}
