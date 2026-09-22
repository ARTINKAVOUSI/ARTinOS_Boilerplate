import { useEffect } from 'react'
import { Boxes, Gauge, Radio, Redo2, Save, Sliders, Sparkles, Undo2 } from 'lucide-react'
import { useArtinosRuntime } from '@artinos/runtime'
import { registerCommandSource, reveal, type CommandItem } from '@artinos/ui'
import { formatValue } from '@artinos/ui'

/** Sources scan the whole registry only once the query is this long. */
const SCAN_THRESHOLD = 2
const QUALITY_TIERS = ['low', 'balanced', 'high', 'ultra'] as const
const TIER_SCALARS: Record<(typeof QUALITY_TIERS)[number], number> = { low: 0.5, balanced: 0.72, high: 0.88, ultra: 1 }

/**
 * Registers the runtime-backed palette sources.
 *
 * Results are read from the live runtime at query time, so they carry current values and
 * act directly: a boolean parameter toggles from the palette rather than merely revealing
 * a panel. That is the difference between a launcher and a control surface.
 *
 * Call once, from the shell.
 */
export function useRuntimeCommands(): void {
  const runtime = useArtinosRuntime()

  useEffect(() => {
    const unregister = [
      registerCommandSource({
        id: 'parameters',
        collect: query => {
          if (query.length < SCAN_THRESHOLD) return []
          return runtime.parameters.list().map<CommandItem>(parameter => {
            const { definition } = parameter
            const boolean = definition.type === 'boolean'
            const current = formatValue(parameter.baseValue)
            return {
              id: `parameter:${definition.id}`,
              title: definition.label ?? definition.id,
              subtitle: `${definition.id} · ${current}`,
              group: 'Parameters',
              keywords: `${definition.group ?? ''} ${definition.type} parameter`,
              icon: Sliders,
              hint: boolean ? 'toggle' : 'reveal',
              run: () => {
                if (boolean) {
                  runtime.setParameter(definition.id, !parameter.baseValue, `Toggle ${definition.label ?? definition.id}`)
                  return
                }
                reveal('parameter', definition.id)
              },
            }
          })
        },
      }),

      registerCommandSource({
        id: 'presets',
        collect: () =>
          runtime.presets.list().map<CommandItem>(preset => ({
            id: `preset:${preset.id}`,
            title: preset.label,
            subtitle: preset.id,
            group: 'Presets',
            keywords: 'preset apply',
            icon: Sparkles,
            hint: 'apply',
            run: () => {
              runtime.presets.apply(preset.id)
              runtime.logger.info(`Preset applied: ${preset.label}`, { source: 'command-palette' })
            },
          })),
      }),

      registerCommandSource({
        id: 'modules',
        collect: query => {
          if (query.length < SCAN_THRESHOLD) return []
          return runtime.modules.list().map<CommandItem>(module => ({
            id: `module:${module.id}`,
            title: module.name,
            subtitle: `${module.category} · ${module.provider}`,
            group: 'Modules',
            keywords: `${module.id} ${module.tags?.join(' ') ?? ''} ${module.capabilities?.join(' ') ?? ''} module`,
            icon: Boxes,
            hint: 'copy import',
            run: () => {
              if (module.canonicalImport) navigator.clipboard?.writeText(module.canonicalImport)
              reveal('module', module.id)
            },
          }))
        },
      }),

      registerCommandSource({
        id: 'signals',
        collect: query => {
          if (query.length < SCAN_THRESHOLD) return []
          return runtime.signals.list().map<CommandItem>(signal => ({
            id: `signal:${signal.id}`,
            title: signal.id,
            subtitle: formatValue(signal.value),
            group: 'Signals',
            keywords: 'signal live input',
            icon: Radio,
            hint: 'reveal',
            run: () => reveal('signal', signal.id),
          }))
        },
      }),

      registerCommandSource({
        id: 'actions',
        collect: () => {
          const quality = runtime.quality.getState()
          const items: CommandItem[] = [
            {
              id: 'action:undo',
              title: 'Undo',
              subtitle: runtime.history.snapshot().undo.at(-1)?.label ?? 'nothing to undo',
              group: 'Actions',
              keywords: 'history revert back',
              icon: Undo2,
              run: () => runtime.undo(),
            },
            {
              id: 'action:redo',
              title: 'Redo',
              subtitle: runtime.history.snapshot().redo.at(-1)?.label ?? 'nothing to redo',
              group: 'Actions',
              keywords: 'history forward',
              icon: Redo2,
              run: () => runtime.redo(),
            },
            {
              id: 'action:save',
              title: 'Save project state',
              group: 'Actions',
              keywords: 'persist store write',
              icon: Save,
              run: () => runtime.persistence.save(),
            },
            {
              id: 'action:quality-auto',
              title: 'Quality: auto',
              subtitle: quality.mode === 'auto' ? 'active' : `currently ${quality.mode}`,
              group: 'Quality',
              keywords: 'adaptive performance governor',
              icon: Gauge,
              run: () => runtime.quality.setState({ mode: 'auto' }),
            },
          ]

          for (const tier of QUALITY_TIERS) {
            items.push({
              id: `action:quality-${tier}`,
              title: `Quality: ${tier}`,
              subtitle: quality.mode === 'manual' && quality.tier === tier ? 'active' : `${Math.round(TIER_SCALARS[tier] * 100)}% scale`,
              group: 'Quality',
              keywords: 'performance tier resolution',
              icon: Gauge,
              run: () => runtime.quality.setState({ tier, scalar: TIER_SCALARS[tier], mode: 'manual' }),
            })
          }

          return items
        },
      }),
    ]

    return () => unregister.forEach(remove => remove())
  }, [runtime])
}
