import { useMemo, useState } from 'react'
import { Button, Highlight, ListBrowser } from '@artinos/ui'
import { useModules } from '../hooks'

const ROW_HEIGHT = 106

function unique(values: string[]): string[] {
  return ['all', ...new Set(values)]
}

export function ModulesPanel() {
  const modules = useModules()
  const [runtime, setRuntime] = useState('all')
  const [provider, setProvider] = useState('all')
  const [category, setCategory] = useState('all')
  const [copied, setCopied] = useState('')
  const [copyError, setCopyError] = useState('')
  const copy = async (id: string, path: string) => {
    try { await navigator.clipboard.writeText(path); setCopied(id); setCopyError('') }
    catch { setCopyError(id) }
  }

  const filtered = useMemo(
    () =>
      modules.filter(
        module =>
          (runtime === 'all' || module.runtime === runtime) &&
          (provider === 'all' || module.provider === provider) &&
          (category === 'all' || module.category.split('/')[0] === category),
      ),
    [modules, runtime, provider, category],
  )

  const filters = [
    { id: 'runtime', label: 'Runtime', options: unique(modules.map(module => module.runtime)), value: runtime, onChange: setRuntime },
    { id: 'provider', label: 'Provider', options: unique(modules.map(module => module.provider)), value: provider, onChange: setProvider },
    { id: 'category', label: 'Category', options: unique(modules.map(module => module.category.split('/')[0])), value: category, onChange: setCategory },
  ]

  return (
    <ListBrowser
      items={filtered}
      itemHeight={ROW_HEIGHT}
      countLabel="reusable capabilities"
      placeholder="Search modules, capabilities, tags…"
      filters={filters}
      searchable={module => `${module.name} ${module.id} ${module.category} ${module.tags?.join(' ') ?? ''} ${module.capabilities?.join(' ') ?? ''}`}
      empty="No module matches these filters"
    >
      {(module, match) => (
        <article className="artinos-module-card">
          <div className="artinos-module-head">
            <b>
              <Highlight text={module.name} ranges={match.ranges} />
            </b>
            <small>
              {module.runtime} · {module.provider}
            </small>
          </div>
          <code>{module.id}</code>
          <small>{module.category}</small>
          <p>{module.description}</p>
          {module.canonicalImport && (
            <div className="artinos-module-import">
              <code>{module.canonicalImport}</code>
              <Button onClick={() => void copy(module.id, module.canonicalImport!)}>{copied === module.id ? 'Copied path' : 'Copy path'}</Button>
            </div>
          )}
          {copyError === module.id && <small role="status">Clipboard unavailable. Select and copy the path above.</small>}
        </article>
      )}
    </ListBrowser>
  )
}
