# ARTINOS UI — component API

Every control is **controlled** (`value` + `onChange`) or **uncontrolled** (`defaultValue`), and accepts `className`, `style`, `id` and the scope props `density` (`'dense' | 'standard' | 'comfort'`) and `material` (advanced finish override). Each is a named export of its own file: `src/ui/Slider/Slider.tsx`, `src/ui/Switch/Switch.tsx`, and so on.

Contents: Slider · RangeSlider · NumberField · Switch · ToggleGroup · Segmented · ColorField · Select · Panel / Section / Field · Tabs · RollingValue · ArtinosTheme · shared types · recipes

## Slider

The precision surface. The capsule is the control, the seam is the handle, the readout is the precision zone.

| prop | type | default | notes |
|---|---|---|---|
| `label` | string | | shown inside the capsule (`integrated`) or beside it (`paired`) |
| `value` / `defaultValue` | number | | |
| `onChange` | (v) => void | | live, every change |
| `onCommit` | (v) => void | | once, on release — use for expensive work |
| `min` / `max` | number | 0 / 1 | |
| `step` | number | 1% of range | keyboard / wheel increment |
| `steps` | number | | quantize to n values; `variant="stepped"` draws cells (default 6) |
| `detents` | number[] | | magnetic points (6px, 22px with Ctrl) |
| `mapping` | `'linear' \| 'log' \| 'exp' \| 'power' \| {to, from}` | linear | geometry only; value stays exact. `log` needs min > 0 |
| `origin` / `bipolar` | number / boolean | | fill grows from origin; bipolar = from 0 (or midpoint) |
| `format` | `'number' \| 'percent' \| 'db' \| 'angle' \| 'hz' \| 'time'` | number | percent shows v×100 |
| `decimals` | number | 2 | |
| `unit` | string | | quieter unit after the number |
| `formatter` | (v, decimals) => string \| {text, unit} | | overrides `format` |
| `variant` | `'material' \| 'stepped' \| 'gradient' \| 'ruler' \| 'curve' \| 'wave'` | material | |
| `gradient` | `'temperature' \| 'hue' \| 'saturate' \| 'exposure' \| {stops, describe}` | temperature | gradient variant |
| `describe` | (t, color, value) => string | | gradient caption while dragging |
| `layout` | `'integrated' \| 'paired'` | integrated | |
| `labelWidth` | number \| string | 106 | paired layout |
| `enabled` / `defaultEnabled` / `onEnabledChange` | boolean | true | parameter on/off |
| `toggleable` | boolean | true | double-click the body toggles enabled; `false` opts out. Passing it explicitly also shows the enable dot |
| `indicator` | boolean | | force the enable dot on/off |
| `precision` | 2 \| 3 | 3 | scrub levels: 1× · 0.1× (· 0.01×) |
| `span` / `marks` / `snapStep` | number / number[] / number | | ruler variant: visible span, magnetic marks, settle grid |
| `curve` | `'sigmoid' \| 'smooth' \| 'gamma' \| (x)=>number` | sigmoid | curve variant |
| `samples` | number[] (0..1) | | wave variant amplitudes |
| `status` | `'bound' \| 'automated' \| 'warn' \| 'fault'` | | semantic tint on seam and dot |
| `aria-label` | string | label | |

Interaction (built in, nothing to wire): press body = jump + drag · press within 13px of the seam = grab without jump · press the readout = precision scrub (vertical distance picks 1× / 0.1× / 0.01×, with HUD) · Alt fine · Shift ultra-fine · Ctrl snap · arrows/Home/End · wheel only when focused · double-click value or Enter/F2 = type a value (`47%`, `2.5k`, `-inf`, `90°`) · Esc cancels a drag · double-click body = off/on.

