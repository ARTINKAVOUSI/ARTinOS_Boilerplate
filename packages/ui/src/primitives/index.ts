/**
 * Control primitives — styled, dependency-free React components.
 *
 * Plain React with no runtime dependency. Styling is the `.artinos-*` class contract in
 * `theme.css`, whose default look is the workbench reference.
 */
export { Pane, StatusDot, type PaneProps, type PaneVariant } from './pane'
export { Field, PinButton, type FieldProps, type FieldLayout } from './field'
export { Slider, NumberField, RangeSlider, Dial, type SliderProps } from './numeric'
export { NumericInput, NumberWell, boundedNumber } from './numeric-input'
export { TextField, TextArea, SearchField } from './text'
export { Toggle, Checkbox, Select, SelectShell, Segmented, Tabs, type Option } from './choice'
export { ColorField, ColorRamp, HueBar, VectorField, XYZControl, QuaternionControl, MatrixControl, ObjectReferenceField, XYPad as LegacyXYPad, type ObjectReferenceValue } from './vector'
export { SelectionList, PinBar, DimensionField, type SelectionItem } from './selection'
export { ColorArea, ColorWheel, ColorSlider, ColorSwatches, ColorControl, GradientEditor, colorToCSS, type SemanticColorValue, type ColorValue, type GradientValue } from './color'
export { CurveControl, EnvelopeEditor, GraphEditor, type CurvePoint, type CurveValue, type EnvelopeValue } from './curve'
export { FileField, DropZone, AssetField, AssetDropZone, KeyCapture, LegacyCurveEditor, LegacyCurveEditor as CurveEditor, fileAssetReference, type AssetReference } from './files'
export { Button, IconButton, Collapsible } from './actions'
export { KeyValue, Meter, Progress, Badge, Sparkline, ValueReadout, LevelMeter, StatusDisplay, MicroReadout, MicroReadoutRow } from './display'
export { Section, Stack, Toolbar, Empty, Note, ChangeLog } from './layout'
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
export { controls, PRESENTATIONS, presentationsFor, resolvePresentation, type PresentationId, type PresentationSpec } from './control-registry'
export { Meter as InstrumentMeter, XYPad, XYPad as InstrumentXYPad, Joystick, Knob, Waveform, Envelope, GradientBar, type XYPadProps, type EnvelopePoint, type GradientStop } from './instrument'
export { Popover, Tooltip, ContextMenu, Menu, Dialog, Drawer, type PopoverProps, type MenuItem, type DialogProps } from './overlays'
export { RadioGroup, Accordion, Combobox, type RadioOption, type AccordionItem, type ComboboxOption } from './collections'
