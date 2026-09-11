import { Effect, type EffectProps } from './effect'
export function Denoise({id='denoise',enabled=true,order=500}:EffectProps){return <Effect id={id} type="denoise" enabled={enabled} order={order}/>}
