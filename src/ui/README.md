# src/ui — the ARTINOS UI system

One flat system. Every component is a sibling folder; `system/` is the
foundation they all stand on.

```
system/          the foundation, imported once at the app root (system.css)
                 fonts · tokens · themes · materials · anatomy (well, insert, seam, text)
                 utils · hooks · options · Theme · RollingValue

Slider           Slider + RangeSlider (with the precision engine and HUD)
NumberField  Switch  ToggleGroup  Segmented  ColorField  Select
Panel            Panel + Section + Field
Tabs
Button  IconButton  TextField  FileDrop  Knob  XYPad
Badge  Meter  Sparkline  Kbd
PropertyRow  Toolbar
Menu  Dialog  Toast  Tooltip  CommandPalette
MetaBlock        the dock engine
NodeGraph        the node editor
```

## Using it

```tsx
// once, at the app root
import './ui/system/system.css'

// then any component, by path
import { Slider } from './ui/Slider/Slider'
import { Button } from './ui/Button/Button'
```

A theme is an attribute: `data-ar-theme="frost-deep"` on any element (or
`<ArtinosTheme>` from `system/Theme.tsx`). The studio sets it on `<html>`.

## Rules

- **One folder per component**: `Name/Name.tsx` + `Name.css`, and the component
  imports its own stylesheet. It imports nothing but React, its own folder and
  `../system/`. To reuse one elsewhere, copy its folder and `system/`.
- **No barrels.** Import a component by its path.
- **Tokens** are `--ar-*`, defined in `system/tokens.css`, `themes.css` and
  `materials.css`. A component reads them and never hard-codes a colour.
- **Class names** carry the system prefix: `ar-slider`, `ar-button`, `ar-menu`.
- **Three materials**: a *well* for anything editable or recessed (select,
  number, text field, meter, key cap), an *insert* for anything you press or
  that moves (slider fill, switch knob, button, segmented option), and the
  *float* sheet for anything portalled (select list, menu, dialog, toast,
  tooltip, palette).
- **Type**: labels and readouts in the mono (`--ar-control-font`), body text in
  the UI face (`--ar-font-ui`) at weight 300.
- **Accent**: the signal teal (`--ar-signal`), used for live states, fills and
  focus only.

Reference: `docs/ui/components.md` (every prop) and `docs/ui/theming.md`.
