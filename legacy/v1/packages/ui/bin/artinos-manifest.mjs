#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registry = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'))
const tokenSource = readFileSync(join(root, 'src/design/token-graph.ts'), 'utf8')
const themeSource = readFileSync(join(root, 'src/theme.ts'), 'utf8')
const tokens = [...tokenSource.matchAll(/id:\s*'([^']+)'[\s\S]*?layer:\s*'([^']+)'/g)].map(([, id, layer]) => ({ id, layer }))
const themes = [...themeSource.matchAll(/^\s{2}'?([a-z][a-z-]*)'?:\s*\{/gm)].map(match => match[1]).filter((value, index, all) => all.indexOf(value) === index)
const manifest = {
  schema: 'artinos.design-manifest.v1', generatedAt: new Date().toISOString(), package: { name: registry.name, version: registry.version },
  tokens, themes, components: registry.components,
  docs: registry.components.map(component => ({ id: component.id, title: component.name, summary: component.description, states: component.states ?? [], parameters: component.parameters ?? [] })),
  figma: { format: 'figma.tokens.studio.v1', collections: tokens.reduce((groups, token) => ((groups[token.layer] ??= []).push(token), groups), {}), components: registry.components.map(component => ({ name: component.name, key: component.id, properties: { state: component.states ?? [], presentation: component.presentations ?? [] } })) },
}
const outIndex = process.argv.indexOf('--out')
if (outIndex >= 0 && !process.argv[outIndex + 1]) throw new Error('--out requires a path')
const output = process.argv.includes('--stdout') ? null : resolve(process.cwd(), outIndex >= 0 ? process.argv[outIndex + 1] : 'artinos-ui.manifest.json')
if (output) { if (existsSync(output) && !process.argv.includes('--force')) throw new Error(`Refusing to overwrite ${output}; pass --force`); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(manifest, null, 2)); console.log(output) }
else console.log(JSON.stringify(manifest, null, 2))
