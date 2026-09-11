import { Effect, type EffectProps as O } from './effect'
/** Compatibility export for the pipeline's high-scale native bloom variant. */
export function Anamorphic({threshold=.9,scale=3,...rest}:{threshold?:number;scale?:number}&O){return <Effect type="anamorphic" params={{threshold,scale}} {...rest}/>}
