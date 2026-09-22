/**
 * ARTINOS UI Kernel — framework-independent mechanics.
 *
 * Nothing in this directory may import React, `@artinos/runtime`, or reach for the
 * DOM. That boundary is the whole point: behavior, geometry, interaction, physics
 * and metadata stay representable independently of the renderer, so React is one
 * renderer of a component definition rather than the definition itself (PRD §2).
 *
 * The React renderer lives in `../react`; the runtime binding lives in `../hooks`.
 */

export {
  defineComponent,
  deriveComponent,
  componentStateAttributes,
  type ComponentCategory,
  type ComponentState,
  type ComponentDataAttributes,
  type ComponentTransition,
  type ComponentAccessibility,
  type ComponentSemantics,
  type ComponentLayoutContract,
  type ComponentDefinition,
  type ComponentDefinitionInput,
  type ComponentPatch,
} from './component'

export {
  serializeComponent,
  deserializeComponent,
  validateComponentTree,
  walkComponentTree,
  type ComponentTreeNode,
  type SerializedComponentNode,
  type ComponentRegistryLookup,
  type ComponentTreeIssue,
  type ComponentTreeValidation,
} from './serialization'

export {
  defineControls,
  inferParameterDefinition,
  materializeSchema,
  schemaToComponentTree,
  type SchemaValues,
  type SchemaPredicate,
  type ControlSchemaEntry,
  type ControlSchemaValue,
  type ControlSchemaInput,
  type ControlSchemaDefinition,
  type DefineControlsOptions,
  type ParameterDefinitionLike,
  type ParameterTypeRegistryLike,
  type ParameterMaterializer,
} from './schema'

export {
  linearGeometry,
  angularGeometry,
  planarGeometry,
  rangeGeometry,
  spatialGeometry,
  xyGeometry,
  xyzGeometry,
  colorPlaneGeometry,
  gradientStopGeometry,
  curveGeometry,
  envelopeGeometry,
  radialGeometry,
  expandHitArea,
  hitTest,
  valueAtOffset,
  valueForDelta,
  normalize,
  denormalize,
  DIAL_TRAVEL,
  type LinearSpec,
  type LinearGeometry,
  type AngularSpec,
  type AngularGeometry,
  type PlanarSpec,
  type PlanarGeometry,
  type RangeGeometry,
  type SpatialGeometry,
  type ColorPlaneGeometry,
  type PositionedPoint,
  type RadialGeometry,
  type HitArea,
  type Orientation,
} from './geometry'

export {
  clamp,
  wrap,
  quantize,
  magnet,
  precision,
  coarse,
  deadZone,
  velocitySensitive,
  accelerate,
  decelerate,
  resistance,
  friction,
  inertiaRequest,
  springRequest,
  overshoot,
  recoil,
  axisLock,
  elasticity,
  compose,
  defineModifier,
  composeModifiers,
  standard,
  type Modifier,
  type ModifierContext,
  type ModifierDefinition,
  type ModifierPipeline,
} from './modifiers'

export {
  SPRING,
  INERTIA,
  PHYSICS_PROFILES,
  stepSpring,
  stepInertia,
  stepPhysicalState,
  settlePhysicalState,
  reduceMotionProfile,
  collideBounds,
  nearestDetent,
  detentForce,
  springAtRest,
  elasticBound,
  type SpringConfig,
  type SpringState,
  type InertiaConfig,
  type PhysicsProfile,
  type PhysicalState,
} from './physics'

export {
  GestureTracker,
  InteractionTracker,
  intentFromKey,
  intentFromWheel,
  keysOf,
  NO_KEYS,
  type Intent,
  type IntentKind,
  type SemanticAction,
  type ModifierKeys,
  type PointerLike,
  type KeyLike,
} from './interaction'

export {
  ControlBehavior,
  type ControlSpec,
  type ControlState,
  type ControlFlags,
  type ControlSnapshot,
} from './behavior'

export {
  ComponentRegistry,
  ControlRegistry,
  densityFor,
  defineMeta,
  type ParameterKind,
  type PresentationContext,
  type InputModality,
  type ComponentImportance,
  type PresentationEntry,
  type ResolveQuery,
  type ComponentQuery,
  type Density,
  type ComponentMeta,
} from './registry'

export {
  LATTICE,
  defineLayout,
  cellSpan,
  cellsForWidth,
  snapToLattice,
  allocate,
  presentationForCells,
  presentationForWidth,
  layoutMatchesContext,
  adaptivePresentation,
  type LatticeScale,
  type Cells,
  type LatticeContext,
  type LayoutMetadata,
  type AllocationRequest,
  type Allocation,
  type Presentation,
} from './lattice'