```tsx
<Slider label="Roughness" value={rough} onChange={setRough} />
<Slider label="Gain" format="db" min={-60} max={12} decimals={1} detents={[0]} onCommit={save} />
<Slider label="Cutoff" format="hz" min={20} max={20000} mapping="log" decimals={0} />
<Slider label="Pan" min={-1} max={1} bipolar />
<Slider variant="stepped" steps={5} label="Samples" min={1} max={5} decimals={0} />
<Slider variant="gradient" gradient="temperature" label="Temperature" />
<Slider variant="ruler" label="Focal" min={12} max={200} span={40} unit="mm" decimals={0} marks={[35, 50, 85]} snapStep={1} />
<Slider variant="curve" curve="smooth" label="Ease" />
```

## RangeSlider

An interval in the same capsule. Seam press grabs an end; press inside moves the whole span; press outside moves the nearest end. Each end is its own focusable slider. Typing accepts `0.2 – 0.7` or one number for the active end.

Props: `label`, `value` / `defaultValue` / `onChange` / `onCommit` with `RangeValue = [number, number]`, `min`, `max`, `step`, `steps`, `detents`, `mapping`, **`minSpan`** (smallest distance between ends, default 0), `format`, `decimals`, `unit`, `formatter`, `layout`, `labelWidth`, `enabled` / `defaultEnabled` / `onEnabledChange`, `toggleable`, `indicator`, `precision`, `aria-label`.

```tsx
const [band, setBand] = useState<RangeValue>([0.2, 0.7]);
<RangeSlider label="Band" value={band} onChange={setBand} minSpan={0.05} />
```

## NumberField

A recessed numeric cell. Drag to scrub (Alt 0.1×, Shift 10×), click/type to edit, arrows and wheel step.

Props: `label`, `value` / `defaultValue` / `onChange` / `onCommit`, `min`, `max`, `step`, `decimals`, `format`, `unit`, `formatter`, `pixelsPerStep` (default 4), `align` (`'center' | 'end'`), `disabled`, `aria-label`.

```tsx
<NumberField label="Width" value={w} onChange={setW} min={0} max={4096} decimals={0} unit="px" />
```

## Switch

`variant="shutter"` (default: the insert travels and the label sits on it) or `"compact"` (a small knob, no visible text — pair it with a `Field` label).

Props: `label` (text + accessible name), `labelOn`, `labelOff`, `value` / `defaultValue` (false) / `onChange(on)`, `variant`, `disabled`, `aria-label`.

```tsx
<Switch label="Shadows" defaultValue />
<Field label="Live update"><Switch variant="compact" label="Live update" value={live} onChange={setLive} /></Field>
```

## ToggleGroup

Independent flags in one well: LED chips or icon chips.

Props: `label`, `options: OptionInput[]`, `value` / `defaultValue` / `onChange` with **`V[]`**, `multiple` (default true; `false` = solo group that can be emptied), `led` (default true).

```tsx
<ToggleGroup label="Passes" options={['AO', 'SSR', 'BLOOM']} defaultValue={['AO']} />
```

## Segmented

One of n; the insert travels. Props: `label` (accessible name), `options`, `value` / `defaultValue` / `onChange` with a single `V`.

```tsx
<Segmented options={['LOW', 'MED', 'HIGH']} defaultValue="MED" label="Quality" />
```

## ColorField

The colour as the insert, ink follows luminance. Click the swatch for the native picker, or the hex to type.

Props: `label` (omit for a full-width swatch), `value` / `defaultValue` ('#00C8B3') / `onChange(hex)`, `alpha` (value becomes `#RRGGBBAA`, adds a scrubbable opacity readout). Hex is `#RRGGBB`.

## Select

