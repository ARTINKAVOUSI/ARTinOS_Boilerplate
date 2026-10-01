# ARTINOS UI — theming

Contents: picking a theme · solid vs glass · density · token layers · overriding tokens · custom themes (Theme Studio) · finish overrides · key tokens

## Picking a theme

A theme is the whole look: ground, ink, accent colours, panel glass and the finish of every control. There is no second setting to coordinate. Get the full current list, grouped by family, from the ARTINOS UI package folder:

```bash
node "D:/CODES26/ARTINOS-R3F/UI COMPONENT PACKAGE/artinos.mjs" list
```

Inside a project that already has a kit, `THEMES` / `THEME_META` from the kit's `index.ts` (or the header of its `tokens/themes.css`) list exactly the themes that kit contains.

Families (ids in brackets are examples):
- **untinted glass / frost** — clear transmission, no colour of their own; the colour is whatever is behind (`clear-air`, `clear-polished`, `clear-lens`, `clear-layered`, `frost-etched`, `frost-silk`, `frost-mist`, `frost-deep` — the showcase default). ARTINOS accents: teal signal, azure bind, amber warn, rose fault.
- **atelier glass / frost** — coordinated palettes (`nocturne`, `lagoon`, `argent`, `garnet`, `ivory`, `glacier`, `wisteria`, `dune`).
- **studio / signature** — solid grounds (`studio` default + base, `studio-light`, `optical`, `reference`).
- **glass / frost** — clean panes (`glass`, `glass-light`, `glass-dark`, `crystal`, `frost`, `frost-light`, `frost-dark`, `ice`).
- **optical glass / frost** — neutral panes, glossy pearl or translucent fills (`pane`, `pane-light`, `lucid`, `gallery`, `satin`, `monolith`, `opal`, `graphite`).
- **luxe glass / frost** — coloured premium panes with metallic hairlines (`onyx`, `sapphire`, `platinum`, `diamond`, `emerald`, `rose-gold`, `cognac`, `amethyst`, `champagne`, `pearl`, `alabaster`, `porcelain`, `jade`, `moonstone`, `cashmere`, `velvet`).

The ids must exist in the kit's `tokens/themes.css`. A kit exported with `--themes satin` does **not** contain `onyx`. Re-export with the extra theme instead of hand-copying CSS blocks, because theme finishes live in two files and share rules:

```bash
node "D:/CODES26/ARTINOS-R3F/UI COMPONENT PACKAGE/artinos.mjs" export --project . --themes satin,onyx --components <the same list> --force
```

Match the theme to the host: dark apps → studio, untinted, atelier-glass, luxe glass; light apps → `studio-light`, `glass-light`, `frost-light`, `pane-light`, `argent`, `ivory`, `porcelain`, `pearl`; over a 3D canvas, video or photo → any glass/frost theme.

## Solid vs glass

`THEME_META[id].kind` is `'solid'` or `'glass'`.
- **Solid** themes paint their own ground. Use `<ArtinosTheme theme="studio" ground>` on the page or panel container.
- **Glass** themes are panes: their panels (`Panel`) use `backdrop-filter` over whatever is behind. They look right over imagery, video or a live canvas. Over a flat colour they look like a flat tinted card; that's expected. Don't add `ground` to a glass scope that should show the scene through it.

For React Three Fiber: the controls are DOM. Put them in an HTML overlay positioned above the `<Canvas>` (a sibling `div` with `position: absolute`), not inside the Canvas tree — the glass then blurs the rendered scene. If you must attach UI to 3D objects, drei `<Html>` works, but keep the overlay approach for inspector panels.

## Density

`dense` (24px) · `standard` (26px, default) · `comfort` (30px). Per control: `density="dense"`. Per scope: `<ArtinosTheme density="comfort">` or `data-ar-density="comfort"`. Type size, padding and radii follow.

## Token layers

Three layers, each reading only the one above it:

| layer | examples | file |
|---|---|---|
| primitives | `--ar-ink-*`, `--ar-teal-*`, `--ar-azure-500` | `tokens.css` |
| roles | `--ar-bg-app`, `--ar-text-hi`, `--ar-signal`, `--ar-panel-tint` | `tokens.css` (studio) + `themes.css` |
| control finish | `--ar-insert`, `--ar-seam`, `--ar-trough`, `--ar-insert-ink` | `materials.css` |

Components read tokens, never literal colours. So restyling is always "set tokens on a scope", never "edit a component".

## Overriding tokens

Inline on any scope (short names get the `--ar-` prefix):

