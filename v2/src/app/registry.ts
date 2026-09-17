import type { DiscoveredFeature, Feature, FeatureKind } from './feature'

/**
 * Feature discovery. Every `.tsx` file under `src/features/` that exports a
 * `feature` manifest is picked up here; files without one (shared helpers such
 * as the signal bus) are ignored. This is the only place that knows the folder.
 */
const modules = import.meta.glob<{ feature?: Feature }>('../features/**/*.tsx', { eager: true })

function discover(): DiscoveredFeature[] {
  const seen = new Map<string, string>()
  const found: DiscoveredFeature[] = []
  for (const [path, module] of Object.entries(modules)) {
    const feature = module.feature
    if (!feature) continue
    const file = path.replace('../', 'src/')
    if (!feature.id || !feature.label || !feature.kind || typeof feature.component !== 'function') {
      console.warn(`[features] ${file} exports an incomplete feature manifest and was skipped.`)
      continue
    }
    const clash = seen.get(feature.id)
    if (clash) {
      console.warn(`[features] Duplicate id "${feature.id}" in ${file} (already used by ${clash}); skipped.`)
      continue
    }
    seen.set(feature.id, file)
    found.push({ ...feature, path: file })
  }
  return found.sort((a, b) => (a.order ?? 500) - (b.order ?? 500) || a.label.localeCompare(b.label))
}

export const features = discover()

export const byKind = (kind: FeatureKind) => features.filter(feature => feature.kind === kind)
export const findFeature = (id: string) => features.find(feature => feature.id === id)
