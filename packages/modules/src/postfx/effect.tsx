import { usePostFX, type PostFXEffect, type PostFXType } from '@artinos/runtime'
import { postFXCatalog } from './catalog'
export type EffectProps={ id?:string; enabled?:boolean; order?:number; params?:Record<string,number|boolean> }
export function Effect({ type, id=type, enabled=true, order=500, params={} }:{type:PostFXType}&EffectProps){const capability=postFXCatalog.find(entry=>entry.type===type);usePostFX({id,type,enabled,order,params,resources:capability?.resources,minTier:capability?.quality.minTier,fallback:capability?.fallback,supportedBackend:capability?.backend});return null}
export type { PostFXEffect, PostFXType }
