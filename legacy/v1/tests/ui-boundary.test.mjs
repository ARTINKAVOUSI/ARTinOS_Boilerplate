import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// @artinos/ui is a standalone design system: it may import React, its icon set and
// its own files — nothing from the ARTINOS runtime, graph, modules or a renderer.
const packageRoot = fileURLToPath(new URL('../packages/ui/', import.meta.url))
const ALLOWED = new Set(['react', 'react-dom', 'lucide-react'])

function sources(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

function packageName(specifier) {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
}

test('@artinos/ui source imports only React, its icons and its own files', () => {
  const offenders = []
  for (const file of sources(join(packageRoot, 'src'))) {
    const text = readFileSync(file, 'utf8')
    // Statements only: `import … from`, `export … from`, side-effect `import '…'` and `import('…')`.
    // Prose that happens to contain "from 'x'" must not count.
    const statements = /^\s*(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm
    for (const match of text.matchAll(statements)) {
      const specifier = match[1] ?? match[2] ?? match[3]
      if (specifier.startsWith('.')) continue
      if (!ALLOWED.has(packageName(specifier))) offenders.push(`${file.slice(packageRoot.length)} → ${specifier}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('@artinos/ui declares no workspace dependency and takes React as a peer', () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
  assert.deepEqual(declared.filter(name => name.startsWith('@artinos/')), [])
  assert.ok(manifest.peerDependencies?.react, 'react is a peer dependency')
  assert.equal(manifest.dependencies?.react, undefined, 'react is not bundled as a dependency')
})
