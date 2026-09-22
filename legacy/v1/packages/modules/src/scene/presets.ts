import type { EnvironmentPreset } from './Environment';import type { LightingPreset } from './Lighting';import type { ShadowPreset } from './Shadows';import type { CameraPreset } from './Camera';import type { RenderPreset,ToneMappingName } from './RenderSettings'
export interface ScenePreset{environment:EnvironmentPreset;environmentIntensity:number;lighting:LightingPreset;lightIntensity:number;shadows:ShadowPreset;cameraPreset:CameraPreset;exposure:number;renderPreset:RenderPreset;toneMapping:ToneMappingName;fog:'off'|'linear'|'exp2';grid:boolean}
export const scenePresets:Record<string,ScenePreset>={
 blank:{environment:'blank',environmentIntensity:0,lighting:'none',lightIntensity:0,shadows:'off',cameraPreset:'product',exposure:1,renderPreset:'balanced',toneMapping:'agx',fog:'off',grid:false},
 clean:{environment:'clean',environmentIntensity:.6,lighting:'neutral',lightIntensity:1,shadows:'contact',cameraPreset:'product',exposure:1,renderPreset:'high',toneMapping:'agx',fog:'off',grid:false},
 neutral:{environment:'neutral',environmentIntensity:1,lighting:'neutral',lightIntensity:1,shadows:'soft',cameraPreset:'product',exposure:1,renderPreset:'high',toneMapping:'agx',fog:'off',grid:false},
 studio:{environment:'studio',environmentIntensity:1,lighting:'studio',lightIntensity:1,shadows:'studio',cameraPreset:'product',exposure:1,renderPreset:'high',toneMapping:'agx',fog:'off',grid:false},
 softbox:{environment:'softbox',environmentIntensity:1.15,lighting:'softbox',lightIntensity:1,shadows:'studio',cameraPreset:'product',exposure:1.05,renderPreset:'high',toneMapping:'agx',fog:'off',grid:false},
 product:{environment:'studio',environmentIntensity:1.1,lighting:'product',lightIntensity:1.05,shadows:'contact',cameraPreset:'product',exposure:1.05,renderPreset:'ultra',toneMapping:'agx',fog:'off',grid:false},
 portrait:{environment:'studio',environmentIntensity:.9,lighting:'portrait',lightIntensity:1,shadows:'soft',cameraPreset:'portrait',exposure:1.05,renderPreset:'high',toneMapping:'agx',fog:'off',grid:false},
 warehouse:{environment:'warehouse',environmentIntensity:.85,lighting:'neutral',lightIntensity:.9,shadows:'soft',cameraPreset:'wide',exposure:.95,renderPreset:'balanced',toneMapping:'agx',fog:'linear',grid:false},
 gallery:{environment:'gallery',environmentIntensity:1,lighting:'product',lightIntensity:.8,shadows:'contact',cameraPreset:'product',exposure:1,renderPreset:'high',toneMapping:'neutral',fog:'off',grid:false},
 adaptiveRoom:{environment:'adaptive-room',environmentIntensity:1,lighting:'softbox',lightIntensity:.9,shadows:'studio',cameraPreset:'product',exposure:1,renderPreset:'high',toneMapping:'agx',fog:'off',grid:false},
 outdoor:{environment:'outdoor',environmentIntensity:1,lighting:'sun',lightIntensity:1,shadows:'soft',cameraPreset:'wide',exposure:1,renderPreset:'balanced',toneMapping:'agx',fog:'linear',grid:false},
 sunset:{environment:'sunset',environmentIntensity:1,lighting:'sun',lightIntensity:.7,shadows:'soft',cameraPreset:'cinematic',exposure:.9,renderPreset:'cinematic',toneMapping:'agx',fog:'linear',grid:false},
 night:{environment:'night',environmentIntensity:.65,lighting:'night',lightIntensity:1,shadows:'off',cameraPreset:'cinematic',exposure:.8,renderPreset:'high',toneMapping:'agx',fog:'exp2',grid:false},
 cinematic:{environment:'studio',environmentIntensity:.8,lighting:'cinematic',lightIntensity:1,shadows:'cinematic',cameraPreset:'cinematic',exposure:.9,renderPreset:'cinematic',toneMapping:'agx',fog:'off',grid:false},
}
