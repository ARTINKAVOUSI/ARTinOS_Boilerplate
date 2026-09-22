import { Effect,type EffectProps as O } from './effect'
export function Posterize({steps=8,...rest}:{steps?:number}&O){return <Effect type="posterize" params={{steps}} {...rest}/>}
