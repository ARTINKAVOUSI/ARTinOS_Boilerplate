import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Token studio — the live edit surface for the design system.
 *
 * Edits go straight onto the document root as CSS custom properties, so every
 * specimen on the page repaints from the same roles the product uses. Nothing
 * here knows what a Slider is; it moves the token and the cascade does the
 * rest, which is the whole point of the five-layer token graph.
 *
 * Overrides persist to localStorage and can be exported as a CSS block that
 * can be pasted straight into `tokens.css`.
 */

const STORAGE_KEY = 'artinos.showcase.tokens'

interface TokenSpec {
  /** CSS custom property, without the leading `--`. */
  name: string
  label: string
  /** A colour picker is only offered for tokens that resolve to a flat hex. */
  color?: boolean
}

interface TokenGroupSpec {
  title: string
  tokens: TokenSpec[]
}

export const TOKEN_GROUPS: TokenGroupSpec[] = [
  {
    title: 'Surface',
    tokens: [
      { name: 'bg-app', label: 'App ground', color: true },
      { name: 'bg-stage', label: 'Stage', color: true },
      { name: 'bg-surface', label: 'Surface', color: true },
      { name: 'bg-raised', label: 'Raised', color: true },
      { name: 'bg-hover', label: 'Hover' },
      { name: 'bg-active', label: 'Active' },
      { name: 'bg-well', label: 'Well' },
      { name: 'bg-row', label: 'Row rest' },
    ],
  },
  {
    title: 'Frost',
    tokens: [
      { name: 'frost-tint', label: 'Tint' },
      { name: 'blur-frost', label: 'Blur' },
      { name: 'blur-float', label: 'Float blur' },
    ],
  },
  {
    title: 'Text',
    tokens: [
      { name: 'text-hi', label: 'Primary', color: true },
      { name: 'text-mid', label: 'Secondary', color: true },
      { name: 'text-low', label: 'Muted', color: true },
      { name: 'text-faint', label: 'Faint', color: true },
      { name: 'text-ghost', label: 'Ghost', color: true },
    ],
  },
  {
    title: 'Line',
    tokens: [
      { name: 'line-subtle', label: 'Subtle' },
      { name: 'line', label: 'Line' },
      { name: 'line-strong', label: 'Strong' },
    ],
  },
  {
    title: 'Signal',
    tokens: [
      { name: 'sig-live', label: 'Live', color: true },
      { name: 'sig-live-hi', label: 'Live highlight', color: true },
      { name: 'sig-warn', label: 'Warn', color: true },
      { name: 'sig-fault', label: 'Fault', color: true },
      { name: 'sig-bind', label: 'Bound', color: true },
    ],
  },
  {
    title: 'Metrics',
    tokens: [
      { name: 'control-h-sm', label: 'Control small' },
      { name: 'control-h', label: 'Control' },
      { name: 'control-h-lg', label: 'Control large' },
      { name: 'radius-control', label: 'Radius control' },
      { name: 'radius-card', label: 'Radius card' },
      { name: 'radius-panel', label: 'Radius panel' },
    ],
  },
  {
    title: 'Motion',
    tokens: [
      { name: 'dur-value', label: 'Value' },
      { name: 'dur-state', label: 'State' },
      { name: 'dur-surface', label: 'Surface' },
      { name: 'dur-layout', label: 'Layout' },
    ],
  },
]

const ALL_TOKENS = TOKEN_GROUPS.flatMap(group => group.tokens)

function readOverrides(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** Resolved value of a token as the browser currently computes it. */
function computed(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
}

/**
 * `<input type="color">` only accepts `#rrggbb`. Tokens that resolve to a
 * function or an alpha colour get a text field instead of a broken picker.
 */
function asHex(value: string): string | null {
  const v = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v)
  if (!rgb) return null
  const hex = (n: string) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0')
  return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`
}

export function TokenStudio() {
  const [open, setOpen] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  /** Baseline values, captured before any override is applied. */
  const [baseline, setBaseline] = useState<Record<string, string>>({})

  // Capture the untouched values once, then replay whatever was saved. Reading
  // the baseline first matters: otherwise a reload would treat a persisted
  // override as the value to revert to, and Reset could never get home.
  useEffect(() => {
    const base: Record<string, string> = {}
    for (const token of ALL_TOKENS) base[token.name] = computed(token.name)
    setBaseline(base)

    const saved = readOverrides()
    setOverrides(saved)
    for (const [name, value] of Object.entries(saved)) {
      document.documentElement.style.setProperty(`--${name}`, value)
    }
  }, [])

  const apply = useCallback((name: string, value: string) => {
    document.documentElement.style.setProperty(`--${name}`, value)
    setOverrides(prev => {
      const next = { ...prev, [name]: value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* persistence is a convenience, not a requirement */
      }
      return next
    })
  }, [])

  const reset = useCallback(() => {
    for (const name of Object.keys(overrides)) document.documentElement.style.removeProperty(`--${name}`)
    setOverrides({})
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [overrides])

  const css = useMemo(() => {
    const entries = Object.entries(overrides)
    if (!entries.length) return '/* no overrides */'
    return `:root {\n${entries.map(([name, value]) => `  --${name}: ${value};`).join('\n')}\n}`
  }, [overrides])

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(css)
  }, [css])

  const dirtyCount = Object.keys(overrides).length

  return (
    <>
      <button className="artinos-studio-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <i aria-hidden />
        {open ? 'Close studio' : `Token studio${dirtyCount ? ` · ${dirtyCount}` : ''}`}
      </button>

      <aside className="artinos-studio" data-open={open} aria-label="Token studio" aria-hidden={!open}>
        <header>
          <b>Token studio</b>
          <span style={{ marginLeft: 'auto', font: '300 8.5px/1 var(--font-num)', color: 'var(--text-faint)' }}>
            {dirtyCount} changed
          </span>
        </header>

        <div className="artinos-studio-body">
          {TOKEN_GROUPS.map(group => (
            <div className="artinos-studio-group" key={group.title}>
              <h6>{group.title}</h6>
              {group.tokens.map(token => {
                const current = overrides[token.name] ?? baseline[token.name] ?? ''
                const hex = token.color ? asHex(current) : null
                return (
                  <div className="artinos-studio-row" key={token.name} data-dirty={token.name in overrides}>
                    <label htmlFor={`tok-${token.name}`} title={`--${token.name}`}>
                      {token.label}
                    </label>
                    <input
                      id={`tok-${token.name}`}
                      type="text"
                      value={current}
                      spellCheck={false}
                      onChange={event => apply(token.name, event.target.value)}
                    />
                    {hex ? (
                      <input
                        type="color"
                        value={hex}
                        aria-label={`${token.label} colour`}
                        onChange={event => apply(token.name, event.target.value)}
                      />
                    ) : (
                      <span />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <footer>
          <button onClick={copy} title="Copy the overrides as a CSS block">
            Copy CSS
          </button>
          <button className="is-primary" onClick={reset} disabled={!dirtyCount} title="Revert every token to its shipped value">
            Reset
          </button>
        </footer>
      </aside>
    </>
  )
}
