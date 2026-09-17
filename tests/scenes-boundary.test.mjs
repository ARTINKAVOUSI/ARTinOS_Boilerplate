import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// @artinos/scenes must run in any React + R3F + three/webgpu app. Only the
// `artinos/` adapter may reach into the ARTINOS runtime.
const packageRoot = fileURLToPath(new URL('../packages/scenes/', import.meta.url))
const CORE_ALLOWED = new Set(['react', 'three', '@react-three/fiber'])
const ADAPTER_ALLOWED = new Set([...CORE_ALLOWED, '@artinos/runtime'])

function sources(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const packageName = specifier =>
  specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]

const statements = /^\s*(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm

test('@artinos/scenes core imports only React, three and R3F; only artinos/ may import the runtime', () => {
  const offenders = []
  const src = join(packageRoot, 'src')
  for (const file of sources(src)) {
    const rel = relative(src, file).split(sep).join('/')
    const allowed = rel.startsWith('artinos/') ? ADAPTER_ALLOWED : CORE_ALLOWED
    for (const match of readFileSync(file, 'utf8').matchAll(statements)) {
      const specifier = match[1] ?? match[2] ?? match[3]
      if (specifier.startsWith('.')) {
        // the independent core never depends on the adapter
        if (!rel.startsWith('artinos/') && specifier.includes('artinos')) offenders.push(`${rel} → ${specifier}`)
        continue
      }
      if (!allowed.has(packageName(specifier))) offenders.push(`${rel} → ${specifier}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('@artinos/scenes takes its rendering stack as peers and ships no ARTINOS dependency', () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  for (const name of CORE_ALLOWED) assert.ok(manifest.peerDependencies?.[name], `${name} is a peer dependency`)
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}), [])
})
