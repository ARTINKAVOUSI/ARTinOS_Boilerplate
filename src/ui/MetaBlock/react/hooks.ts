import { useCallback, useSyncExternalStore } from 'react';
import type { MetaBlockWorkspace } from '../core/workspace.js';
export function useWorkspaceRevision(workspace:MetaBlockWorkspace){const subscribe=useCallback((listener:()=>void)=>workspace.on('*',()=>listener()),[workspace]);const get=useCallback(()=>workspace.revision,[workspace]);return useSyncExternalStore(subscribe,get,get)}
