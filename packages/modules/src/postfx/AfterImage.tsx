import { Effect, type EffectProps as O } from './effect'
export function AfterImage({damp=.96,...rest}:{damp?:number}&O){return <Effect type="afterImage" params={{damp}} {...rest}/>}
