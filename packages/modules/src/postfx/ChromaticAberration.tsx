import { Effect, type EffectProps as O } from './effect'
export function ChromaticAberration({strength=.004,...rest}:{strength?:number}&O){return <Effect type="chromaticAberration" params={{strength}} {...rest}/>}
