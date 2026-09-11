import { Effect, type EffectProps } from './effect'
export function Bleach(props:EffectProps & {opacity?:number}){const{opacity=.5,params,...rest}=props;return <Effect type="bleach" params={{...params,opacity}} {...rest}/>}
