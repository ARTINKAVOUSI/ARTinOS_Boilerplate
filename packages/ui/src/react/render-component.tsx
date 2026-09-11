import { createElement, type AriaRole, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { componentStateAttributes, type ComponentTreeNode, type ControlRegistry, type PresentationContext } from '../kernel'
import { Slider, NumberField, RangeSlider, Dial } from '../primitives/numeric'
import { Toggle, Select, Segmented } from '../primitives/choice'
import { TextField } from '../primitives/text'
import { ColorField, VectorField, XYZControl, QuaternionControl, MatrixControl, ObjectReferenceField } from '../primitives/vector'
import { AssetField } from '../primitives/files'
import { ColorArea, ColorWheel, ColorSlider, ColorSwatches, ColorControl, GradientEditor } from '../primitives/color'
import { CurveControl, EnvelopeEditor, GraphEditor } from '../primitives/curve'
import { Joystick, Knob, Meter, XYPad, Waveform, Envelope } from '../primitives/instrument'
import { controls } from '../primitives/control-registry'
import { useComponentInstance } from '../devtools/provider'

export type ReactPresentation = ComponentType<any>
export type ReactPresentationMap = Record<string, ReactPresentation>

const ControlSchemaView = ({ children, label }: { children?: ReactNode; label?: string }) => (
  <section className="artinos-control-schema" aria-label={label}>{children}</section>
)
const ControlGroupView = ({ children, label }: { children?: ReactNode; label?: string }) => (
  <section className="artinos-control-group" aria-label={label}>
    {label ? <h3 className="artinos-control-group__label">{label}</h3> : null}
    {children}
  </section>
)

export const reactPresentations: ReactPresentationMap = {
  slider: Slider,
  'number-field': NumberField,
  'range-slider': RangeSlider,
  knob: Knob,
  dial: Dial,
  meter: Meter,
  toggle: Toggle,
  select: Select,
  'segmented-control': Segmented,
  'text-field': TextField,
  'color-field': ColorField,
  'gradient-editor': GradientEditor,
  'color-area': ColorArea,
  'color-wheel': ColorWheel,
  'color-slider': ColorSlider,
  'color-swatches': ColorSwatches,
  'color-control': ColorControl,
  'vector-field': VectorField,
  'xyz-control': XYZControl,
  'quaternion-control': QuaternionControl,
  'matrix-control': MatrixControl,
  'asset-field': AssetField,
  'object-reference': ObjectReferenceField,
  'xy-pad': XYPad,
  joystick: Joystick,
  'curve-editor': CurveControl,
  'graph-editor': GraphEditor,
  envelope: Envelope,
  'envelope-editor': EnvelopeEditor,
  waveform: Waveform,
  'control-schema': ControlSchemaView,
  'control-group': ControlGroupView,
}

export interface ComponentRendererProps {
  node: ComponentTreeNode
  registry?: ControlRegistry
  components?: ReactPresentationMap
  context?: PresentationContext
}

function UnsupportedControl({ node, reason }: { node: ComponentTreeNode; reason: string }) {
  return (
    <div
      className="artinos-control-diagnostic"
      role="status"
      data-component={node.component}
      data-parameter={node.parameter}
      data-fault=""
    >
      <strong>{node.props?.label ? String(node.props.label) : node.parameter ?? node.component}</strong>
      <span>{reason}</span>
    </div>
  )
}

export function ComponentRenderer({
  node,
  registry = controls,
  components = reactPresentations,
  context = 'inspector',
}: ComponentRendererProps) {
  const requested = node.component || (typeof node.props?.type === 'string'
    ? registry.resolveControl({ type: node.props.type, context, hint: node.presentation })?.component
    : undefined)
  const definition = requested ? registry.get(requested) : undefined
  const Presentation = requested ? components[requested] : undefined
  const instance = useComponentInstance(requested ?? 'unsupported-control', {
    parameter: node.parameter,
    state: node.state ?? definition?.state.initial ?? {},
    anatomy: definition?.slots,
    source: definition?.metadata.source as string | undefined,
    subscriptions: node.parameter ? [node.parameter] : [],
    layout: node.layout,
    accessibility: definition?.accessibility as Record<string, unknown> | undefined,
  })
  if (!definition) return <UnsupportedControl node={node} reason={`Unknown semantic component: ${requested ?? '(none)'}`} />
  if (!Presentation) return <UnsupportedControl node={node} reason={`No React presentation registered for ${definition.id}`} />

  const children = node.children?.map((child, index) => (
    <ComponentRenderer
      key={`${child.component}:${child.parameter ?? index}`}
      node={child}
      registry={registry}
      components={components}
      context={context}
    />
  ))
  const stateAttributes = componentStateAttributes(Object.fromEntries(Object.entries({ ...(node.state ?? definition.state.initial), ...(instance.simulatedState ?? {}) }).filter(([, value]) => value !== undefined)) as import('../kernel').ComponentState)
  const layoutStyle = node.layout as CSSProperties | undefined
  const props = {
    ...node.props,
    children,
    label: node.props?.label,
  }

  return (
    <div
      className="artinos-component"
      data-component={definition.id}
      data-presentation={node.presentation}
      data-parameter={node.parameter}
      data-anatomy={definition.slots.join(' ')}
      data-tokens={definition.tokens.join(' ')}
      role={definition.accessibility.role as AriaRole | undefined}
      aria-label={definition.accessibility.labelRequired && typeof node.props?.label === 'string' ? node.props.label : undefined}
      style={layoutStyle}
      {...stateAttributes}
    >
      {createElement(Presentation, props)}
    </div>
  )
}
