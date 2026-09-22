import type { ParameterDefinition } from '@artinos/runtime'
const labels:Record<string,string>={'adaptiveRoom':'Adaptive Room','adaptive-room':'Adaptive Room','pcf-soft':'PCF Soft','linear-srgb':'Linear sRGB','exp2':'Exponential'}
const opt=(values:string[])=>values.map(value=>({label:labels[value]??value.replace(/[-_]/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase()),value}))
const num=(id:string,label:string,defaultValue:number,min:number,max:number,step:number,group:string,extra:Partial<ParameterDefinition>={})=>({id,label,type:'number',defaultValue,min,max,step,group,...extra} as ParameterDefinition)
const bool=(id:string,label:string,defaultValue:boolean,group:string,extra:Partial<ParameterDefinition>={})=>({id,label,type:'boolean',defaultValue,group,...extra} as ParameterDefinition)
const enm=(id:string,label:string,defaultValue:string,values:string[],group:string,extra:Partial<ParameterDefinition>={})=>({id,label,type:'enum',defaultValue,options:opt(values),group,...extra} as ParameterDefinition)
const color=(id:string,label:string,defaultValue:string,group:string,extra:Partial<ParameterDefinition>={})=>({id,label,type:'color',defaultValue,group,...extra} as ParameterDefinition)
const vec3=(id:string,label:string,defaultValue:[number,number,number],group:string,extra:Partial<ParameterDefinition>={})=>({id,label,type:'vec3',defaultValue,group,...extra} as ParameterDefinition)
export const defs={
 scenePreset:enm('scene.preset','Scene Preset','studio',['blank','clean','neutral','studio','softbox','product','portrait','warehouse','gallery','adaptiveRoom','outdoor','sunset','night','cinematic'],'Scene',{order:0}),
 environment:enm('scene.environment','Environment','studio',['blank','clean','neutral','studio','softbox','warehouse','gallery','adaptive-room','hdr','sky','outdoor','sunset','night'],'Environment',{order:0}),
 environmentIntensity:num('scene.environment.intensity','Environment Intensity',1,0,4,.01,'Environment',{modulatable:true}),
 environmentBlur:num('scene.environment.blur','Background Blur',.12,0,1,.01,'Environment'),
 environmentRotation:num('scene.environment.rotation','Environment Rotation',0,-3.1416,3.1416,.01,'Environment',{unit:'rad'}),
 hdr:{id:'scene.environment.hdr',label:'Custom HDR / EXR URL',type:'string',defaultValue:'',group:'Environment',advanced:true} as ParameterDefinition,
 backgroundMode:enm('scene.background.mode','Background','environment',['environment','color','transparent'],'Environment'),
 backgroundColor:color('scene.background.color','Background Color','#17191b','Environment'),
 ground:bool('scene.ground.enabled','Ground',true,'Environment'),
 groundColor:color('scene.ground.color','Ground Color','#777876','Environment'),
 groundY:num('scene.ground.y','Ground Y',-1.15,-10,10,.01,'Environment'),
 cameraMode:enm('camera.mode','Camera Type','perspective',['perspective','orthographic'],'Camera'),
 cameraPreset:enm('camera.preset','View','product',['front','back','top','bottom','left','right','isometric','product','portrait','wide','cinematic','macro'],'Camera'),
 cameraTarget:vec3('camera.target','Target',[0,.2,0],'Camera',{automatable:true}),cameraLensPreset:enm('camera.lensPreset','Lens Preset','standard',['ultra-wide','wide','standard','portrait','telephoto','macro','custom'],'Camera'),
 fov:num('camera.fov','FOV',45,10,120,1,'Camera',{automatable:true,unit:'°'}),
 lens:num('camera.lens','Lens',0,0,200,1,'Camera',{description:'0 uses FOV; otherwise focal length in mm',unit:'mm',advanced:true}),
 filmGauge:num('camera.filmGauge','Film Gauge',36,8,70,.1,'Camera',{unit:'mm',advanced:true}),
 cameraZoom:num('camera.zoom','Orthographic Zoom',80,1,300,1,'Camera',{advanced:true}),
 cameraNear:num('camera.near','Near Clip',.01,.001,10,.001,'Camera',{advanced:true}),
 cameraFar:num('camera.far','Far Clip',1000,10,10000,10,'Camera',{advanced:true}),
 cameraFit:bool('camera.fit','Fit Content',false,'Camera'),cameraFitMargin:num('camera.fitMargin','Fit Margin',1.25,1,3,.05,'Camera'),cameraTransition:num('camera.transition','Transition Speed',8,0,24,.25,'Camera'),cameraUpdateRate:num('camera.updateRate','Fit Updates',4,1,30,1,'Camera',{unit:'Hz',advanced:true}),viewLayout:enm('camera.viewLayout','View Layout','single',['single','split-horizontal','split-vertical','quad'],'Camera',{advanced:true}),
 controls:enm('camera.controls','Controls','orbit',['none','orbit','map','trackball','fly','camera','pointer-lock'],'Controls'),
 controlDamping:bool('camera.controls.damping','Damping',true,'Controls'),
 controlDampingFactor:num('camera.controls.dampingFactor','Damping Factor',.08,0,.5,.005,'Controls'),
 autoRotate:bool('camera.controls.autoRotate','Auto Rotate',false,'Controls'),
 autoRotateSpeed:num('camera.controls.autoRotateSpeed','Auto Rotate Speed',2,-10,10,.1,'Controls'),
 minDistance:num('camera.controls.minDistance','Min Distance',0,0,100,.1,'Controls',{advanced:true}),
 maxDistance:num('camera.controls.maxDistance','Max Distance',1000,.1,10000,1,'Controls',{advanced:true}),
 enablePan:bool('camera.controls.enablePan','Pan',true,'Controls'),enableZoom:bool('camera.controls.enableZoom','Zoom',true,'Controls'),enableRotate:bool('camera.controls.enableRotate','Rotate',true,'Controls'),
 lighting:enm('scene.lighting','Lighting','studio',['none','neutral','studio','softbox','product','portrait','dramatic','cinematic','sun','night'],'Lighting'),
 lightIntensity:num('scene.lighting.intensity','Master Intensity',1,0,4,.01,'Lighting',{modulatable:true}),
 lightKey:num('scene.lighting.key','Key',1,0,4,.01,'Lighting',{modulatable:true}),lightFill:num('scene.lighting.fill','Fill',1,0,4,.01,'Lighting',{modulatable:true}),lightRim:num('scene.lighting.rim','Rim',1,0,4,.01,'Lighting',{modulatable:true}),
 lightTemperature:num('scene.lighting.temperature','Temperature',5600,2000,12000,50,'Lighting',{unit:'K'}),lightColor:color('scene.lighting.color','Override Color','#ffffff','Lighting',{advanced:true}),
 lightShadowMap:num('scene.lighting.shadowMapSize','Light Shadow Map',2048,256,8192,256,'Lighting',{advanced:true}),
 customLights:{id:'scene.lighting.custom',label:'Custom Lights',type:'string',defaultValue:'[]',group:'Lighting',advanced:true,persist:true} as ParameterDefinition,
 shadows:enm('scene.shadows','Shadows','studio',['off','hard','soft','contact','studio','cinematic'],'Shadows'),shadowOpacity:num('scene.shadows.opacity','Shadow Opacity',.45,0,1,.01,'Shadows'),shadowBlur:num('scene.shadows.blur','Shadow Softness',2.5,.1,10,.1,'Shadows'),shadowSize:num('scene.shadows.size','Shadow Size',12,1,100,.5,'Shadows'),shadowFar:num('scene.shadows.far','Shadow Spread',5,.1,100,.5,'Shadows',{advanced:true}),shadowSamples:num('scene.shadows.samples','Shadow Detail',12,1,64,1,'Shadows',{advanced:true}),shadowFocus:num('scene.shadows.focus','Shadow Focus',.35,0,1,.01,'Shadows',{advanced:true}),shadowColor:color('scene.shadows.color','Shadow Color','#000000','Shadows',{advanced:true}),
 fog:enm('scene.fog','Fog','off',['off','linear','exp2'],'Scene'),fogColor:color('scene.fog.color','Fog Color','#8b8e92','Scene'),fogNear:num('scene.fog.near','Fog Near',10,0,500,.5,'Scene',{advanced:true}),fogFar:num('scene.fog.far','Fog Far',60,.1,2000,1,'Scene',{advanced:true}),fogDensity:num('scene.fog.density','Fog Density',.02,0,.2,.001,'Scene',{advanced:true}),
 grid:bool('scene.grid','Ground Grid',false,'Scene'),gridSize:num('scene.grid.size','Grid Size',20,1,200,1,'Scene',{advanced:true}),gridDivisions:num('scene.grid.divisions','Grid Divisions',20,2,200,1,'Scene',{advanced:true}),gridColor:color('scene.grid.color','Grid Color','#858585','Scene',{advanced:true}),gridSectionColor:color('scene.grid.sectionColor','Section Color','#a0a0a0','Scene',{advanced:true}),gridFade:num('scene.grid.fade','Grid Fade Distance',25,1,200,1,'Scene',{advanced:true}),
 renderPreset:enm('render.preset','Render Preset','high',['fast','mobile','balanced','high','ultra','cinematic','product','interactive','installation','screenshot'],'Render'),shadowMap:enm('render.shadowMap','Shadow Map','pcf-soft',['basic','pcf','pcf-soft','vsm'],'Render'),toneMapping:enm('render.toneMapping','Tone Mapping','agx',['none','linear','reinhard','cineon','aces','agx','neutral'],'Render'),outputColorSpace:enm('render.outputColorSpace','Output Color Space','srgb',['srgb','linear-srgb'],'Render',{advanced:true}),exposure:num('render.exposure','Exposure',1,.05,5,.01,'Render',{modulatable:true}),clearAlpha:num('render.clearAlpha','Clear Alpha',1,0,1,.01,'Render',{advanced:true}),
 postfxEnabled:bool('postfx.enabled','PostFX Pipeline',true,'PostFX'),
} as const
