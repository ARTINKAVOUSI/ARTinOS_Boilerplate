# ARTINOS v2 — how this project is built

Every capability here is a **copy-pastable unit**: add it by pasting a file or a
folder, remove it by deleting that file or folder. Nothing else in the project
has to be edited either way. Follow
`.claude/skills/copy-pastable-reusable-react/SKILL.md` for any new component,
feature, panel or port — it is the contract, not a suggestion.

## The four unit shapes

| Unit | Lives in | Shape | Discovered by |
|---|---|---|---|
| Feature (scene object, effect, input device, overlay, provider) | `src/features/**/Name.tsx` | one file exporting a component + a `feature` manifest | `import.meta.glob('../features/**/*.tsx')` in `src/app/registry.ts` |
| Panel (a dock tab) | `src/panels/Name.tsx` | one file exporting a component + a `panel` manifest | `import.meta.glob('../panels/*.tsx')` in `src/app/panel.ts` |
| UI component | `src/ui/Name/Name.tsx` (+ `Name.css`) | one folder, no imports outside itself | imported directly |
| System | `src/app/*.ts` | a plain module with an external store | imported directly |

A manifest is what makes a file self-installing: `id`, `label`, `kind`, `group`,
`controls`, `order`. The dock, the palette, the panels and the persisted state
all read from it. Nothing keeps a central list of features, effects or panels —
if you find yourself editing a list to register something, the design is wrong.

## Rules that keep it copy-pastable

1. **No barrels, no registries, no plugin pipeline.** A file is found by glob or
   imported by path.
2. **A unit imports only: npm packages, `src/app/*` contracts, `src/ui/*`
   components, and files in its own folder.** A feature never imports another
   feature (the one declared host: effects and the glass material import
   `features/postfx/PostFX.tsx`); a panel never imports another panel; a
   `src/ui` component never imports anything outside its own folder; and
   `src/app` never imports a feature, so deleting any feature can't break the
   host. Shared live state (the signal bus, the shared webcam) is a system in
   `src/app/`.
3. **Files under `src/features/` never import `app/store` or `app/registry`.**
   The registry loads every feature file, so that import is circular (it
   crashes at startup). Values come in as props; a studio section a feature
   folder ships for itself is an `inspector` export (see `FeatureInspector` in
   `app/feature.ts`) and gets its state as props too.
4. **Modest duplication beats shared infrastructure.** A helper used by one
   effect lives in that effect.
5. **Styling travels with the unit.** Component CSS sits beside the component
   and is scoped to it. Studio tokens are the skin, and a `src/ui` component
   must render correctly without them (local fallbacks for every CSS variable).
6. **R3F components mount inside the host's `<Canvas>`** and never create their
   own; graphics default to TSL on the WebGPU renderer.
7. **Clean up everything on unmount** — loops, workers, subscriptions, GPU
   resources. Deleting a feature file must leave no trace behind.
8. **Every control is declared in the manifest**, so it appears in the panel,
   the palette search, presets and the saved state with no extra wiring.

## Porting work

When bringing a capability over from the original v1 workspace (archived in
`legacy/v1/`, and at the git tag `v1.4-final`), port
the *behaviour*, not the architecture: the original's registries, providers and
cross-package imports are exactly what this rebuild removes. The result is one
file or one folder in the table above, self-contained and deletable.

`docs/PLAN.md` holds the full architecture and the porting status.
