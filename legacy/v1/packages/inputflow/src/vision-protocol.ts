export type VisionFeature='hands'|'face'|'pose'|'gestures'|'objects'
export type Landmark=[number,number,number,number?]
export interface VisionHand{landmarks:Landmark[];world?:Landmark[];handedness:string}
export interface VisionFrameResult{frameId:number;timestamp:number;inferenceMs:number;hands:VisionHand[];faces:Landmark[][];poses:Landmark[][];objects:Array<{label:string;score:number;box?:[number,number,number,number]}>;gestures:Array<{name:string;score:number;handedness?:string}>}
export type VisionWorkerRequest={type:'init';wasmPath:string;features:VisionFeature[];models:Partial<Record<VisionFeature,string>>}|{type:'frame';frameId:number;timestamp:number;bitmap:ImageBitmap}|{type:'dispose'}
export type VisionWorkerResponse={type:'ready'}|{type:'disposed'}|{type:'result';result:VisionFrameResult}|{type:'error';message:string;frameId?:number}
