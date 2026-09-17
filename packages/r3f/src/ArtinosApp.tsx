import { Component, Suspense, useMemo, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react'
import { InputProvider } from '@artinos/inputflow'
import { ArtinosCanvas, ArtinosRuntimeProvider, createArtinosRuntime, useResource } from '@artinos/runtime'
import { MinimalShell, StudioShell } from './studio'
import { ProjectRuntime } from './ProjectRuntime'
import { RuntimeEssentials } from './RuntimeEssentials'
import { RuntimeStage } from './RuntimeStage'
import type { ArtinosProject } from './project'

export function ArtinosApp({project}:{project:ArtinosProject}){
  const runtime=useMemo(()=>createArtinosRuntime(),[project.id])
  const renderer=project.renderer??{}
  const Content=project.Content,Overlay=project.Overlay
  const viewport=<ArtinosCanvas backend={renderer.backend??'auto'} dpr={renderer.dpr??[.75,2]} shadows={renderer.shadows??true} postfx={renderer.postfx??true} alpha={renderer.alpha??false} antialias={renderer.antialias??false} powerPreference={renderer.powerPreference??'high-performance'} threeInspector={renderer.threeInspector??true} threeInspectorVisible={renderer.threeInspectorVisible??false}><ProjectRuntime project={project}/><RuntimeEssentials telemetry={project.telemetry} adaptiveQuality={project.adaptiveQuality}/><RuntimeStage stage={project.stage}><Suspense fallback={project.loading??null}><Content/></Suspense></RuntimeStage></ArtinosCanvas>
  // MetaBlock is the studio's docking core; `shell:'panels'` opts back into the static edge docks.
  const workspace=project.shell==='minimal'?<MinimalShell viewport={viewport}/>:<StudioShell viewport={viewport} variant={project.shell==='panels'?'panels':'metablock'}/>
  return <ArtinosErrorBoundary key={project.id}><ArtinosRuntimeProvider runtime={runtime}><InputProvider><StartupGate>{workspace}{Overlay&&<Overlay/>}</StartupGate></InputProvider></ArtinosRuntimeProvider></ArtinosErrorBoundary>
}

function StartupGate({children}:PropsWithChildren){const ready=useResource<boolean>('runtime.ready')===true;return <>{children}{!ready&&<div className="artinos-startup" role="status"><b>ARTINOS</b><span>Starting ARTINOS</span></div>}</>}
export class ArtinosErrorBoundary extends Component<PropsWithChildren,{error:Error|null}>{state:{error:Error|null}={error:null};static getDerivedStateFromError(error:Error){return{error}}componentDidCatch(error:Error,info:ErrorInfo){document.documentElement.dataset.artinosError='true';console.error('[ARTINOS] render tree failed',error,info.componentStack)}componentWillUnmount(){delete document.documentElement.dataset.artinosError}render():ReactNode{return this.state.error?<main className="artinos-startup-error" data-artinos-error><small>ARTINOS ERROR</small><h1>ARTINOS encountered an unexpected error.</h1><p>{this.state.error.message}</p><button onClick={()=>location.reload()}>Reload ARTINOS</button></main>:this.props.children}}
