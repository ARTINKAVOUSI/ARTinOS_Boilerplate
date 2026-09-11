import { Effect, type EffectProps as O } from './effect'
export function MotionBlur({samples=16,...rest}:{samples?:number}&O){return <Effect type="motionBlur" params={{samples}} {...rest}/>}
