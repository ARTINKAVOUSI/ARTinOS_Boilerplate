import { useMemo, useState, type ReactNode } from 'react'
import { Activity, Boxes, Bug, Clock3, FolderOpen, Hand, Mountain, Share2, Sliders, Terminal, Wand2 } from 'lucide-react'
import {
  ConsolePanel,
  definePanel,
  MetaBlockShell,
  ModulesPanel,
  PanelWorkspace,
  ParametersPanel,
  RuntimeHUD,
  SignalsPanel,
  ThreeInspectorPanel,
  useRuntimeCommands,
  useTelemetry,
} from '../foundation'
import { GraphPanel } from './GraphPanel'
import { InputPanel } from './InputPanel'
import { InteractionPanel } from './InteractionPanel'
import { PostFXPanel } from './PostFXPanel'
import { ScenePanel } from './ScenePanel'
import { TimelinePanel } from './TimelinePanel'
import { AssetBrowserPanel } from './AssetBrowserPanel'
import { ConsoleToast } from './ConsoleToast'
import { ComponentDevToolsPanel } from '../devtools/ComponentDevToolsPanel'
import { PanelWorkbench } from '@artinos/ui'
import { Tabs } from '@artinos/ui'
import { TelemetryPanel } from './TelemetryPanel'
import { ResourcesPanel } from './ResourcesPanel'

const INPUT_VIEWS = [
  { id: 'devices', label: 'Devices', View: InputPanel },
  { id: 'signals', label: 'Signals', View: SignalsPanel },
  { id: 'logic', label: 'Actions', View: InteractionPanel },
]

/**
 * The PostFX footer used to be the literal string 'WEBGPU · ACESCG', which misreported the
 * backend on every machine that falls back — the pipeline runs WebGL2 whenever WebGPU has no
 * adapter. Read the live renderer instead so the label can never contradict the HUD.
 */
function PostFXFooter() {
  const metrics = useTelemetry()
  const read = (id: string) => metrics.find(metric => metric.id === id)?.value
  const backend = String(read('renderer.backend') ?? 'GPU').toUpperCase()
  const colorSpace = String(read('renderer.outputColorSpace') ?? 'ACESCG').toUpperCase()
  return <>{backend} · {colorSpace}</>
}

function InputFlowWorkspace() {
  const [view, setView] = useState('devices')
  const View = INPUT_VIEWS.find(entry => entry.id === view)?.View ?? InputPanel
  return (
    <div className="artinos-inputflow-workspace">
      <Tabs value={view} onChange={setView} items={INPUT_VIEWS} />
      <div className="artinos-inputflow-content">
        <View />
      </div>
    </div>
  )
}

function TelemetryWorkspace() {
  const [view, setView] = useState('overview')
  return <><Tabs value={view} onChange={setView} items={[{ id: 'overview', label: 'Performance overview' }, { id: 'resources', label: 'Resources' }, { id: 'renderer', label: 'Renderer inspector' }]} />{view === 'overview' ? <TelemetryPanel /> : view === 'resources' ? <ResourcesPanel /> : <ThreeInspectorPanel />}</>
}

/**
 * Full editor workspace: docked panels, rail, toolbar, HUD and command palette.
 *
 * MetaBlock is the docking core: every panel is a MetaBlock, every dock a MetaBlock group, so
 * panels can be dragged between docks, torn off as floating windows, split, tabbed, pinned,
 * auto-hidden and returned home. `variant: 'panels'` keeps the original static edge-dock shell
 * available as a fallback. Both read the identical `PanelDefinition[]`, so a panel never needs
 * to know which one is mounted.
 */
