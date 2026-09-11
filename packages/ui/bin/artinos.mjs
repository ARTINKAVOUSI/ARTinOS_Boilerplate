#!/usr/bin/env node
/**
 * ARTINOS component registry CLI (PRD §64).
 *
 *   artinos list                    every registry entry
 *   artinos show <id>               one entry's full contract
 *   artinos add <id> [--dest dir]   copy the component into your project
 *
 * Source ownership without reducing the platform to copied React files: an entry
 * carries its kernel dependencies, tokens, parameter compatibility, states and
 * accessibility contract, and `add` reports all of them.
 */

import { readFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')
const registryPath = join(packageRoot, 'registry.json')

if (!existsSync(registryPath)) {
  console.error('artinos: registry.json not found at ' + registryPath)
  process.exit(1)
}
const registry = JSON.parse(readFileSync(registryPath, 'utf8'))

const [, , command, ...rest] = process.argv
const flag = name => {
  const i = rest.indexOf('--' + name)
  return i >= 0 ? rest[i + 1] : undefined
}
const positional = rest.filter(a => !a.startsWith('--') && rest[rest.indexOf(a) - 1]?.startsWith('--') !== true)
const hasFlag = name => rest.includes('--' + name)

const find = id => registry.components.find(c => c.id === id || c.name.toLowerCase() === String(id).toLowerCase())

function list() {
  const width = Math.max(...registry.components.map(c => c.id.length))
  const byCategory = new Map()
  for (const c of registry.components) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, [])
    byCategory.get(c.category).push(c)
  }
  console.log(`${registry.name} v${registry.version} — ${registry.components.length} components\n`)
  for (const [category, items] of byCategory) {
    console.log(category.toUpperCase())
    for (const c of items) console.log(`  ${c.id.padEnd(width)}  ${c.description}`)
    console.log('')
  }
  console.log('artinos show <id>   full contract')
  console.log('artinos add  <id>   install as source')
}

function show(id) {
  const c = find(id)
  if (!c) return notFound(id)
  const line = (k, v) => v && v.length && console.log(`  ${k.padEnd(16)} ${Array.isArray(v) ? v.join(', ') : v}`)
  console.log(`\n${c.name}  (${c.id})\n  ${c.description}\n`)
  line('category', c.category)
  line('files', c.files)
  line('kernel', c.kernel)
  line('parameters', c.parameters)
  line('presentations', c.presentations)
  line('states', c.states)
  line('tokens', c.tokens)
  if (c.accessibility) {
    line('role', c.accessibility.role)
    line('keyboard', c.accessibility.keyboard)
  }
  console.log('')
}

function add(id) {
  const c = find(id)
  if (!c) return notFound(id)
  const dest = resolve(process.cwd(), flag('dest') ?? 'src/components/artinos')
  const dryRun = hasFlag('dry-run')
  const force = hasFlag('force')
  const roots = [...new Set([c, ...(c.requires ?? []).map(find).filter(Boolean)].flatMap(entry => entry.files))]
  const files = collectSourceFiles(roots)
  const targets = files.map(from => ({ from, to: join(dest, relative(join(packageRoot, 'src'), from)) }))
  const collisions = targets.filter(({ to }) => existsSync(to))
  if (collisions.length && !force) {
    console.error('artinos: refusing to overwrite existing files:')
    collisions.forEach(({ to }) => console.error('  ' + to))
    console.error('Use --force to replace or --dry-run to inspect the full install.')
    process.exit(1)
  }
  if (!dryRun) for (const { from, to } of targets) { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to) }

  console.log(`\n${dryRun ? 'Would add' : 'Added'} ${c.name} to ${dest}\n`)
  for (const { to } of targets) console.log('  ' + to)
  console.log('\nIt still needs, as package dependencies:')
  for (const p of registry.runtime.packages) console.log('  ' + p)
  if (c.kernel?.length) console.log('\nKernel modules used: ' + c.kernel.join(', '))
  if (c.tokens?.length) console.log('Tokens it resolves:  ' + c.tokens.join(', '))
  console.log('\nThe copy is yours to modify. Interaction stays in the kernel, so')
  console.log('restyling it will not change how it behaves.\n')
}

function collectSourceFiles(entries) {
  const pending = entries.map(file => join(packageRoot, file))
  const found = new Set()
  while (pending.length) {
    const file = pending.pop()
    if (found.has(file)) continue
    if (!existsSync(file)) { console.error(`artinos: missing source ${relative(packageRoot, file)}`); process.exit(1) }
    found.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const base = resolve(dirname(file), match[1])
      const candidates = extname(base) ? [base] : [`${base}.ts`, `${base}.tsx`, `${base}.css`, join(base, 'index.ts'), join(base, 'index.tsx')]
      const dependency = candidates.find(existsSync)
      if (dependency && dependency.startsWith(join(packageRoot, 'src'))) pending.push(dependency)
    }
  }
  return [...found].sort()
}

function notFound(id) {
  console.error(`artinos: no component "${id}"`)
  console.error('Known: ' + registry.components.map(c => c.id).join(', '))
  process.exit(1)
}

switch (command) {
  case 'list':
  case 'ls':
    list()
    break
  case 'show':
  case 'info':
    show(positional[0])
    break
  case 'add':
    add(positional[0])
    break
  default:
    console.log('artinos <list|show|add> [id] [--dest dir] [--dry-run] [--force]')
    process.exit(command ? 1 : 0)
}
