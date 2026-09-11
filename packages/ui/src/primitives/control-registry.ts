import {
  ControlRegistry,
  defineComponent,
  type ParameterKind,
  type PresentationContext,
  type PresentationEntry,
  type ResolveQuery,
} from '../kernel'

export const controls = new ControlRegistry()

export type PresentationId =
  | 'scrub' | 'field' | 'range' | 'knob' | 'dial' | 'meter' | 'toggle' | 'select' | 'segmented'
  | 'text' | 'color' | 'gradient' | 'vector' | 'matrix' | 'asset' | 'object' | 'xy' | 'curve' | 'envelope' | 'waveform'

export interface PresentationSpec extends PresentationEntry {
  id: PresentationId
}

const COMPONENTS = [
  ['slider', 'Slider', ['number', 'integer', 'angle', 'distance', 'percentage', 'time', 'frequency']],
  ['number-field', 'NumberField', ['number', 'integer', 'angle', 'distance', 'percentage', 'time', 'frequency']],
  ['range-slider', 'RangeSlider', ['range']],
  ['knob', 'Knob', ['number', 'angle', 'frequency']],
  ['dial', 'Dial', ['number', 'angle', 'frequency']],
  ['meter', 'Meter', ['number', 'percentage']],
  ['toggle', 'Toggle', ['boolean']],
  ['select', 'Select', ['enum', 'string']],
  ['segmented-control', 'SegmentedControl', ['enum']],
  ['text-field', 'TextField', ['string', 'path']],
  ['color-field', 'ColorField', ['color']],
  ['color-area', 'ColorArea', ['color']],
  ['color-wheel', 'ColorWheel', ['color']],
  ['color-slider', 'ColorSlider', ['color']],
  ['color-swatches', 'ColorSwatches', ['color']],
  ['color-control', 'ColorControl', ['color']],
  ['gradient-editor', 'GradientEditor', ['gradient']],
  ['vector-field', 'VectorField', ['range', 'vec2', 'vec3', 'vec4', 'quaternion']],
  ['xyz-control', 'XYZControl', ['vec3']],
  ['quaternion-control', 'QuaternionControl', ['quaternion']],
  ['matrix-control', 'MatrixControl', ['matrix']],
  ['asset-field', 'AssetField', ['asset', 'image', 'texture', 'video', 'audio']],
  ['object-reference', 'ObjectReferenceField', ['object-reference']],
  ['xy-pad', 'XYPad', ['vec2']],
  ['joystick', 'Joystick', ['vec2']],
  ['curve-editor', 'CurveEditor', ['curve']],
  ['graph-editor', 'GraphEditor', ['curve']],
  ['envelope', 'Envelope', ['envelope']],
  ['envelope-editor', 'EnvelopeEditor', ['envelope']],
  ['waveform', 'Waveform', ['audio', 'curve']],
] as const

for (const [id, name, kinds] of COMPONENTS) {
  controls.registerComponent(defineComponent({
    id,
    name,
    category: 'control',
    state: { initial: { status: 'idle' }, states: ['idle', 'hover', 'focus', 'pressed', 'dragging', 'editing', 'disabled', 'readonly', 'fault'] },
    events: ['change', 'gestureStart', 'gestureEnd', 'cancel'],
    interactions: ['pointer', 'touch', 'pen', 'keyboard'],
    accessibility: { keyboard: [], focusable: true, labelRequired: true },
    semantics: { purpose: name, parameterKinds: [...kinds] },
    slots: ['Root', 'Label', 'Control', 'Value'],
    tokens: ['control.surface', 'control.value', 'control.focus'],
    motion: 'precise',
    physics: 'precise',
    layout: { adaptive: true },
    metadata: { status: 'stable', source: `primitives/${id}` },
  }))
}

for (const [id, name, category] of [
  ['control-schema', 'ControlSchema', 'composite'],
  ['control-group', 'ControlGroup', 'composite'],
  ['unsupported-control', 'UnsupportedControl', 'primitive'],
] as const) {
  controls.registerComponent(defineComponent({
    id,
    name,
    category,
    state: { initial: { status: 'idle' } },
    events: [],
    accessibility: category === 'composite' ? { role: 'group', keyboard: [] } : { role: 'status', keyboard: [] },
    semantics: { purpose: name },
    slots: ['Root', 'Content'],
    layout: { adaptive: true },
    metadata: { status: 'stable', source: 'react/render-component' },
  }))
}

