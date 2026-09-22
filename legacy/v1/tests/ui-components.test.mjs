import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// Render with the React copy the components themselves resolve. A workspace package can
// carry its own node_modules, and a second React breaks every hook with "invalid hook call".
const require = createRequire(new URL('../packages/ui/package.json', import.meta.url))
const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
import { Slider } from '../packages/ui/src/primitives/numeric.tsx'
import { Segmented, Tabs, Toggle } from '../packages/ui/src/primitives/choice.tsx'
import { Pane } from '../packages/ui/src/primitives/pane.tsx'
import { Collapsible } from '../packages/ui/src/primitives/actions.tsx'

const noop = () => {}
const count = (html, pattern) => (html.match(pattern) ?? []).length

test('capsule readout carries its unit as a quiet suffix, as the reference does', () => {
  const worded = renderToStaticMarkup(createElement(Slider, { label: 'Depth', value: 5.6, min: 0, max: 20, step: 0.1, unit: 'mm', onChange: noop }))
  assert.match(worded, /<span>5\.6<\/span><i>mm<\/i>/)
  assert.match(worded, /aria-valuetext="5\.6mm"/)
  const symbol = renderToStaticMarkup(createElement(Slider, { label: 'Transmission', value: 72, min: 0, max: 100, step: 1, unit: '%', onChange: noop }))
  assert.match(symbol, /aria-valuetext="72%"/)
})

test('capsule groups kelvin by thousands', () => {
  const html = renderToStaticMarkup(createElement(Slider, { label: 'Temperature', value: 5600, min: 2000, max: 10000, step: 50, unit: 'K', onChange: noop }))
  assert.match(html, /<span>5 600<\/span><i>K<\/i>/)
})

test('capsule draws its name and value in both inks, with one live readout and one mirror', () => {
  const html = renderToStaticMarkup(createElement(Slider, { label: 'Roughness', value: 0.14, min: 0, max: 1, step: 0.01, onChange: noop }))
  assert.equal(count(html, /class="artinos-range-text"/g), 2)
  assert.match(html, /data-ink="off"/)
  assert.match(html, /data-ink="on"/)
  assert.equal(count(html, /data-live-mirror=""/g), 1)
  // the full capsule, name inside, is the default layout
  assert.match(html, /data-layout="inline"/)
  assert.match(html, /artinos-range-name">Roughness</)
})

test('compact capsule is marked for the 19px body', () => {
  const html = renderToStaticMarkup(createElement(Slider, { label: 'Softness', value: 64, min: 0, max: 100, step: 1, size: 'compact', onChange: noop }))
  assert.match(html, /data-size="compact"/)
})

test('capsule renders the modulation marker only when it can change, and marks the bound state', () => {
  const plain = renderToStaticMarkup(createElement(Slider, { label: 'Focus', value: 8, min: 0, max: 20, onChange: noop }))
  assert.doesNotMatch(plain, /artinos-pin/)
  const pinned = renderToStaticMarkup(createElement(Slider, { label: 'Focus', value: 8, min: 0, max: 20, pinned: true, onPinnedChange: noop, onChange: noop }))
  assert.match(pinned, /aria-label="Pin Focus" aria-pressed="true"/)
  assert.match(pinned, /data-trailing=""/)
})

test('row layout keeps the name in its own column', () => {
  const html = renderToStaticMarkup(createElement(Slider, { label: 'Focus', value: 8, min: 0, max: 20, layout: 'row', onChange: noop }))
  assert.doesNotMatch(html, /class="artinos-field artinos-slider" data-layout/)
  assert.match(html, /artinos-field-label"[^>]*>Focus</)
})

test('segmented carries an insert placed from the pressed index', () => {
  const html = renderToStaticMarkup(createElement(Segmented, { label: 'Quality', value: 'Studio', options: ['Draft', 'Studio', 'Final'], onChange: noop }))
  assert.match(html, /--seg-index:\s*1/)
  assert.match(html, /--seg-count:\s*3/)
  assert.match(html, /artinos-segmented-thumb/)
  // A single option has nothing to travel between, so it keeps the plain pressed surface.
  const single = renderToStaticMarkup(createElement(Segmented, { label: 'Mode', value: 'Solo', options: ['Solo'], onChange: noop }))
  assert.doesNotMatch(single, /artinos-segmented-thumb/)
})

test('tabs select one tab and keep one keyboard entry', () => {
  const html = renderToStaticMarkup(createElement(Tabs, { value: 'b', items: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }], onChange: noop }))
  assert.equal(count(html, /aria-selected="true"/g), 1)
  assert.equal(count(html, /tabindex="0"/g), 1)
})

test('toggle is a real switch carrying its state and a knob', () => {
  const html = renderToStaticMarkup(createElement(Toggle, { label: 'Shadows', value: true, onChange: noop }))
  assert.match(html, /role="switch"/)
  assert.match(html, /aria-checked="true"/)
  assert.match(html, /artinos-switch-knob/)
})

test('pane draws its path under the title and no serial', () => {
  const html = renderToStaticMarkup(createElement(Pane, { index: 3, title: 'Lighting', meta: 'Scene / Light', status: 'live' }, 'body'))
  assert.match(html, /artinos-pane-title">Lighting</)
  assert.match(html, /artinos-pane-path">Scene \/ Light</)
  assert.match(html, /aria-label="Lighting"/)
  assert.match(html, /class="artinos-dot"/)
  assert.doesNotMatch(html, />03</)
})

test('folder renders as a native disclosure that honours its initial state', () => {
  const closed = renderToStaticMarkup(createElement(Collapsible, { title: 'Volume', defaultOpen: false }, 'content'))
  assert.match(closed, /^<details class="artinos-folder"><summary>Volume<\/summary>/)
  const open = renderToStaticMarkup(createElement(Collapsible, { title: 'Material' }, 'content'))
  assert.match(open, /<details class="artinos-folder" open="">/)
})
