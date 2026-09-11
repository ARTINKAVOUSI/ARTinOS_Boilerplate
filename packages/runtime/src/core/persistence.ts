import type { ArtinosRuntime } from './runtime'
import type { RuntimeSnapshot, RuntimeSnapshotV1, RuntimeSnapshotV2 } from './types'

export function migrateRuntimeSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshotV2 {
  if (snapshot.version === 2) return snapshot
  const legacy = snapshot as RuntimeSnapshotV1
  return {
    ...legacy,
    version: 2,
    parameters: { ...legacy.parameters },
    metadata: { schema: 'artinos.project.v2', migratedFrom: 1 },
  }
}

export interface PersistenceOptions { key?: string; autosave?: boolean; debounceMs?: number }
export class RuntimePersistence {
  private timer: ReturnType<typeof setTimeout> | null = null
  private unsubscribe: (()=>void) | null = null
  readonly key: string
  constructor(private runtime: ArtinosRuntime, options: PersistenceOptions = {}) {
    this.key = options.key ?? 'artinos.project'
    if (options.autosave !== false && typeof localStorage !== 'undefined') this.enableAutosave(options.debounceMs ?? 350)
  }
  enableAutosave(debounceMs=350){
    this.disableAutosave()
    this.unsubscribe=this.runtime.parameters.subscribeAllBase(()=>{
      if(this.timer)clearTimeout(this.timer)
      this.timer=setTimeout(()=>this.save(),debounceMs)
    })
    return()=>this.disableAutosave()
  }
  disableAutosave(){this.unsubscribe?.();this.unsubscribe=null;if(this.timer)clearTimeout(this.timer);this.timer=null}
  save(key=this.key){if(typeof localStorage==='undefined')return false;try{localStorage.setItem(key,this.export());return true}catch(error){this.runtime.logger.warn('Project autosave failed',{source:'persistence',data:error});return false}}
  load(key=this.key){if(typeof localStorage==='undefined')return false;const raw=localStorage.getItem(key);if(!raw)return false;return this.import(raw)}
  clear(key=this.key){if(typeof localStorage!=='undefined')localStorage.removeItem(key)}
  export(){return JSON.stringify(this.runtime.snapshot(),null,2)}
  import(raw:string|RuntimeSnapshot){try{const parsed=(typeof raw==='string'?JSON.parse(raw):raw) as RuntimeSnapshot;if(parsed?.version!==1&&parsed?.version!==2)throw new Error('Unsupported project snapshot version');this.runtime.restore(migrateRuntimeSnapshot(parsed));return true}catch(error){this.runtime.logger.error('Project snapshot import failed',{source:'persistence',data:error});return false}}
  dispose(){this.disableAutosave()}
}
