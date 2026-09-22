import { useState } from 'react'
import {
  Accordion,
  AssetField,
  Button,
  Combobox,
  ContextMenu,
  Dialog,
  Drawer,
  DropZone,
  Field,
  FileField,
  Highlight,
  KeyCapture,
  ListBrowser,
  Menu,
  Pane,
  Popover,
  PropertyRow,
  RadioGroup,
  Section,
  SelectionList,
  Slider,
  Stack,
  StatusDot,
  Toggle,
  Toolbar,
  Tooltip,
  VirtualList,
  VirtualTable,
  type AssetReference,
} from '../../primitives'

const MODULES = Array.from({ length: 120 }, (_, index) => ({
  id: `module-${index}`,
  name: ['postfx.bloom', 'scene.environment', 'input.pointer', 'graph.runtime', 'render.pipeline'][index % 5] + `.${index}`,
  kind: ['headless', 'visual', 'signal'][index % 3],
}))

const OBJECTS = [
  { id: 'glass', label: 'Glass panel', meta: 'MESH / 01' },
  { id: 'light', label: 'Area light', meta: 'LIGHT / 02' },
  { id: 'camera', label: 'Studio camera', meta: 'CAM / 03' },
]

/** Composition — how the pieces sit together: panes, rows, lists, floating layers. */
export function Composition() {
  const [selected, setSelected] = useState('glass')
  const [shading, setShading] = useState('solid')
  const [space, setSpace] = useState<string | undefined>('acescg')
  const [dialog, setDialog] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [shortcut, setShortcut] = useState('Meta+R')
  const [asset, setAsset] = useState<AssetReference | null>(null)
  const [exposure, setExposure] = useState(1.2)
  const [files, setFiles] = useState<string[]>([])

  return (
    <>
      <p className="ui-studio-lead">
        <b>A pane is the unit of surface.</b> Its head names it, its body holds rows, its foot says what it is bound to.
        Floating layers — menus, popovers, dialogs — are the same glass with a tighter blur.
      </p>

      <Pane index={1} title="Pane variants" meta="MATERIAL" className="ui-studio-wide">
        <div className="ui-studio-surfaces">
          <Pane title="Default" meta="PANE"><Slider label="Exposure" value={exposure} min={-3} max={3} step={0.1} unit="EV" onChange={setExposure} /></Pane>
          <Pane title="Command" meta="CENTER" variant="command"><Slider label="Exposure" value={exposure} min={-3} max={3} step={0.1} unit="EV" onChange={setExposure} /></Pane>
          <Pane title="Material" meta="DENSE" variant="material"><Slider label="Exposure" value={exposure} min={-3} max={3} step={0.1} unit="EV" layout="inline" onChange={setExposure} /></Pane>
          <Pane title="Light" meta="LIT" variant="light"><Slider label="Exposure" value={exposure} min={-3} max={3} step={0.1} unit="EV" onChange={setExposure} /></Pane>
        </div>
      </Pane>

      <Pane index={2} title="Property rows" meta="INSPECTOR" footer={<><StatusDot>Ready</StatusDot><span>LOCAL / SHARED VALUES</span></>}>
        <Section title="Material" description="4 parameters">
          <Stack>
            <PropertyRow label="Exposure" unit="EV">
              <Slider label="Exposure" value={exposure} min={-3} max={3} step={0.1} unit="EV" onChange={setExposure} />
            </PropertyRow>
            <PropertyRow label="Transmission" binding="MIDI 21" status="bound" onReset={() => {}}>
              <Slider label="Transmission" value={72} min={0} max={100} step={1} unit="%" binding="MIDI 21" status="bound" onChange={() => {}} />
            </PropertyRow>
            <PropertyRow label="Thickness" status="fault" message="Value is outside the printable range.">
              <Slider label="Thickness" value={9.4} min={0} max={10} step={0.1} unit="mm" status="fault" onChange={() => {}} />
            </PropertyRow>
          </Stack>
        </Section>
      </Pane>

      <Pane index={3} title="Selection and choice" meta="COLLECTIONS">
        <SelectionList label="Scene selection" items={OBJECTS} value={selected} onChange={setSelected} />
        <RadioGroup
          label="Shading"
          value={shading}
          options={[
            { id: 'solid', label: 'Solid', description: 'Lit preview' },
            { id: 'wire', label: 'Wireframe' },
            { id: 'matcap', label: 'Matcap', description: 'No scene lighting' },
          ]}
          onChange={setShading}
        />
        <Combobox
          label="Colour space"
          value={space}
          options={[
            { id: 'srgb', label: 'Linear sRGB', value: 'srgb' },
            { id: 'p3', label: 'Display P3', value: 'p3' },
            { id: 'acescg', label: 'ACEScg', value: 'acescg' },
          ]}
          onChange={value => setSpace(String(value))}
        />
        <Accordion
          items={[
            { id: 'transform', label: 'Transform', content: <Toggle label="Lock scale" value onChange={() => {}} /> },
            { id: 'render', label: 'Render', content: <Toggle label="Denoise" value onChange={() => {}} /> },
          ]}
          defaultOpen={['transform']}
        />
      </Pane>

      <Pane index={4} title="Long lists" meta="VIRTUALIZED" className="ui-studio-wide">
        <Field label="Browser" asLabel>
          <span style={{ fontSize: 10, color: 'var(--ui-text-meta)' }}>{MODULES.length} modules, fuzzy-ranked</span>
        </Field>
        <div style={{ height: 190 }}>
          <ListBrowser items={MODULES} searchable={module => module.name} itemHeight={26} countLabel="modules" placeholder="Search modules…">
            {(module, match) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', fontSize: 10 }}>
                <span><Highlight text={module.name} ranges={match.ranges} /></span>
                <span style={{ color: 'var(--ui-text-meta)', fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{module.kind}</span>
              </div>
            )}
          </ListBrowser>
        </div>
        <div style={{ height: 150, marginTop: 8 }}>
          <VirtualTable
            items={MODULES.slice(0, 40)}
            rowHeight={24}
            getRowKey={module => module.id}
            columns={[
              { id: 'name', label: 'Module', render: module => module.name },
              { id: 'kind', label: 'Kind', width: 90, render: module => module.kind },
            ]}
          />
        </div>
      </Pane>

      <Pane index={5} title="Floating layers" meta="MENU · DIALOG">
        <Toolbar fill>
          <Popover
            label="Quick settings"
            trigger={<span className="artinos-button">Popover</span>}
            children={
              <Stack>
                <Toggle label="Denoise" value onChange={() => {}} />
                <Slider label="Samples" value={128} min={16} max={512} step={16} onChange={() => {}} />
              </Stack>
            }
          />
          <Tooltip content="Bakes the current frame">
            <span className="artinos-button">Tooltip</span>
          </Tooltip>
        </Toolbar>
        <Toolbar fill>
          <Button onClick={() => setDialog(true)}>Dialog</Button>
          <Button onClick={() => setDrawer(true)}>Drawer</Button>
        </Toolbar>
        <ContextMenu
          items={[
            { id: 'rename', label: 'Rename', shortcut: 'F2', onSelect: () => {} },
            { id: 'duplicate', label: 'Duplicate', shortcut: '⌘D', onSelect: () => {} },
            { id: 'delete', label: 'Delete', danger: true, onSelect: () => {} },
          ]}
        >
          <div style={{ padding: '10px 0', fontSize: 10, color: 'var(--ui-text-meta)' }}>Right-click here for a context menu</div>
        </ContextMenu>
        <Menu
          items={[
            { id: 'open', label: 'Open panel', shortcut: '⌘K', onSelect: () => {} },
            { id: 'reset', label: 'Reset layout', onSelect: () => {} },
            { id: 'close', label: 'Close', danger: true, onSelect: () => {} },
          ]}
        />
        <Dialog
          open={dialog}
          onOpenChange={setDialog}
          title="Reset workspace layout?"
          description="Docked panels and their sizes return to the default arrangement."
          actions={
            <>
              <Button onClick={() => setDialog(false)}>Keep</Button>
              <Button onClick={() => setDialog(false)}>Reset</Button>
            </>
          }
        >
          <Toggle label="Also reset parameters" value={false} onChange={() => {}} />
        </Dialog>
        <Drawer open={drawer} onOpenChange={setDrawer} title="Inspector" description="A drawer is a dialog on an edge.">
          <Slider label="Exposure" value={exposure} min={-3} max={3} step={0.1} unit="EV" onChange={setExposure} />
        </Drawer>
      </Pane>

      <Pane index={6} title="Files and keys" meta="INPUT">
        <FileField label="HDR / EXR" accept=".hdr,.exr" onFiles={list => setFiles(list.map(file => file.name))} />
        <AssetField label="Environment" value={asset} onChange={setAsset} />
        <KeyCapture label="Re-render" value={shortcut} onChange={setShortcut} />
        <DropZone onFiles={list => setFiles(list.map(file => file.name))}>Drop an environment map</DropZone>
        {files.length > 0 && (
          <Field label="Received" asLabel>
            <span style={{ fontSize: 10, color: 'var(--ui-text-meta)' }}>{files.join(', ')}</span>
          </Field>
        )}
      </Pane>

      <Pane index={7} title="The reference page" meta="PATTERN" footer={<><span>UI PROTOTYPES/workbench.html</span><span>MEASURED PARITY</span></>}>
        <p style={{ margin: 0, fontSize: 10, lineHeight: 1.6, color: 'var(--ui-note)' }}>
          The workbench is rebuilt from these components and measured against the original — ten panes, 47 rows, every
          box within a pixel. It opens as its own page.
        </p>
        <Toolbar>
          <Button onClick={() => { location.search = '?workbench' }}>Open the workbench</Button>
        </Toolbar>
      </Pane>
    </>
  )
}
