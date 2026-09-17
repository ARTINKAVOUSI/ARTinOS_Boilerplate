import type { ReactNode } from 'react'
import { Panel, RuntimeHUD } from '../foundation'
import { Workspace } from '@artinos/ui'
import { ScenePanel } from './ScenePanel'
import { InputPanel } from './InputPanel'
import { PostFXPanel } from './PostFXPanel'

export function MinimalShell({viewport}:{viewport:ReactNode}){
  return (
    <Workspace persistKey="artinos.minimal">
      <div className="artinos-minimal">
        {viewport}
        <RuntimeHUD/>
        <div className="artinos-mini-panel">
          <Panel title="ARTINOS" dock="float">
            <ScenePanel/>
            <PostFXPanel/>
            <InputPanel/>
          </Panel>
        </div>
      </div>
    </Workspace>
  )
}
