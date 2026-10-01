import type { ReactNode } from 'react'
import type { DiscoveredFeature } from '../feature'
import { features } from '../registry'

/**
 * The catalogue: every feature sorted into sections and shelves, derived from
 * the manifests alone (kind, group, category) — nothing here names a feature.
 * The Library browses it; the Inspector lays out what is switched on the same
 * way, so a component sits in the same place in both.
 *
 *   objects   scene features grouped 'Objects'      one shelf
 *   scene     every other scene feature             a shelf per group
 *   effects   effects and the pipeline host         a shelf per category
 *   input     app-level features (devices)          a shelf per group
 *   overlays  DOM over the canvas                   a shelf per group
 */

export type SectionId = 'objects' | 'scene' | 'effects' | 'input' | 'overlays' | 'other'

export interface Shelf {
  /** `section/shelf`, stable. */
  id: string
  label: string
  features: DiscoveredFeature[]
}

export interface Section {
  id: SectionId
  label: string
  note: string
  icon: ReactNode
  shelves: Shelf[]
  /** Every feature of the section, in shelf order. */
  features: DiscoveredFeature[]
}

const glyph = (d: string) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

/** Section glyphs, on the studio icons' 16px grid. */
export const Glyphs = {
  all: glyph('M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z'),
  objects: glyph('M8 2.5l5 2.75v5.5L8 13.5l-5-2.75v-5.5zM3 5.25L8 8l5-2.75M8 8v5.5'),
  scene: glyph('M2.5 12.5h11M4 12.5l3-4.5 2 2.5 1.5-2 2.5 4M10.5 5.5a1.5 1.5 0 1 0 0-.01'),
  effects: glyph('M8 2.5l1.3 3.2 3.2 1.3-3.2 1.3L8 11.5 6.7 8.3 3.5 7l3.2-1.3zM12.5 11l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z'),
  input: glyph('M6 2.5v3M10 2.5v3M4.5 5.5h7v2.5a3.5 3.5 0 0 1-7 0zM8 11.5v2'),
  overlays: glyph('M8 2.5l5.5 3L8 8.5l-5.5-3zM2.5 8L8 11l5.5-3M2.5 10.5L8 13.5l5.5-3'),
  other: glyph('M3.5 3.5h9v9h-9zM6 8h4'),
  assets: glyph('M2.5 3.5h11v9h-11zM2.5 10.5l3-3 2.5 2.5 2-2 3.5 3.5M10.5 6a.5.5 0 1 0 0-.01'),
  source: glyph('M6 4.5L2.5 8 6 11.5M10 4.5l3.5 3.5-3.5 3.5'),
}

export const words = (value: string) => value.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())

export function sectionOf(feature: DiscoveredFeature): SectionId {
  if (feature.kind === 'effect' || feature.kind === 'canvas-provider') return 'effects'
  if (feature.kind === 'scene') return feature.group === 'Objects' ? 'objects' : 'scene'
  if (feature.kind === 'app') return 'input'
  if (feature.kind === 'overlay') return 'overlays'
  return 'other'
}

function shelfOf(feature: DiscoveredFeature) {
  if (feature.kind === 'canvas-provider') return 'Pipeline'
  if (feature.kind === 'effect') return words(feature.category ?? 'other')
  return feature.group ?? 'Other'
}

/** Sections in reading order, and the shelf order inside each; a shelf not listed goes last. */
const SECTIONS: { id: SectionId; label: string; note: string; shelves: string[] }[] = [
  { id: 'objects', label: 'Objects', note: 'Things in the scene: meshes, models, text, media and particles', shelves: [] },
  { id: 'scene', label: 'Scene', note: 'Render settings, camera, atmosphere, lighting and ground', shelves: ['Render', 'Camera', 'Atmosphere', 'Lighting', 'Ground'] },
  { id: 'effects', label: 'Effects', note: 'Post-processing passes, run in chain order', shelves: ['Pipeline', 'Light', 'Lens', 'Color', 'Blur', 'Stylize', 'Temporal', 'Screen space', 'Anti aliasing'] },
  { id: 'input', label: 'Input', note: 'Devices that feed the signal bus', shelves: [] },
  { id: 'overlays', label: 'Overlays', note: 'Readouts drawn over the canvas', shelves: [] },
  { id: 'other', label: 'Other', note: 'Features of a kind the studio does not group yet', shelves: [] },
]

const rank = (order: string[], label: string) => (order.includes(label) ? order.indexOf(label) : order.length)

export const catalogue: Section[] = SECTIONS.map(({ id, label, note, shelves: order }) => {
  const members = features.filter(feature => sectionOf(feature) === id)
  const labels = [...new Set(members.map(shelfOf))].sort((a, b) => rank(order, a) - rank(order, b) || a.localeCompare(b))
  const shelves = labels.map(shelf => ({ id: `${id}/${shelf}`, label: shelf, features: members.filter(feature => shelfOf(feature) === shelf) }))
  return { id, label, note, icon: Glyphs[id], shelves, features: shelves.flatMap(shelf => shelf.features) }
}).filter(section => section.features.length)

export const sectionById = (id: string) => catalogue.find(section => section.id === id)

/** The shelf a feature sits on. */
export const shelfLabel = (feature: DiscoveredFeature) => shelfOf(feature)

/** What a feature has, costs and needs, in a few quiet words: 3 settings · high cost · WebGPU. */
export function captionOf(feature: DiscoveredFeature) {
  const settings = Object.keys(feature.controls ?? {}).length
  return [settings ? `${settings} setting${settings === 1 ? '' : 's'}` : 'No settings', feature.cost && `${feature.cost.replace('-', ' ')} cost`, feature.webgpuOnly && 'WebGPU'].filter(Boolean).join(' · ')
}

/** Every word of the query appears in the feature's name, id, description or shelf. */
export function matches(feature: DiscoveredFeature, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const hay = `${feature.label} ${feature.id} ${feature.description ?? ''} ${shelfOf(feature)} ${feature.category ?? ''}`.toLowerCase()
  return needle.split(/\s+/).every(word => hay.includes(word))
}
