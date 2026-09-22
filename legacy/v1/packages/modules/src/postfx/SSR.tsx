import { Effect, type EffectProps } from './effect'
export function SSR(props:EffectProps){return <Effect type="ssr" {...props}/>}
