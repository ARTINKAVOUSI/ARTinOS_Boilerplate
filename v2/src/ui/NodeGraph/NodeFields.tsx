import type { GraphField } from './graph'

/** What the host can offer the pickers. Empty lists degrade to free text. */
export interface GraphSources {
  signals?: readonly string[]
  parameters?: readonly { id: string; label: string }[]
  effects?: readonly { id: string; label: string; parameters: readonly { id: string; label: string }[] }[]
  objects?: readonly string[]
}

const stop = (event: { stopPropagation(): void }) => event.stopPropagation()

/**
 * One field on a node, by kind. Pickers fall back to a text box when the host
 * has nothing to offer, so a graph stays editable in any context.
 */
export function NodeField({
  field,
  value,
  sources,
  effectId,
  onChange,
}: {
  field: GraphField
  value: unknown
  sources: GraphSources
  /** For `effect-parameter`: the effect this node is pointed at. */
  effectId?: string
  onChange: (value: unknown) => void
}) {
  const text = value === undefined || value === null ? '' : String(value)

  const options =
    field.kind === 'select'
      ? field.options ?? []
      : field.kind === 'signal'
        ? sources.signals ?? []
        : field.kind === 'scene-object'
          ? sources.objects ?? []
          : undefined

  const pairs =
    field.kind === 'parameter'
      ? sources.parameters ?? []
      : field.kind === 'effect'
        ? (sources.effects ?? []).map(effect => ({ id: effect.id, label: effect.label }))
        : field.kind === 'effect-parameter'
          ? sources.effects?.find(effect => effect.id === effectId)?.parameters ?? []
          : undefined

  return (
    <label className="ngraph-field" title={field.description ?? field.label}>
      <span>{field.label}</span>
      {field.kind === 'number' && (
        <input type="number" value={Number(value ?? 0)} step={field.step ?? 0.01} min={field.min} max={field.max} onPointerDown={stop} onChange={event => onChange(Number(event.target.value))} />
      )}
      {field.kind === 'boolean' && <input type="checkbox" className="ngraph-check" checked={Boolean(value)} onPointerDown={stop} onChange={event => onChange(event.target.checked)} />}
      {field.kind === 'vector3' && (
        <span className="ngraph-vector">
          {[0, 1, 2].map(axis => (
            <input
              key={axis}
              type="number"
              step={0.01}
              value={Array.isArray(value) ? Number(value[axis] ?? 0) : 0}
              onPointerDown={stop}
              onChange={event => {
                const next = Array.isArray(value) ? [...(value as number[])] : [0, 0, 0]
                next[axis] = Number(event.target.value)
                onChange(next)
              }}
            />
          ))}
        </span>
      )}
      {options !== undefined &&
        (options.length ? (
          <select value={text} onPointerDown={stop} onChange={event => onChange(event.target.value)}>
            {field.kind !== 'select' && <option value="">Choose…</option>}
            {options.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input type="text" value={text} onPointerDown={stop} onChange={event => onChange(event.target.value)} />
        ))}
      {pairs !== undefined &&
        (pairs.length ? (
          <select value={text} onPointerDown={stop} onChange={event => onChange(event.target.value)}>
            <option value="">Choose…</option>
            {pairs.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input type="text" value={text} onPointerDown={stop} onChange={event => onChange(event.target.value)} />
        ))}
      {field.kind === 'text' && <input type="text" value={text} onPointerDown={stop} onChange={event => onChange(event.target.value)} />}
    </label>
  )
}
