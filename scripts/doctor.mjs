import { readFile, readdir, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
let failures = 0
const report = (ok, message) => { console.log(`${ok ? 'OK' : 'FAIL'} ${message}`); if (!ok) failures++ }
report(Number(process.versions.node.split('.')[0]) >= 20, `Node ${process.versions.node}`)
for (const entry of await readdir(path.join(root, 'packages'), { withFileTypes: true })) {
  // Only package folders count; archives or notes dropped into packages/ are ignored.
  if (!entry.isDirectory()) continue
  const location = path.join(root, 'packages', entry.name)
  let pkg
  try { pkg = JSON.parse(await readFile(path.join(location, 'package.json'), 'utf8')) }
  catch { continue }
  const entries = Object.values(pkg.exports ?? {}).filter(value => typeof value === 'string' && value.startsWith('./') && !value.includes('*'))
  for (const entry of entries) {
    try { await access(path.resolve(location, entry)); report(true, `${pkg.name} ${entry}`) }
    catch { report(false, `${pkg.name} missing export ${entry}`) }
  }
}
for (const name of ['typescript', 'vite', 'react', 'three', '@react-three/fiber']) {
  try { await access(path.join(root, 'node_modules', name, 'package.json')); report(true, `${name} installed`) }
  catch { report(false, `${name} is not installed; run pnpm install`) }
}
report(Boolean(manifest.scripts.build && manifest.scripts.typecheck), 'Build and typecheck scripts configured')
console.log(failures ? `${failures} issue(s) found.` : 'Workspace checks passed.')
process.exitCode = failures ? 1 : 0
