import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { fuzzyMatch, useDismiss, workspacePortalTarget } from '../headless'
import { Highlight } from '../primitives'
import { useCommandSources, type CommandItem } from './command-registry'

/** How many results one source may contribute, so a large registry cannot crowd out the rest. */
const PER_GROUP_LIMIT = 6
const RECENTS_KEY = 'artinos.palette.recents'
const RECENTS_MAX = 12

function readRecents(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.slice(0, RECENTS_MAX) : []
  } catch {
    return []
  }
}

function rememberRecent(id: string) {
  try {
    const next = [id, ...readRecents().filter(entry => entry !== id)].slice(0, RECENTS_MAX)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* persistence is a convenience */
  }
}

interface Ranked {
  item: CommandItem
  score: number
  ranges: Array<[number, number]>
}

/**
 * Collects from every registered source, ranks fuzzily across all of them, then regroups.
 *
 * Ranking happens globally and grouping happens after, so a strong match in a small source
 * still outranks a weak match in a large one — the opposite of grouping first and ranking
 * inside each group, which buries the best answer under whichever section sorts first.
 */
function useResults(query: string, open: boolean) {
  const sources = useCommandSources()
  return useMemo(() => {
    if (!open) return []
    const recents = readRecents()
    const ranked: Ranked[] = []

    for (const source of sources) {
      for (const item of source.collect(query)) {
        const haystack = `${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''}`
        const match = fuzzyMatch(haystack, query)
        if (!match) continue
        // Recency is a tiebreaker, never enough to beat a clearly better textual match.
        const recentIndex = recents.indexOf(item.id)
        const boost = recentIndex < 0 ? 0 : (RECENTS_MAX - recentIndex) * 0.4
        const titleMatch = fuzzyMatch(item.title, query)
        ranked.push({
          item,
          score: match.score + boost + (titleMatch ? 4 : 0),
          ranges: titleMatch?.ranges ?? [],
        })
      }
    }

    ranked.sort((a, b) => b.score - a.score)

    const perGroup = new Map<string, number>()
    const kept: Ranked[] = []
    for (const entry of ranked) {
      const used = perGroup.get(entry.item.group) ?? 0
      if (used >= PER_GROUP_LIMIT) continue
      perGroup.set(entry.item.group, used + 1)
      kept.push(entry)
    }

    // Regroup while preserving the global ranking inside each section.
    const groups = new Map<string, Ranked[]>()
    for (const entry of kept) {
      const bucket = groups.get(entry.item.group)
      if (bucket) bucket.push(entry)
      else groups.set(entry.item.group, [entry])
    }
    return [...groups.entries()]
  }, [sources, query, open])
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose(): void }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const groups = useResults(query, open)
  const flat = useMemo(() => groups.flatMap(([, entries]) => entries), [groups])

  useDismiss(surfaceRef, open, onClose)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    inputRef.current?.focus()
  }, [open])

  useEffect(() => setCursor(0), [query])

  if (!open) return null

  const runAt = (index: number) => {
    const entry = flat[index]
    if (!entry) return
    rememberRecent(entry.item.id)
    entry.item.run()
    onClose()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor(index => (index + 1) % Math.max(1, flat.length))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor(index => (index - 1 + flat.length) % Math.max(1, flat.length))
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      runAt(cursor)
    }
  }

  let index = -1
  const surface = (
    <div className="artinos-palette-scrim">
      <div className="artinos-palette" ref={surfaceRef} role="dialog" aria-label="Command palette">
        <div className="artinos-palette-input">
          <Search size={14} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Search panels, parameters, modules, actions…"
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search commands"
          />
          <kbd>esc</kbd>
        </div>

        <div className="artinos-palette-results">
          {groups.map(([group, entries]) => (
            <section key={group}>
              <header>{group}</header>
              {entries.map(entry => {
                index++
                const active = index === cursor
                const at = index
                const Icon = entry.item.icon
                return (
                  <button
                    key={entry.item.id}
                    className={active ? 'is-active' : ''}
                    onPointerMove={() => setCursor(at)}
                    onClick={() => runAt(at)}
                  >
                    {Icon ? <Icon size={13} /> : <span className="artinos-palette-dot" />}
                    <b>
                      <Highlight text={entry.item.title} ranges={entry.ranges} />
                    </b>
                    {entry.item.subtitle && <small>{entry.item.subtitle}</small>}
                    <em>{entry.item.hint ?? ''}</em>
                    {active && <CornerDownLeft size={12} />}
                  </button>
                )
              })}
            </section>
          ))}
          {!flat.length && <div className="artinos-palette-empty">No matches for “{query}”</div>}
        </div>
      </div>
    </div>
  )

  return createPortal(surface, workspacePortalTarget())
}
