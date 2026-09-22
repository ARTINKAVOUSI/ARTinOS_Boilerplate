import { Effect, type EffectProps as O } from './effect'
export function LUT3D({intensity=1,...rest}:{intensity?:number}&O){return <Effect type="lut3d" params={{intensity}} {...rest}/>}