export function StudioShell({ viewport, variant = 'metablock' }: { viewport: ReactNode; variant?: 'panels' | 'metablock' }) {
  useRuntimeCommands()

  const panels = useMemo(
    () => [
      definePanel({
        id: 'inspector',
        footer: 'PROJECT · PARAMETERS',
        title: 'Inspector',
        icon: Sliders,
        description: 'Project parameters exposed by the current project',
        keywords: ['parameters', 'controls', 'properties'],
        dock: 'bottom',
        size: 360,
        order: 0,
        content: (
          <div className="artinos-panel-suite artinos-inspector-suite">
            <div className="artinos-suite-content">
              <ParametersPanel projectOnly />
            </div>
          </div>
        ),
      }),
      definePanel({
        id: 'scene',
        footer: 'ENVIRONMENT · CAMERA · LIGHTING',
        title: 'Scene',
        icon: Mountain,
        description: 'Environment, camera, lighting, shadows and render settings',
        keywords: ['environment', 'camera', 'lighting', 'shadows', 'render'],
        dock: 'bottom',
        size: 720,
        order: 1,
        content: <ScenePanel />,
      }),
      definePanel({
        id: 'postfx',
        footer: <PostFXFooter />,
        title: 'PostFX',
        icon: Wand2,
        description: 'Post-processing stack and per-effect controls',
        keywords: ['bloom', 'effects', 'post', 'grading'],
        dock: 'bottom',
        size: 520,
        order: 2,
        visible: false,
        content: <PostFXPanel />,
      }),
      definePanel({
        id: 'inputflow',
        title: 'InputFlow',
        icon: Hand,
        description: 'Devices, live signals and semantic actions',
        keywords: ['devices', 'pointer', 'vision', 'gesture', 'signals'],
        dock: 'bottom',
        size: 600,
        order: 3,
        visible: false,
        content: <InputFlowWorkspace />,
      }),
      // The node editor needs room to pan and wire, so it is its own panel rather than a tab.
      definePanel({
        id: 'graph',
        footer: 'SIGNAL GRAPH',
        title: 'Graph',
        icon: Share2,
        description: 'Node editor over the runtime graph',
        keywords: ['nodes', 'wiring', 'editor'],
        dock: 'bottom',
        size: 820,
        order: 4,
        visible: false,
        content: <GraphPanel />,
      }),
      definePanel({
        id: 'timeline', title: 'Timeline', icon: Clock3, description: 'Automation tracks and keyframes', keywords: ['animation', 'automation', 'keyframes'], dock: 'bottom', size: 720, order: 5, visible: false, content: <TimelinePanel />,
      }),
      definePanel({
        id: 'assets', title: 'Assets', icon: FolderOpen, description: 'Imported creative assets', keywords: ['files', 'images', 'models', 'hdri'], dock: 'bottom', size: 520, order: 6, visible: false, content: <AssetBrowserPanel />,
      }),
      definePanel({
        id: 'library',
        title: 'Library',
        icon: Boxes,
        description: 'Every reusable module, searchable with its canonical import',
        keywords: ['modules', 'catalog', 'registry', 'import'],
        dock: 'bottom',
        size: 460,
        order: 7,
        visible: false,
        content: <ModulesPanel />,
      }),
      definePanel({
        id: 'console',
        footer: 'RUNTIME LOG',
        title: 'Console',
        icon: Terminal,
        description: 'Runtime log output',
        keywords: ['logs', 'errors', 'warnings', 'output'],
        dock: 'bottom',
        size: 480,
        order: 8,
        visible: false,
        content: <ConsolePanel />,
      }),
      definePanel({
        id: 'component-devtools', title: 'UI DevTools', icon: Bug, description: 'Inspect component anatomy, state, parameters, tokens and accessibility', keywords: ['components', 'tokens', 'a11y', 'state'], dock: 'bottom', size: 680, order: 10, visible: false, content: <ComponentDevToolsPanel />,
      }),
      definePanel({
        id: 'telemetry',
        footer: 'RUNTIME · LIVE',
        title: 'Telemetry',
        icon: Activity,
        description: 'Renderer inspector, frame profile and memory',
        keywords: ['performance', 'profiler', 'memory', 'inspector'],
        dock: 'bottom',
        size: 560,
        order: 11,
        visible: false,
        content: (
          <div className="artinos-panel-suite artinos-telemetry-suite">
            <div className="artinos-suite-content">
              <TelemetryWorkspace />
            </div>
          </div>
        ),
      }),
    ].map(panel => ({ ...panel, content: <PanelWorkbench title={panel.title}>{panel.content}</PanelWorkbench> })),
    [],
  )

  // `?dock=metablock` / `?dock=panels` overrides the project's choice so both engines can be
  // compared against the same running scene without editing project source.
  const override = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('dock')
  const engine = override === 'metablock' || override === 'panels' ? override : variant

  return engine === 'metablock'
    ? <MetaBlockShell panels={panels} viewport={viewport} persistKey="artinos.studio.metablock-v3" statusOverlay={<ConsoleToast />} />
    : <PanelWorkspace panels={panels} viewport={viewport} persistKey="artinos.studio.panels-v5" statusOverlay={<ConsoleToast />} toolbarStatus={<RuntimeHUD embedded />} />
}
