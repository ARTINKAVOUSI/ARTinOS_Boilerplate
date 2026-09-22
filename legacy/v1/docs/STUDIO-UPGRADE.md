# Studio upgrade audit — 1.4

## Scope

This pass upgrades the shared ARTINOS studio used by UI Platform, Boilerplate and other `studio`/`panels` projects. It preserves the existing renderer, scene engine, MetaBlock docking and authored project values. VOLUMA has a separate custom overlay; its fluid solver and custom panels have not been rebuilt in this pass.

## What changed

| Area | Upgrade |
| --- | --- |
| All 11 studio panels | Common panel header, contextual guide, error recovery, clearer typography, focus states, responsive spacing and shared card layouts. |
| Dock | Expand/restore action for the dock workspace; clearer tab labels and compact footer text. |
| Inspector | Responsive collapsible parameter groups; separate named-preset area; favorites/pins; scope capture to visible controls; meaningful empty states. |
| Parameter controls | Free text no longer resolves to an empty select. Enum labels retain their authored labels and typed values. Large enums use a select. Dial mapping and autofocus are implemented. Read-only controls are inert. |
| Numeric/vector inputs | Keep incomplete input local, preserve values when cleared, clamp committed numbers, format floating-point values for display, support Enter and Escape. |
| Scene | Categorized controls, advanced disclosure, switch-dependent fog/grid/background/camera/shadow controls, camera view feedback and saved view removal persistence. |
| PostFX | Effect library and active stack, actual order sorting, individual switches, clear bypass status, undoable effect ordering, removal of the expensive blanket enable-all action. |
| InputFlow | Device cards and connection states, monitor sections, replay/record states, source validation, operation-specific limits, persisted route/action removals. |
| Signals | Source filter, searchable values, freeze/resume monitor and clearer rows. |
| Timeline | Editable keys, per-key easing, loop toggle, duration scaling, duplicate-time replacement, clear insertion-time label. |
| Assets | Keyboard-accessible chooser, previews, names/types/sizes, filters and resource removal. |
| Library | Clearer cards, copy-path feedback; removes a fake import with no imported symbol. |
| Console | Search, severity counts including debug, pause/resume display, expandable complete messages and attached diagnostic data. |
| Telemetry | Performance overview, resource view and native renderer inspector as separate views. |
| Graph / UI DevTools | Shared presentation and guide; retain their existing specialist editors. |
| Project | Save/restore/import/export feedback and clear descriptions; removes the redundant destructive clear-snapshot action. |

## Build and maintenance

- The baseline `tsc -b` failed in the Three/R3F JSX declarations. `preserveSymlinks` keeps pnpm-linked declarations resolving against the workspace dependencies. App typechecking and the complete build then passed without suppressing errors or changing rendering versions.
- Root package is version 1.4.0. Rendering dependencies remain as declared; no speculative alpha upgrade was performed.
- Replaced missing `doctor`/`check:packages` scripts with a real workspace verifier. `clean` uses TypeScript's own build cleanup.
- Removed the missing initializer and no-op postinstall reference to an absent asset setup script.
- Added a small test loader and eight regression tests covering control selection, readable options, tab accessibility and numeric boundaries.
- Replaced fixed-height Inspector rows with natural-height cards so curves, envelopes and vectors do not overlap. Rows remain individually subscribed; offscreen cards use browser content visibility.
- Removed obsolete Inspector row-height code and incorrect hard-coded scene footer metadata.

## Verification

- `npm test`: 8 tests passed.
- `npm run doctor`: workspace export and installed dependency checks passed.
- `npm run build`: TypeScript project build and Vite production bundling passed.
- Browser verification uses the production preview at port 5182 with the UI Platform project.

## Practical limits / follow-up work

- The rendering bundle remains about 3 MB before gzip and Vite reports its size. Further reduction requires measuring optional Three/Drei/inspector imports and isolating project modules; it is not solved by raising the warning threshold.
- The custom VOLUMA overlay still needs its own UI pass. Its fixed transform readouts, decorative timeline and audio/capture error handling were identified during inspection but are outside the shared-panel implementation.
- Development hot reload during renderer teardown can expose an existing R3F inspector lifecycle error; a clean reload recovers. Production startup is checked separately.
- Device permission and actual camera/microphone hardware streams need a user-assisted device test. This pass does not request permissions during browser verification.
- The test-only synchronous module hook requires Node 22.15+, while the existing app tooling supports Node 20+. The active workspace uses Node 24.
- The workspace has no Git repository. Pre-edit UI files and the original root README/package/config are preserved in `.upgrade-backup`; that is a local recovery copy, not version control.

## Reference

React Three Fiber's documented type extension model was checked while diagnosing the baseline failure: https://r3f.docs.pmnd.rs/api/typescript. The actual fix was verified against the installed workspace declarations.
