import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fitFrustum, MAX_COVER, FRONT_PAD, subjectScale, cameraComposition,
  COLLECTIONS, ALL_BUILTIN, THEMES, SPACES, CONTENTS, QUALITIES, LIGHT_MODES,
  ROOM_SCHEMA, SIM_SCHEMA, LIGHT_SCHEMA, STAGING_SCHEMA,
  DEFAULT_ROOM, DEFAULT_SIM, DEFAULT_LIGHT, DEFAULT_STAGING,
  resolvePreset, coerceRoomState, createDefaultState, applyTheme, applySpace, resetToTheme, captureRecipe,
  parseBundle, createBundle, mergeById, getSpace,
} from '../packages/scenes/src/adaptive-room/model/index.ts'
import { createBoundsChannel, coerceState, schemaEntries } from '../packages/scenes/src/core/index.ts'

const room = (patch = {}) => ({ ...DEFAULT_ROOM, ...patch })
const dimsFor = (p, fit) => ({ width: fit.width, height: p.height, depth: p.depth, totalDepth: p.depth + p.rearInset, radius: p.radius, wallThickness: p.wallThickness })

test('frustum never covers more than MAX_COVER of the room height', () => {
  for (const fov of [8, 20, 35, 60, 90, 110]) for (const margin of [0, .06, .28]) for (const distanceBias of [.3, 1, 2, 5]) for (const aspect of [.3, .5625, 1, 1.78, 2.4, 4]) {
    const p = room({ fov, margin, distanceBias })
    const fit = fitFrustum(p, aspect)
    assert.ok(fit.visH <= p.height * MAX_COVER + 1e-9, `fov ${fov} margin ${margin} bias ${distanceBias}`)
    assert.ok(fit.width >= fit.visW + FRONT_PAD - 1e-9, 'room is wider than the visible frustum')
    assert.ok(fit.dist > 0)
  }
})

test('room width grows with aspect while height-driven distance stays put', () => {
  const p = room()
  const narrow = fitFrustum(p, .5), wide = fitFrustum(p, 3)
  assert.ok(wide.width > narrow.width)
  assert.equal(wide.dist, narrow.dist)
})

test('camera composition bias stays inside the free vertical margin', () => {
  const p = room({ targetBias: .5 })
  const fit = fitFrustum(p, 1.78)
  const { centerY } = cameraComposition(p, p, fit)
  assert.ok(centerY + fit.visH / 2 <= p.height + 1e-9)
  assert.ok(centerY - fit.visH / 2 >= -1e-9)
})

test('subject scale is capped by the physical shell at any user multiplier', () => {
  const p = room({ subjectScale: 3 })
  const fit = fitFrustum(p, 1.78)
  const d = dimsFor(p, fit)
  for (const raw of [{ w: 1, h: 1, d: 1 }, { w: 40, h: 2, d: 2 }, { w: .001, h: 0, d: 0 }, { w: 1, h: 30, d: 1 }]) {
    const s = subjectScale(raw, p, d, fit)
    assert.ok(Number.isFinite(s))
    assert.ok(raw.w * s <= d.width - .25 + 1e-9 || raw.w < 1e-3)
    assert.ok(raw.h * s <= d.height - .25 + 1e-9 || raw.h < 1e-3)
  }
})

test('every built-in preset references existing theme, space, content and quality', () => {
  const ids = new Set()
  for (const preset of ALL_BUILTIN) {
    assert.ok(!ids.has(preset.id), `duplicate preset id ${preset.id}`); ids.add(preset.id)
    assert.ok(THEMES.some(t => t.id === preset.themeId), `${preset.id}: theme ${preset.themeId}`)
    assert.ok(CONTENTS.some(c => c.id === preset.envId), `${preset.id}: content ${preset.envId}`)
    if (preset.spaceId) assert.ok(SPACES.some(s => s.id === preset.spaceId), `${preset.id}: space ${preset.spaceId}`)
    if (preset.quality) assert.ok(QUALITIES.some(q => q.id === preset.quality), `${preset.id}: quality ${preset.quality}`)
    if (preset.light?.mode) assert.ok(LIGHT_MODES.some(m => m.id === preset.light.mode), `${preset.id}: mode ${preset.light.mode}`)
  }
  assert.equal(ALL_BUILTIN.length, COLLECTIONS.reduce((n, c) => n + c.presets.length, 0))
})

test('preset values are schema fields and within schema ranges', () => {
  const check = (schema, values, where) => {
    for (const [key, value] of Object.entries(values ?? {})) {
      if (['colorRingColors', 'mute', 'solo'].includes(key)) continue
      const d = schema[key]
      assert.ok(d, `${where}: unknown field ${key}`)
      if (d.type === 'number') assert.ok(value >= d.min && value <= d.max, `${where}.${key}=${value} outside ${d.min}..${d.max}`)
    }
  }
  for (const p of ALL_BUILTIN) {
    check(ROOM_SCHEMA, p.params, `${p.id}.params`)
    check(SIM_SCHEMA, p.sim, `${p.id}.sim`)
    check(LIGHT_SCHEMA, p.light, `${p.id}.light`)
    check(STAGING_SCHEMA, p.staging, `${p.id}.staging`)
  }
  for (const s of SPACES) check(ROOM_SCHEMA, s.overrides, `space ${s.id}`)
})

