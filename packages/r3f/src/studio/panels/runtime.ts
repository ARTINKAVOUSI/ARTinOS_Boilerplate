/**
 * Panels that read the runtime directly and need no project wiring.
 *
 * Kept apart from `panels/index.ts` because the project-facing panels import these
 * through `foundation`, and a single barrel would close that loop.
 */
export { ParametersPanel } from './ParametersPanel'
export { SignalsPanel } from './SignalsPanel'
export { ResourcesPanel } from './ResourcesPanel'
export { QualityPanel } from './QualityPanel'
export { HistoryPanel } from './HistoryPanel'
export { ConsolePanel } from './ConsolePanel'
export { ModulesPanel } from './ModulesPanel'
export { AgentPanel } from './AgentPanel'
export { ObjectInspectorPanel } from './ObjectInspectorPanel'
export { InspectorPanel } from './InspectorPanel'
export { TelemetryPanel } from './TelemetryPanel'
export { ThreeInspectorPanel } from './ThreeInspectorPanel'
export { RuntimeHUD } from './RuntimeHUD'
export { formatValue, formatBytes, compactNumber, describeResource, groupBy } from '@artinos/ui'
