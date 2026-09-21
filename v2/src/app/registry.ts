import type { DiscoveredFeature, Feature, FeatureInspector, FeatureKind } from './feature'

/**
 * Feature discovery. Every `.tsx` file under `src/features/` that exports a
 * `feature` manifest is picked up here, and every one that exports an
 * `inspector` section; files with neither (helpers such as the glass material)
 * are ignored. Only `.tsx` files are scanned. This is the only place that
 * knows the folder.
 */
const modules = import.meta.glob<{ feature?: Feature; inspector?: FeatureInspector }>('../features/**/*.tsx', { eager: true })

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

/** Studio sections shipped by feature folders; see `FeatureInspector`. */
export const inspectors: FeatureInspector[] = Object.values(modules)
  .map(module => module.inspector)
  .filter((inspector): inspector is FeatureInspector => !!inspector && Array.isArray(inspector.features) && typeof inspector.component === 'function')