Insert face or `appearance="well"`. The list portals to `<body>` (carrying the theme's tokens), with keyboard and type-ahead.

Props: `label` (placeholder + accessible name), `options: OptionInput[]`, `value` / `defaultValue` / `onChange`, `appearance` (`'insert' | 'well'`, default insert), `disabled`.

```tsx
<Select label="Output" options={[{ value: 'png', label: 'PNG' }, { value: 'exr', label: 'EXR' }]} value={fmt} onChange={setFmt} appearance="well" />
```

## Panel · Section · Field

- **Panel** — glass card. Props: `title`, `subtitle`, `actions` (header right), `tabs` (slot between header and body, e.g. `<Tabs>`), `footer` (foot status line), `as` (default `section`), `children`.
- **Section** — titled group with a hairline. Props: `title` (required), `count`, `collapsible`, `open` / `defaultOpen` (true) / `onOpenChange`, `heading` (`'caps'` mono uppercase, default · `'text'` UI font).
- **Field** — a label + control row. Props: `label` (required), `labelWidth` (default 72px via `--ar-field-label-w`), `children`.

```tsx
<Panel title="Material" subtitle="Optical body" footer="Ready">
  <Section title="Surface" count={3} collapsible>
    <Slider label="Transmission" defaultValue={0.72} format="percent" decimals={0} />
    <Field label="Preset"><Select options={['Neutral', 'Warm']} defaultValue="Neutral" appearance="well" /></Field>
  </Section>
</Panel>
```

## Tabs

A tab strip with a travelling underline. Props: `items: OptionInput[]`, `value` / `defaultValue` / `onChange`, `label` (list accessible name), `idBase` (ids: `${idBase}-tab-${v}` / `${idBase}-panel-${v}` — use it to wire `aria-controls` to your panels).

```tsx
<Panel title="Metablock" tabs={<Tabs items={['Scene', 'Studio', 'Detail']} value={tab} onChange={setTab} idBase="mb" />}>…</Panel>
```

## RollingValue

The odometer readout used inside the controls; only changed digits roll. Props: `text` (formatted number, required), `unit`, `dir` (1 up / -1 down), `fast`, `base` (canonical decimals, default 2).

## ArtinosTheme

Optional scope wrapper — sets `data-ar-theme`, `data-ar-density`, `data-ar-material` and inline tokens on one element. Props: `theme` (a built-in id **or any custom theme name** you have CSS for; default `studio`), `density`, `material`, `tokens` (overrides: `{ signal: '#ff4fa3' }` or full `--ar-*` names), `ground` (paint the theme's background and text colour — use for solid themes / full-page scopes), `as` (default `div`), plus any HTML attributes. Scopes nest. Without React: `<div data-ar-theme="frost-deep">`.

`themeStyle(tokens)` returns the same inline style object without the wrapper.

## Shared types and constants

- `OptionInput<V> = V | { value: V; label?: ReactNode; icon?: ReactNode; title?: string; disabled?: boolean }` — plain strings work for simple lists; icons replace text in ToggleGroup/Segmented.
- `THEMES`, `THEME_META[id]` (`label`, `family`, `kind: 'solid' | 'glass'`, `description`, `swatch: [ground, control, signal]`), `GLASS_THEMES`, `DENSITIES`, `MATERIALS`, `GRADIENTS`, `MAPPINGS`, `CURVES`, `formatValue`.
- Types: `ThemeName`, `Density`, `MaterialName`, `Format`, `Formatter`, `Mapping`, `Gradient`, `RangeValue`, `SliderVariant`, `SliderStatus`, `PrecisionLevels`, and every `…Props`.

## Recipes

**Theme picker from the kit's own list** (only the themes the kit contains):
```tsx
import { Select } from './ui/Select/Select';
import { THEMES, THEME_META } from './ui/system/utils';
<Select label="Theme" options={THEMES.map((t) => ({ value: t, label: THEME_META[t].label }))} value={theme} onChange={setTheme} appearance="well" />
```

**Parameter object → controls** (typical inspector):
```tsx
<Panel title="Light">
  {params.map((p) => (
    <Slider key={p.key} label={p.label} min={p.min} max={p.max} value={values[p.key]} onChange={(v) => set(p.key, v)} onCommit={() => persist()} />
  ))}
</Panel>
```
