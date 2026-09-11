import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { controls } from '../packages/ui/src/primitives/control-registry.ts'
import { Segmented, Select, Tabs } from '../packages/ui/src/primitives/choice.tsx'


test('free-text parameters render as text at every panel width', () => {
  for (const width of [100, 320, 1440]) assert.equal(controls.resolveControl({ type: 'string', width }).id, 'text')
})
test('enum controls adapt to available width', () => {
  assert.equal(controls.resolveControl({ type: 'enum', width: 100 }).id, 'select')
  assert.equal(controls.resolveControl({ type: 'enum', width: 400 }).id, 'segmented')
})
test('explicit dial and meter presentations remain available', () => {
  assert.equal(controls.resolveControl({ type: 'number', width: 300, hint: 'dial' }).component, 'dial')
  assert.equal(controls.resolveControl({ type: 'number', width: 300, hint: 'meter' }).component, 'meter')
})
test('segmented options preserve readable labels and selected numeric values', () => {
  const html = renderToStaticMarkup(createElement(Segmented, { label: 'Quality', value: '2', options: [{ label: 'Draft', value: 1 }, { label: 'Studio', value: 2 }], onChange() {} }))
  assert.match(html, /aria-pressed="true"[^>]*>Studio/)
  assert.match(html, />Draft</)
})
test('tabs expose one keyboard entry point', () => {
  const html = renderToStaticMarkup(createElement(Tabs, { value: 'b', items: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }], onChange() {} }))
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1)
  assert.match(html, /aria-selected="true"/)
})
test('select can preserve a boolean choice', () => {
  const html = renderToStaticMarkup(createElement(Select, { label: 'Mode', value: false, options: [{ label: 'Off', value: false }, { label: 'On', value: true }], onChange() {} }))
  assert.match(html, /value="false" selected="">Off/)
})

import { boundedNumber } from '../packages/ui/src/primitives/numeric-input.tsx'
test('blank and invalid numeric edits preserve the authored value', () => {
  assert.equal(boundedNumber('', .75, 0, 1), .75)
  assert.equal(boundedNumber('-', .75, -1, 1), .75)
  assert.equal(boundedNumber('Infinity', .75, 0, 1), .75)
})
test('numeric commits clamp to parameter limits and retain negative values', () => {
  assert.equal(boundedNumber('20', 0, -2, 2), 2)
  assert.equal(boundedNumber('-20', 0, -2, 2), -2)
  assert.equal(boundedNumber('-1.25', 0, -2, 2), -1.25)
})

test('select retains an explicit null option', () => {
  const html = renderToStaticMarkup(createElement(Select, { label: 'Target', value: null, options: [{ label: 'None', value: null }, { label: 'Scene', value: 'scene' }], onChange() {} }))
  assert.match(html, /value="null" selected="">None/)
})
