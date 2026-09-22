import { Effect,type EffectProps as O } from './effect'
export function Vignette({intensity=.35,smoothness=.55,...rest}:{intensity?:number;smoothness?:number}&O){return <Effect type="vignette" params={{intensity,smoothness}} {...rest}/>}
