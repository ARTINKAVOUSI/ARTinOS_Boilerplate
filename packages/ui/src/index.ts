/**
 * `@artinos/ui` — controls, panels and the workspace shell.
 *
 * Four layers, each usable on its own:
 *
 *   headless    behaviours only (matching, virtualization, persistence, dismissal)
 *   primitives  styled controls — no runtime dependency except `ParameterControl`
 *   shell       workspace, docking, panel system, command palette
 *   panels      runtime-bound views
 *
 * Import from `@artinos/ui` for everything, or from `@artinos/ui/primitives` and
 * `@artinos/ui/headless` to use the control kit in a project with no ARTINOS runtime.
 */
export * from './kernel'
export * from './design'
export * from './meta'
export * from './devtools'
export { useControl, type ControlBinding, type ControlScheduler, type UseControlOptions } from './react/use-control'
export { useLattice, type LatticeView } from './react/use-lattice'
export { ComponentRenderer, reactPresentations, type ComponentRendererProps, type ReactPresentation, type ReactPresentationMap } from './react/render-component'
export * from './adapters/three'
export * from './adapters/scene-schema'
export { useParameter, useResolvedParameter, useParameterWriter, useMultiParameter, useParameterIds, isParameterLocked, type ParameterView, type MultiParameterView, type ParameterStatus } from './react/use-parameter'
export * from './headless'
export * from './primitives'
export * from './shell'
export * from './hooks'
export { useRuntimeCommands } from './hooks/use-runtime-commands'
export * from './panels/runtime'
export * from './panels'
export { TOKENS, TOKEN_GRAPH, THEMES, tokenManifest, emitTokenCSS, token, resolveToken, applyTokens, applyTheme, setUIContexts, type ThemeId, type UIContextId, type TokenGroup, type TokenName } from './theme'
export { Showcase } from './showcase/Showcase'
export { TokenStudio, TOKEN_GROUPS } from './showcase/TokenStudio'