```tsx
<ArtinosTheme theme="frost-deep" tokens={{ signal: '#FF4FA3', 'signal-hi': '#FFB3D6' }}>…</ArtinosTheme>
```

Or in CSS, loaded after `src/ui/system/system.css`:

```css
.brand[data-ar-theme='frost-deep'] { --ar-signal: #ff4fa3; --ar-signal-hi: #ffb3d6; }
```

The live seam, LEDs and focus ring derive from `--ar-signal` (the live seam is `color-mix(in srgb, var(--ar-signal) 78%, #000)`), so changing the signal recolours all of them. Some themes pin their seam or LED colours in their finish; if a signal change doesn't reach them, also set `--ar-seam-active` / `--ar-led-on`.

## Custom themes (Theme Studio)

For a real custom look, use the Theme Studio in the showcase (`showcase/artinos-ui-showcase.html#studio` next to the package). It edits every token live against the full component gallery and exports a standalone CSS block with every resolved token:

```css
[data-ar-theme='my-theme'] { --ar-signal: #ff4fa3; /* …every token… */ }
```

Add it to a kit by re-exporting with `--custom my-theme.css` (it lands in `src/ui/system/custom-themes.css`, imported by `system.css`), then `<ArtinosTheme theme="my-theme">`. `theme` accepts any name. A custom theme is independent: it doesn't need its base theme in the kit.

## Finish overrides (advanced)

Each theme already has its control finish. To force another on one control or scope: `material="optical" | "reference" | "soft" | "frost" | "milk" | "clear" | "tint" | "smoked" | "metal"` (or `data-ar-material`). Kits exported with `--no-materials` don't contain these.

## Key tokens

Roles (theme level):
- ground and surfaces: `--ar-bg-app`, `--ar-bg-surface`, `--ar-bg-raised`, `--ar-bg-well`, `--ar-bg-hover`, `--ar-bg-active`
- ink: `--ar-text-hi`, `--ar-text-mid`, `--ar-text-low`, `--ar-text-faint`, `--ar-text-ghost`
- lines: `--ar-line-subtle`, `--ar-line`, `--ar-line-strong`, `--ar-tick`, `--ar-tick-major`
- accents: `--ar-signal`, `--ar-signal-hi`, `--ar-signal-line`, `--ar-signal-wash`, `--ar-signal-ink`, `--ar-bind`, `--ar-warn`, `--ar-fault`, `--ar-focus-ring`
- panel glass: `--ar-panel-tint`, `--ar-panel-blur` (a `backdrop-filter` value), `--ar-panel-sheen`, `--ar-panel-shadow`, `--ar-panel-text-shadow`
- floating layers (HUD, Select list): `--ar-float-bg`, `--ar-float-ring`, `--ar-float-shadow`, `--ar-float-ink`, `--ar-float-ink-low`
- type and radii: `--ar-font-ui`, `--ar-font-num`, `--ar-radius-control`, `--ar-radius-card`, `--ar-radius-panel`, `--ar-radius-shell`
- size (density-driven): `--ar-h`, `--ar-label-size`, `--ar-value-size`, `--ar-pad-x`, `--ar-gap`
- motion: `--ar-dur-state`, `--ar-dur-value`, `--ar-dur-surface`, `--ar-dur-layout`, `--ar-ease`

Control finish (materials level):
- well: `--ar-trough`, `--ar-trough-backdrop`, `--ar-well`, `--ar-inset`, `--ar-radius` (7px)
- insert: `--ar-insert`, `--ar-insert-shadow`, `--ar-insert-backdrop`, `--ar-insert-radius` (6px), `--ar-insert-ink`, `--ar-insert-unit-ink`, `--ar-insert-text-shadow`, `--ar-insert-off-filter`
- ink off the insert: `--ar-label-ink`, `--ar-value-ink`, `--ar-unit-ink`, `--ar-off-ink`, `--ar-base-text-shadow`
- seam (handle): `--ar-seam`, `--ar-seam-hover`, `--ar-seam-active`, `--ar-seam-w`, `--ar-seam-offset` (8px from the fill end), `--ar-seam-scale`, `--ar-seam-glow`
- LEDs, cells, gradients, ruler: `--ar-led-on`, `--ar-led-off`, `--ar-led-glow`, `--ar-cell`, `--ar-cell-shadow`, `--ar-grad-well`, `--ar-ruler-ink`, `--ar-index`
- typography of controls: `--ar-control-font`, `--ar-label-weight`, `--ar-value-weight`, `--ar-label-tracking`, `--ar-label-case`
- Select list: `--ar-list-bg`, `--ar-list-backdrop`, `--ar-list-insert`, `--ar-list-hover`, `--ar-list-ink`