test('schemas cover every primitive default field', () => {
  for (const [schema, defaults] of [[ROOM_SCHEMA, DEFAULT_ROOM], [SIM_SCHEMA, DEFAULT_SIM], [LIGHT_SCHEMA, DEFAULT_LIGHT], [STAGING_SCHEMA, DEFAULT_STAGING]]) {
    for (const [key, value] of Object.entries(defaults)) {
      if (!['number', 'boolean', 'string'].includes(typeof value)) continue
      assert.ok(schema[key], `missing descriptor for ${key}`)
    }
    for (const [key] of schemaEntries(schema)) assert.ok(key in defaults, `descriptor without default: ${key}`)
    assert.deepEqual(coerceState(schema, defaults, defaults), defaults, 'defaults survive coercion')
  }
})

test('resolvePreset layers defaults, theme, space and preset params', () => {
  const preset = { id: 't', label: 'T', envId: 'sculpture', themeId: 'noir', spaceId: 'runway', params: { fov: 40 } }
  const s = resolvePreset(preset)
  const noir = THEMES.find(t => t.id === 'noir')
  assert.equal(s.room.color, noir.room)
  assert.equal(s.room.depth, getSpace('runway').overrides.depth)
  assert.equal(s.room.fov, 40, 'preset beats space override')
  assert.equal(s.qualityId, 'balanced')
  assert.equal(s.light.colorRingColors.length, 6)
})

test('legacy presets derive the light master from room params', () => {
  const s = resolvePreset({ id: 'l', label: 'L', envId: 'void', themeId: 'studio', params: { lightIntensity: 1.5, keyAzimuth: -40 } })
  assert.equal(s.light.master, 1.5)
  assert.equal(s.light.keyAzimuth, -40)
})

test('coerceRoomState repairs corrupt input', () => {
  const s = coerceRoomState({ contentId: 'nope', themeId: 42, room: { fov: 'x', height: 999, color: 'red' }, light: { solo: 'bad', mute: { key: true, bogus: true }, colorRingColors: ['#123456'] } })
  const d = createDefaultState()
  assert.equal(s.contentId, d.contentId)
  assert.equal(s.themeId, d.themeId)
  assert.equal(s.room.fov, DEFAULT_ROOM.fov)
  assert.equal(s.room.height, ROOM_SCHEMA.height.max)
  assert.equal(s.room.color, DEFAULT_ROOM.color)
  assert.equal(s.light.solo, null)
  assert.deepEqual(s.light.mute, { key: true })
  assert.equal(s.light.colorRingColors[0], '#123456')
  assert.equal(s.light.colorRingColors.length, 6)
  assert.deepEqual(coerceRoomState(null), d)
})

test('theme, space, reset and capture round-trip', () => {
  const sage = THEMES.find(t => t.id === 'sage')
  let s = applyTheme(createDefaultState(), sage)
  assert.equal(s.room.color, sage.room)
  s = applySpace(s, 'monolith')
  assert.equal(s.room.depth, 7)
  const recipe = captureRecipe(s)
  const again = resolvePreset({ id: 'x', label: 'X', ...recipe })
  assert.deepEqual(again, s)
  const reset = resetToTheme({ ...s, room: { ...s.room, fov: 80 } }, sage)
  assert.equal(reset.room.fov, DEFAULT_ROOM.fov)
  assert.equal(reset.spaceId, 'monolith')
})

test('bundle import rejects foreign files and merges without overwriting', () => {
  assert.equal(parseBundle('{"app":"other"}'), null)
  assert.equal(parseBundle('not json'), null)
  const bundle = JSON.stringify(createBundle([THEMES[0]], [{ id: 'p', label: 'P', envId: 'void', themeId: 'studio' }, { id: 1 }]))
  const parsed = parseBundle(bundle)
  assert.equal(parsed.userPresets.length, 1)
  assert.deepEqual(mergeById([{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }, { id: 'b', v: 3 }]), [{ id: 'a', v: 1 }, { id: 'b', v: 3 }])
})

test('bounds channels are isolated and only notify on change', () => {
  const a = createBoundsChannel(), b = createBoundsChannel()
  const seen = []
  a.subscribe(x => seen.push(x.right))
  a.set({ ...a.current, right: 10 })
  a.set({ ...a.current, right: 10.001 })
  assert.deepEqual(seen, [10])
  assert.equal(b.current.right, 4)
  const snap = a.snapshot(); snap.right = 0
  assert.equal(a.current.right, 10.001)
})
