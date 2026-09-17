import test from 'node:test'
import assert from 'node:assert/strict'
import { Scene, Mesh, BoxGeometry, MeshBasicMaterial, Color, PointLight } from 'three'
import { configureScenePasses, withScenePassFilter, isTransmissionGlass } from '../packages/runtime/src/react/scene-pass-filter.ts'
import { glassOptics, refractedAngle } from '../packages/modules/src/materials/glass-optics.ts'

function fixture({ backside = true } = {}) {
  const scene = new Scene()
  const glass = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
  glass.material.isTransmissionGlassMaterial = true
  glass.material.transmissionBackdropConfig = { backside, backsideResolutionScale: .5, backdropResolutionScale: .85, background: new Color('red') }
  glass.material.transmissionBacksideMaterial = new MeshBasicMaterial()
  const band = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
  const backdropOnly = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
  backdropOnly.userData.transmissionBackdropOnly = true
  const hidden = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
  hidden.visible = false
  const light = new PointLight()
  scene.add(glass, band, backdropOnly, hidden, light)
  return { scene, glass, band, backdropOnly, hidden, light }
}

test('clean → backside → beauty preserves visibility, layers, material and background', () => {
  const { scene, glass, band, backdropOnly, hidden, light } = fixture()
  const originalMaterial = glass.material
  const calls = []
  const makePass = name => ({
    setResolutionScale(scale) { this.scale = scale },
    updateBefore() {
      calls.push(name)
      assert.equal(band.visible, true)
      assert.equal(hidden.visible, false)
      assert.equal(glass.layers.mask, 1)
      assert.equal(light.layers.mask, 1)
      if (name === 'clean') assert.equal(glass.visible, false)
      else assert.equal(glass.visible, true)
      if (name === 'backside') assert.equal(glass.material, originalMaterial.transmissionBacksideMaterial)
      if (name === 'beauty') {
        assert.equal(glass.material, originalMaterial)
        assert.equal(backdropOnly.visible, false)
        assert.equal(scene.background, null)
      } else assert.equal(backdropOnly.visible, true)
    },
  })
  const clean = makePass('clean'), backdrop = makePass('backside'), beauty = makePass('beauty')
  configureScenePasses(beauty, backdrop, scene, clean)
  const seen = new Set()
  const frame = { updateBeforeNode(pass) { if (!seen.has(pass)) { seen.add(pass); pass.updateBefore(this) } } }
  frame.updateBeforeNode(beauty)
  frame.updateBeforeNode(backdrop)
  assert.deepEqual(calls, ['clean', 'backside', 'beauty'])
  assert.equal(clean.scale, .5)
  assert.equal(backdrop.scale, .85)
  assert.equal(backdropOnly.visible, true)
  assert.equal(scene.background, null)
})

test('backside disabled skips the clean draw and excludes glass from the backdrop', () => {
  const { scene, glass } = fixture({ backside: false })
  const backdrop = { setResolutionScale() {}, updateBefore() { assert.equal(glass.visible, false) } }
  const clean = { setResolutionScale() {}, updateBefore() { assert.fail('unneeded clean pass') } }
  const beauty = { updateBefore() { assert.equal(glass.visible, true) } }
  configureScenePasses(beauty, backdrop, scene, clean)
  beauty.updateBefore({ updateBeforeNode(pass) { pass.updateBefore(this) } })
})

test('capture failure restores front material, background and visibility', () => {
  const { scene, glass } = fixture()
  const original = glass.material
  const clean = { setResolutionScale() {}, updateBefore() {} }
  const backdrop = { setResolutionScale() {}, updateBefore() { throw new Error('draw failed') } }
  configureScenePasses({ updateBefore() {} }, backdrop, scene, clean)
  assert.throws(() => backdrop.updateBefore({ updateBeforeNode(pass) { pass.updateBefore(this) } }), /draw failed/)
  assert.equal(glass.material, original)
  assert.equal(glass.visible, true)
  assert.equal(scene.background, null)
})

test('filter preserves authored hidden objects and restores visible objects on errors', () => {
  const { scene, glass, hidden } = fixture()
  assert.throws(() => withScenePassFilter(scene, isTransmissionGlass, () => { throw new Error('failed') }))
  assert.equal(glass.visible, true)
  assert.equal(hidden.visible, false)
})

test('refraction chart agrees with Snell law, zero dispersion and shader IOR spread', () => {
  assert.ok(Math.abs(refractedAngle(30, 1.5) - 19.4712206345) < 1e-8)
  assert.ok(Math.abs(refractedAngle(45, 1) - 45) < 1e-10)
  const clear = glassOptics(1.5, 0)
  assert.equal(clear.red, clear.green)
  assert.equal(clear.green, clear.blue)
  assert.ok(Math.abs(clear.criticalAngle - 41.8103148958) < 1e-8)
  assert.ok(Math.abs(clear.reflectance - .04) < 1e-12)
  const optics = glassOptics(1.5, 6)
  assert.equal(optics.red, 1.425)
  assert.equal(optics.blue, 1.575)
  assert.ok(Number.isNaN(refractedAngle(45, 1.5, true)))
  assert.ok(Math.abs(refractedAngle(clear.criticalAngle, 1.5, true) - 90) < 1e-6)
  assert.ok(Math.abs(refractedAngle(19.4712206345, 1.5, true) - 30) < 1e-8)
})

test('scene attachments follow enabled effects only', async () => {
  const { resolveSceneAttachments } = await import('../packages/runtime/src/react/postfx.tsx')
  const all = ['ssr', 'gtao', 'denoise', 'ssgi', 'recurrentDenoise', 'traa', 'taau', 'motionBlur'].map(type => ({ type, enabled: false }))
  assert.deepEqual(resolveSceneAttachments(all), { normal: false, packedNormal: false, velocity: false, diffuse: false })
  const room = all.map(e => ({ ...e, enabled: e.type === 'ssgi' || e.type === 'traa' }))
  // SSGI + TRAA: output + 8-bit packed normal + velocity + 8-bit albedo (fits the 32 bytes/sample WebGPU default)
  assert.deepEqual(resolveSceneAttachments(room), { normal: false, packedNormal: true, velocity: true, diffuse: true })
  assert.deepEqual(resolveSceneAttachments(room, false), { normal: false, packedNormal: false, velocity: false, diffuse: false })
  assert.equal(resolveSceneAttachments([{ type: 'gtao' }]).normal, true)
})

test('SSGI tier sampling matches the Adaptive Room quality table', async () => {
  const { SSGI_TIER_SAMPLING } = await import('../packages/runtime/src/react/postfx.tsx')
  const { QUALITIES } = await import('../packages/scenes/src/adaptive-room/model/quality.ts')
  for (const q of QUALITIES) assert.deepEqual(SSGI_TIER_SAMPLING[q.id], { slices: q.slices, steps: q.steps }, q.id)
})

test('anti-aliasing defaults to running after every screen-space effect', async () => {
  const { postFXCatalog, defaultPostFXOrder } = await import('../packages/modules/src/postfx/catalog.ts')
  const orders = postFXCatalog.map(e => [e, defaultPostFXOrder(e.type)])
  const lastLighting = Math.max(...orders.filter(([e]) => e.category !== 'aa').map(([, o]) => o))
  for (const [e, o] of orders) {
    if (e.category === 'aa') assert.ok(o > lastLighting, `${e.type} (${o}) must follow ${lastLighting}`)
    assert.ok(o <= 5000, `${e.type} order within parameter range`)
  }
  assert.equal(new Set(orders.map(([, o]) => o)).size, orders.length, 'orders are unique')
})
