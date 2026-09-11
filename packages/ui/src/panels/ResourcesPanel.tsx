import { useMemo, useState } from 'react'
import { KeyValue, SearchField, Section, VirtualList } from '../primitives'
import { useResources } from '../hooks'
import { describeResource } from './format'

const ROW_HEIGHT = 26

export function ResourcesPanel() {
  const resources = useResources()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.toLowerCase()
    return resources.filter(entry => entry.id.toLowerCase().includes(needle))
  }, [resources, query])

  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder="Search resources" />
      <Section title="Runtime Resources" description={`${filtered.length} registered`}>
        <VirtualList items={filtered} itemHeight={ROW_HEIGHT} empty="No resources registered">
          {entry => <KeyValue label={entry.id} value={describeResource(entry.resource)} />}
        </VirtualList>
      </Section>
    </>
  )
}
