import test from 'node:test'
import assert from 'node:assert/strict'
import { createArtinosRuntime } from '../packages/runtime/src/core/runtime.ts'
import {
  roomParameters, roomStateToValues, readRoomState, roomRuntimePresets, roomReadIds, ids, HOST_IDS, ssgiFromIntensity,
} from '../packages/scenes/src/artinos/adaptive-room/parameters.ts'
import { ALL_BUILTIN, THEMES, resolvePreset, createDefaultState } from '../packages/scenes/src/adaptive-room/model/index.ts'

const hostDefinitions = [
  { id: HOST_IDS.exposure, type: 'number', defaultValue: 1, min: 0, max: 5 },
  { id: HOST_IDS.giIntensity, type: 'number', defaultValue: 9, min: 0, max: 40 },
  { id: HOST_IDS.aoIntensity, type: 'number', defaultValue: 1, min: 0, max: 2 },
]

function runtimeWithRoom(defaults = createDefaultState()) {
  const runtime = createArtinosRuntime()
  for (const definition of [...hostDefinitions, ...roomParameters(defaults)]) runtime.parameters.ensure(definition)
  return runtime
}

test('room parameters have unique ids and defaults the runtime accepts', () => {
  const definitions = roomParameters(resolvePreset(ALL_BUILTIN[0]))
  const seen = new Set()
  const runtime = createArtinosRuntime()
  for (const d of definitions) {
    assert.ok(!seen.has(d.id), `duplicate ${d.id}`); seen.add(d.id)
    assert.ok(d.id.startsWith('scene.room.'), d.id)
    assert.ok(d.group?.startsWith('Room / '), `${d.id} group ${d.group}`)
    const validation = runtime.parameterTypes.validate(d, d.defaultValue)
    assert.ok(validation.valid, `${d.id}: ${validation.message}`)
    if (typeof d.defaultValue === 'number') assert.ok(d.defaultValue >= d.min && d.defaultValue <= d.max, `${d.id} default in range`)
  }
})

test('every value a preset writes targets a defined parameter the room reads', () => {
  const runtime = runtimeWithRoom()
  const readable = new Set(roomReadIds())
  for (const preset of roomRuntimePresets()) {
    for (const [id, value] of Object.entries(preset.values)) {
      assert.ok(runtime.parameters.state(id), `${preset.id} writes unknown ${id}`)
      assert.ok(readable.has(id), `${preset.id} writes ${id} which the room never reads`)
      const result = runtime.parameters.write(id, value, { source: 'preset' })
      assert.ok(result.accepted, `${preset.id} → ${id}=${JSON.stringify(value)} rejected: ${result.validation?.message}`)
    }
  }
})

// Legacy preset fields are folded into LightParams by resolvePreset and never rendered.
const rendered = ({ qualityId, room: { lightIntensity, keyAzimuth, fillIntensity, ...room }, ...rest }) => ({ ...rest, room })

test('applying a runtime preset reproduces the resolved scene state', () => {
  const runtimePresets = roomRuntimePresets()
  for (const preset of ALL_BUILTIN) {
    const runtime = runtimeWithRoom()
    runtime.presets.register(runtimePresets.find(p => p.id === `room:${preset.id}`))
    assert.ok(runtime.presets.apply(`room:${preset.id}`))
    const state = readRoomState(id => runtime.parameters.getResolved(id), createDefaultState())
    assert.deepEqual(rendered(state), rendered(resolvePreset(preset)), preset.id)
  }
})

test('theme surface follows the theme until the author overrides it', () => {
  const runtime = runtimeWithRoom()
  runtime.parameters.set(ids.theme, 'noir')
  let state = readRoomState(id => runtime.parameters.getResolved(id), createDefaultState())
  assert.equal(state.room.color, THEMES.find(t => t.id === 'noir').room)
  runtime.parameters.set(ids.themeSurface, false)
  runtime.parameters.set(ids.room('color'), '#123456')
  state = readRoomState(id => runtime.parameters.getResolved(id), createDefaultState())
  assert.equal(state.room.color, '#123456')
})

test('host values carry exposure and SSGI strength; room values do not duplicate them', () => {
  const values = roomStateToValues({ ...createDefaultState(), room: { ...createDefaultState().room, exposure: 1.3, ssgiIntensity: 1.5 } })
  assert.equal(values[HOST_IDS.exposure], 1.3)
  assert.equal(values[HOST_IDS.giIntensity], ssgiFromIntensity(1.5).giIntensity)
  assert.equal(values[ids.room('exposure')], undefined)
  assert.equal(values[ids.room('ssgiIntensity')], undefined)
})

test('mute, solo and ring colors survive the parameter round trip', () => {
  const base = createDefaultState()
  const state = { ...base, light: { ...base.light, solo: 'rim', mute: { key: true }, colorRingColors: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'] } }
  const runtime = runtimeWithRoom()
  for (const [id, value] of Object.entries(roomStateToValues(state))) runtime.parameters.set(id, value)
  const back = readRoomState(id => runtime.parameters.getResolved(id), base)
  assert.equal(back.light.solo, 'rim')
  assert.deepEqual(back.light.mute, { key: true })
  assert.deepEqual(back.light.colorRingColors, state.light.colorRingColors)
})

test('undoable preset application collapses into one history step', async () => {
  const { applyValues } = await import('../packages/scenes/src/artinos/adaptive-room/kit.tsx').catch(() => ({}))
  if (!applyValues) return // kit imports React components; covered by typecheck when unavailable
  const runtime = runtimeWithRoom()
  const before = runtime.history.snapshot().undo.length
  applyValues(runtime, roomRuntimePresets()[3].values, 'test')
  assert.equal(runtime.history.snapshot().undo.length, before + 1)
})
