/**
 * Control primitives — styled, dependency-free React components.
 *
 * Only `ParameterControl` knows about `@artinos/runtime`; everything else here works in
 * any React app. Styling is the `.artinos-*` class contract in `theme.css`.
 */
export { Slider, NumberField, RangeSlider, Dial, type SliderProps } from './numeric'
export { TextField, TextArea, SearchField } from './text'
export { Toggle, Checkbox, Select, Segmented, Tabs, type Option } from './choice'
export { ColorField, VectorField, XYZControl, QuaternionControl, MatrixControl, ObjectReferenceField, XYPad as LegacyXYPad, type ObjectReferenceValue } from './vector'
export { ColorArea, ColorWheel, ColorSlider, ColorSwatches, ColorControl, GradientEditor, colorToCSS, type SemanticColorValue, type ColorValue, type GradientValue } from './color'
export { CurveControl, EnvelopeEditor, GraphEditor, type CurvePoint, type CurveValue, type EnvelopeValue } from './curve'
export { FileField, DropZone, AssetField, AssetDropZone, KeyCapture, LegacyCurveEditor, LegacyCurveEditor as CurveEditor, fileAssetReference, type AssetReference } from './files'
export { Button, IconButton, Collapsible } from './actions'
export { KeyValue, Meter, Progress, Badge, Sparkline, ValueReadout, LevelMeter, StatusDisplay } from './display'
export { Section, Stack, Toolbar, Empty } from './layout'
export {
  VirtualList,
  VirtualGrid,
  VariableVirtualList,
  VirtualTable,
  ListBrowser,
  Highlight,
  type VirtualListProps,
  type VariableVirtualListProps,
  type VirtualTableColumn,
  type ListBrowserProps,
  type ListBrowserFilter,
} from './list'
export { PropertyRow, PropertySection, type PropertyRowProps, type PropertyDensity } from './PropertyRow'
export { ParameterControl, type ParameterControlProps } from './ParameterControl'
export { controls, PRESENTATIONS, presentationsFor, resolvePresentation, type PresentationId, type PresentationSpec } from './control-registry'
export { Meter as InstrumentMeter, XYPad, XYPad as InstrumentXYPad, Joystick, Knob, Waveform, Envelope, GradientBar, type XYPadProps, type EnvelopePoint, type GradientStop } from './instrument'
export { Popover, Tooltip, ContextMenu, Menu, Dialog, Drawer, type PopoverProps, type MenuItem, type DialogProps } from './overlays'
export { RadioGroup, Accordion, Combobox, type RadioOption, type AccordionItem, type ComboboxOption } from './collections'
