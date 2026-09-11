# @artinos/ui

Controls, panels and the workspace shell.

Depends on: `@artinos/runtime`, `@artinos/graph`, `@artinos/inputflow`, `@artinos/modules`,
`react`, `react-dom`, `lucide-react`. Nothing else — no Radix, no Tailwind, no animation
library. That is enforced by `scripts/check-packages.mjs`.

## Four layers

| Layer | Import | Needs the runtime? |
| --- | --- | --- |
| `headless/` | behaviours only — fuzzy match, virtualization, persistence, dismissal | no |
| `primitives/` | styled controls — sliders, fields, lists, browsers | no (except `ParameterControl`) |
| `shell/` | workspace, docking, panel system, command palette | no |
| `panels/` | runtime-bound views | yes |

```tsx
import { definePanel, PanelWorkspace, ParametersPanel, RuntimeHUD, useRuntimeCommands } from '@artinos/ui'
import '@artinos/ui/theme.css'
import { Sliders } from 'lucide-react'

export function Shell({ viewport }) {
  useRuntimeCommands() // registers parameters, presets, modules and actions with the palette

  const panels = [
    definePanel({
      id: 'inspector',
      title: 'Inspector',
      icon: Sliders,
      description: 'Project parameters',   // shown in the palette
      keywords: ['controls', 'properties'],
      dock: 'bottom',
      content: <ParametersPanel projectOnly />,
    }),
  ]

  return <PanelWorkspace panels={panels} viewport={viewport} toolbarStatus={<RuntimeHUD embedded />} />
}
```

## Using the control kit without ARTINOS

`headless` and `primitives` are plain React. Import `@artinos/ui/theme.css` for the token
layer and use them in any project:

```tsx
import { ListBrowser, Slider } from '@artinos/ui/primitives'
import { fuzzyFilter, useVirtual } from '@artinos/ui/headless'
```

## Adding a panel

Declare it with `definePanel` and pass it to `PanelWorkspace`. It appears in the dock, the
rail and the command palette at once — there is no separate registration step.

## Panel layout

Every layout transition is a pure function in `shell/panel-layout.ts`
(`move`, `focus`, `soloInDock`, `resize`, …). Change behaviour there, not in a component.
