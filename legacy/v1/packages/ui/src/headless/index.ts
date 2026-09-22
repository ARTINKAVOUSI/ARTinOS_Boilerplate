/**
 * Headless behaviours — hooks and pure functions with no markup and no styling.
 *
 * Everything here is React-only: no runtime import, no three, no CSS. Primitives and
 * shell components compose these instead of each re-solving scrolling, matching,
 * persistence and dismissal.
 */
export { fuzzyMatch, fuzzyFilter, splitRanges, type FuzzyMatch } from './fuzzy-match'
export { useVirtual, type VirtualOptions, type VirtualWindow } from './use-virtual'
export { useThrottledRevision, usePoll, type RevisionStore } from './use-revision'
export { usePersistentState, usePersistentValue } from './use-persistent-state'
export { useDismiss, useShortcut, type Shortcut } from './use-dismiss'
export { workspacePortalTarget } from './workspace-portal'
export { useFocusScope, type FocusScopeOptions } from './use-focus-scope'
export { useRovingCollection, filterCollection, type CollectionItem, type RovingCollection } from './use-collection'
export { useVariableVirtual, type VariableVirtualOptions, type VariableVirtualWindow } from './use-variable-virtual'
