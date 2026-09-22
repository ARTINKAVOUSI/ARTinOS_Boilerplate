import { useSyncExternalStore } from 'react'
import type { PanelManifest } from '../app/panel'
import { findFeature } from '../app/registry'
import { studio } from '../app/store'
import { FileDrop } from '../ui/FileDrop/FileDrop'
import { Menu, type MenuEntry } from '../ui/Menu/Menu'
import { Button } from '../ui/Button/Button'
import { useToast } from '../ui/Toast/Toast'

interface Asset {
  id: string
  name: string
  size: number
  type: 'image' | 'model' | 'lut' | 'other'
  url: string
}

// Session-only: object URLs die with the page, so the list does too.
let assets: Asset[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const getAssets = () => assets

const kindOf = (file: File): Asset['type'] => {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|avif)$/.test(name)) return 'image'
  if (/\.(glb|gltf)$/.test(name)) return 'model'
  if (name.endsWith('.cube')) return 'lut'
  return 'other'
}
const bytes = (size: number) => (size > 1e6 ? `${(size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1e3))} kB`)

/** Where an asset can be applied: feature id, control key, and whether to switch the feature on. */
const USES: Record<Asset['type'], Array<{ label: string; feature: string; key: string }>> = {
  image: [
    { label: 'Use as backdrop', feature: 'scene.backdrop', key: 'url' },
    { label: 'Use as environment', feature: 'scene.environment', key: 'image' },
    { label: 'Use as transition target', feature: 'effect.transition', key: 'image' },
  ],
  model: [{ label: 'Load as model', feature: 'object.model', key: 'url' }],
  lut: [{ label: 'Use as color grade', feature: 'effect.lut3d', key: 'url' }],
  other: [],
}

function AssetCard({ asset }: { asset: Asset }) {
  const toast = useToast()
  const uses = USES[asset.type].filter(use => findFeature(use.feature))
  const items: MenuEntry[] = [
    ...uses.map(use => ({
      id: use.label,
      label: use.label,
      onSelect: () => {
        studio.setValue(use.feature, use.key, asset.url)
        if (use.feature === 'scene.environment') studio.setValue(use.feature, 'preset', 'image')
        studio.setEnabled(use.feature, true)
        toast({ tone: 'success', title: use.label, description: asset.name })
      },
    })),
    ...(uses.length ? ([{ type: 'separator' }] as MenuEntry[]) : []),
    {
      id: 'remove',
      label: 'Remove',
      danger: true,
      onSelect: () => {
        URL.revokeObjectURL(asset.url)
        assets = assets.filter(item => item.id !== asset.id)
        emit()
      },
    },
  ]
  return (
    <article className="artinos-asset-card">
      <div className="artinos-asset-preview">{asset.type === 'image' ? <img src={asset.url} alt="" /> : <span>{asset.type.toUpperCase()}</span>}</div>
      <b title={asset.name}>{asset.name}</b>
      <small>
        {asset.type} · {bytes(asset.size)}
      </small>
      <Menu items={items} trigger={<Button size="sm">Use…</Button>} />
    </article>
  )
}

function Assets() {
  const list = useSyncExternalStore(subscribe, getAssets, getAssets)
  return (
    <div className="artinos-panel-suite">
      <div className="artinos-dropzone">
        <FileDrop
          accept="image/*,.glb,.gltf,.cube"
          title="Drop images, glTF models or .cube LUTs"
          hint="Files stay in this browser session"
          onFiles={files => {
            assets = [...assets, ...files.map(file => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, name: file.name, size: file.size, type: kindOf(file), url: URL.createObjectURL(file) }))]
            emit()
          }}
        />
      </div>
      {list.length === 0 ? (
        <div className="v2-empty">No assets yet. Imported files can become the backdrop, the environment, a model or a color grade.</div>
      ) : (
        <div className="artinos-asset-grid">
          {list.map(asset => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Assets

export const panel: PanelManifest = {
  id: 'assets',
  title: 'Assets',
  description: 'Imported images, models and LUTs',
  keywords: ['files', 'images', 'models', 'hdri', 'lut', 'import'],
  order: 6,
  footer: () => <>SESSION ASSETS</>,
  component: Assets,
}