for (const definition of [
  { id: 'checkbox', name: 'Checkbox', category: 'control', kinds: ['boolean'], slots: ['Root', 'Input', 'Indicator', 'Label'], role: 'checkbox' },
  { id: 'button', name: 'Button', category: 'primitive', kinds: [], slots: ['Root', 'Content'], role: 'button' },
  { id: 'icon-button', name: 'IconButton', category: 'primitive', kinds: [], slots: ['Root', 'Icon'], role: 'button' },
  { id: 'text-area', name: 'TextArea', category: 'control', kinds: ['string'], slots: ['Root', 'Label', 'Input'], role: 'textbox' },
  { id: 'search-field', name: 'SearchField', category: 'control', kinds: ['string'], slots: ['Root', 'Input', 'Clear'], role: 'searchbox' },
  { id: 'tabs', name: 'Tabs', category: 'primitive', kinds: [], slots: ['Root', 'Tab', 'Indicator'], role: 'tablist' },
  { id: 'collapsible', name: 'Collapsible', category: 'primitive', kinds: [], slots: ['Root', 'Trigger', 'Content'], role: 'group' },
  { id: 'section', name: 'Section', category: 'primitive', kinds: [], slots: ['Root', 'Header', 'Title', 'Description', 'Content'], role: 'region' },
  { id: 'stack', name: 'Stack', category: 'primitive', kinds: [], slots: ['Root', 'Content'], role: 'group' },
  { id: 'toolbar', name: 'Toolbar', category: 'primitive', kinds: [], slots: ['Root', 'Content'], role: 'toolbar' },
  { id: 'property-row', name: 'PropertyRow', category: 'composite', kinds: [], slots: ['Root', 'Main', 'Label', 'Binding', 'Control', 'Unit', 'Actions', 'Reset', 'Message'], role: 'group' },
  { id: 'property-section', name: 'PropertySection', category: 'composite', kinds: [], slots: ['Root', 'Header', 'Title', 'Count', 'Content'], role: 'region' },
] as const) {
  controls.registerComponent(defineComponent({
    id: definition.id,
    name: definition.name,
    category: definition.category,
    state: { initial: { status: 'idle' }, states: ['idle', 'hover', 'focus', 'active', 'disabled', 'readonly', 'fault'] },
    events: ['activate', 'change'],
    interactions: ['pointer', 'touch', 'keyboard'],
    accessibility: { role: definition.role, keyboard: ['Tab', 'Enter', 'Space'], focusable: true },
    semantics: { purpose: definition.name, parameterKinds: [...definition.kinds] },
    slots: [...definition.slots],
    tokens: ['control.surface', 'control.text', 'control.focus'],
    motion: 'precise',
    physics: 'precise',
    layout: { adaptive: true },
    metadata: { status: 'stable', source: `primitives/${definition.id}` },
  }))
}

const specs: PresentationSpec[] = [
  { id: 'scrub', component: 'slider', types: ['number', 'integer', 'angle', 'distance', 'percentage', 'time', 'frequency'], minWidth: 0, priority: 3 },
  { id: 'field', component: 'number-field', types: ['number', 'integer', 'angle', 'distance', 'percentage', 'time', 'frequency'], minWidth: 0, priority: 1 },
  { id: 'range', component: 'range-slider', types: ['range'], minWidth: 96, priority: 4 },
  { id: 'knob', component: 'knob', types: ['number', 'angle', 'frequency'], minWidth: 64, priority: 2, contexts: ['toolbar', 'canvasOverlay', 'node'] },
  { id: 'dial', component: 'dial', types: ['number', 'angle', 'frequency'], minWidth: 64, priority: 1, contexts: ['toolbar', 'canvasOverlay', 'node'] },
  { id: 'meter', component: 'meter', types: ['number', 'percentage'], minWidth: 48, priority: 0 },
  { id: 'toggle', component: 'toggle', types: ['boolean'], minWidth: 0, priority: 3 },
  { id: 'select', component: 'select', types: ['enum'], minWidth: 0, priority: 3 },
  { id: 'segmented', component: 'segmented-control', types: ['enum'], minWidth: 180, priority: 4 },
  { id: 'text', component: 'text-field', types: ['string', 'path'], minWidth: 0, priority: 2 },
  { id: 'color', component: 'color-field', types: ['color'], minWidth: 0, priority: 3 },
  { id: 'gradient', component: 'gradient-editor', types: ['gradient'], minWidth: 0, priority: 3 },
  { id: 'vector', component: 'vector-field', types: ['vec2', 'vec3', 'vec4', 'quaternion'], minWidth: 0, priority: 3 },
  { id: 'matrix', component: 'matrix-control', types: ['matrix'], minWidth: 160, priority: 3 },
  { id: 'asset', component: 'asset-field', types: ['asset', 'image', 'texture', 'video', 'audio'], minWidth: 0, priority: 3 },
  { id: 'object', component: 'object-reference', types: ['object-reference'], minWidth: 0, priority: 3 },
  { id: 'xy', component: 'xy-pad', types: ['vec2'], minWidth: 120, priority: 4 },
  { id: 'curve', component: 'curve-editor', types: ['curve'], minWidth: 0, priority: 3 },
  { id: 'envelope', component: 'envelope-editor', types: ['envelope'], minWidth: 160, priority: 3 },
  { id: 'waveform', component: 'waveform', types: ['audio', 'curve'], minWidth: 120, priority: 1 },
]
for (const spec of specs) controls.registerControl(spec)

/** Compatibility snapshot. The registry above remains the only authority. */
export const PRESENTATIONS: readonly PresentationSpec[] = Object.freeze(controls.listControls() as PresentationSpec[])

export function presentationsFor(
  kind: ParameterKind,
  width = Infinity,
  context?: PresentationContext,
): PresentationSpec[] {
  return controls.presentationsFor(kind, { width, context }) as PresentationSpec[]
}

export function resolvePresentation(
  kind: ParameterKind,
  width = Infinity,
  hint?: string,
  context?: PresentationContext,
): PresentationId | undefined {
  return controls.resolveControl({ type: kind, width, hint, context } as ResolveQuery)?.id as PresentationId | undefined
}
