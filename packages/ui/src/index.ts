/**
 * `@artinos/ui` — a self-contained React design system: tokens, controls and the
 * workspace shell. It depends on React alone; nothing here knows about a runtime.
 *
 *   headless    behaviours only (matching, virtualization, persistence, dismissal)
 *   primitives  styled controls
 *   shell       workspace, docking, panel system, command palette
 *
 * Runtime-bound panels live in `@artinos/r3f`, which composes this package with the
 * ARTINOS runtime.
 */
export * from './kernel'
export * from './design'
export * from './devtools'
export { useControl, type ControlBinding, type ControlScheduler, type UseControlOptions } from './react/use-control'
export { useLattice, type LatticeView } from './react/use-lattice'
export { ComponentRenderer, reactPresentations, type ComponentRendererProps, type ReactPresentation, type ReactPresentationMap } from './react/render-component'
export * from './headless'
export * from './primitives'
export * from './shell'
export { formatValue, formatBytes, compactNumber, describeResource, groupBy } from './format'
export { TOKENS, TOKEN_GRAPH, THEMES, tokenManifest, emitTokenCSS, token, resolveToken, applyTokens, applyTheme, setUIContexts, type ThemeId, type UIContextId, type TokenGroup, type TokenName } from './theme'
/* The design system presents itself in one page: UIStudio holds the foundations,
   every component, the patterns, the reference workbench and the theme editor.
   Workbench stays exported on its own because it is also the acceptance test —
   it is measured against UI PROTOTYPES/workbench.html outside the studio. */
export { UIStudio } from './showcase/UIStudio'
export { Workbench } from './showcase/Workbench'
export { overridesToCSS, TOKEN_CONTROLS, type ThemeState } from './showcase/studio/ThemeEditor'
