import { useMemo, useState, useSyncExternalStore } from 'react'
import { File, Image, Music, Video, Box, Trash2 } from 'lucide-react'
import { useArtinosRuntime } from '@artinos/runtime'
import { AssetDropZone, Button, SearchField, Select, Toolbar, type AssetReference } from '@artinos/ui'
import { PanelEmpty } from '@artinos/ui'
interface ImportedAsset { reference: AssetReference; file: File; url: string; dispose(): void }
const kindOf = (asset: ImportedAsset) => asset.file?.type?.split('/')[0] || asset.reference.kind || 'file'
export function AssetBrowserPanel() {
  const runtime = useArtinosRuntime()
  const revision = useSyncExternalStore(callback => runtime.resources.subscribe(callback), () => runtime.resources.revision, () => 0)
  const assets = useMemo(() => runtime.resources.list().filter(record => record.kind === 'asset' && (record.resource as ImportedAsset)?.reference), [runtime, revision])
  const [query, setQuery] = useState(''), [kind, setKind] = useState('all')
  const kinds = [...new Set(assets.map(record => kindOf(record.resource as ImportedAsset)))]
  const visible = assets.filter(record => { const asset = record.resource as ImportedAsset; return (kind === 'all' || kindOf(asset) === kind) && `${asset.reference.label ?? ''} ${record.id}`.toLowerCase().includes(query.toLowerCase()) })
  return <div className="artinos-asset-browser">
    <AssetDropZone onImport={items => items.forEach(({ file, reference }) => {
      const url = URL.createObjectURL(file)
      const asset: ImportedAsset = { reference: { ...reference, uri: url }, file, url, dispose: () => URL.revokeObjectURL(url) }
      runtime.resources.set(`asset.${reference.id}`, asset, { kind: 'asset', owner: 'asset-browser', metadata: reference.metadata })
    })}><strong>Bring your materials into the studio</strong><br />Drop images, audio, video, models or HDRIs here, or choose files.</AssetDropZone>
    <Toolbar><SearchField value={query} onChange={setQuery} placeholder="Search imported assets" /><Select label="Type" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All types' }, ...kinds.map(value => ({ value, label: value }))]} /></Toolbar>
    <div className="artinos-panel-summary"><span>{visible.length} of {assets.length} assets</span><span>Available in this session</span></div>
    {visible.length ? <div className="artinos-asset-grid">{visible.map(record => {
      const asset = record.resource as ImportedAsset, type = kindOf(asset)
      const Icon = type === 'audio' ? Music : type === 'video' ? Video : type === 'image' ? Image : type === 'model' ? Box : File
      return <article className="artinos-asset-card" key={record.id}>
        <div className="artinos-asset-preview">{type === 'image' && asset.url ? <img src={asset.url} alt={asset.reference.label ?? 'Imported image'} loading="lazy" /> : <Icon size={30} strokeWidth={1.25} />}</div>
        <b title={asset.reference.label}>{asset.reference.label ?? record.id}</b><small>{type.toUpperCase()}{asset.file ? ` · ${formatBytes(asset.file.size)}` : ''}</small>
        <Button title={`Remove ${asset.reference.label ?? record.id}`} onClick={() => runtime.resources.delete(record.id, true)}><Trash2 size={12} /> Remove</Button>
      </article>
    })}</div> : <PanelEmpty title={assets.length ? 'No matching assets' : 'Your asset library starts here'} description={assets.length ? 'Try a different search or file type.' : 'Import a file above to see its preview, type and size.'} />}
  </div>
}
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
