import test from 'node:test'
import assert from 'node:assert/strict'
import { float } from 'three/tsl'
import { NodePreviewService } from '../packages/runtime/src/react/node-preview.ts'

function fixture(fail = false) {
  const original = {}, mrt = {}
  let target = original, attachments = mrt, resolve
  const pending = new Promise(done => { resolve = done })
  const renderer = {
    getRenderTarget: () => target, setRenderTarget: value => { target = value },
    getMRT: () => attachments, setMRT: value => { attachments = value },
    render() { assert.notEqual(target, original); assert.equal(attachments, null); if (fail) throw Error('draw failed') },
    readRenderTargetPixelsAsync() { assert.equal(target, original); assert.equal(attachments, mrt); return pending },
  }
  return { service: new NodePreviewService(renderer), renderer, original, mrt, resolve }
}

test('preview restores shared render state before asynchronous readback; released requests stay released', async () => {
  const f = fixture()
  f.service.request('scene', float(1))
  f.service.tick(400)
  assert.equal(f.renderer.getRenderTarget(), f.original)
  assert.equal(f.renderer.getMRT(), f.mrt)
  f.service.release('scene')
  f.resolve(new Uint8Array(64 * 64 * 4))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.service.get('scene'), undefined)
  f.service.dispose()
})

test('failed preview draw restores target and MRT', async () => {
  const f = fixture(true)
  f.service.request('scene', float(1))
  f.service.tick(400)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.renderer.getRenderTarget(), f.original)
  assert.equal(f.renderer.getMRT(), f.mrt)
  assert.equal(f.service.get('scene'), undefined)
  f.service.dispose()
})
