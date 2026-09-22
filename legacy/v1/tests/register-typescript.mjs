import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
// Test-only TS/TSX loader; leaves app and package builds to their own compiler settings.
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context) } catch (error) {
      if (!specifier.startsWith('.') || !context.parentURL?.startsWith('file:')) throw error
      const base = fileURLToPath(new URL(specifier, context.parentURL))
      for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        if (existsSync(base + suffix)) return { url: pathToFileURL(base + suffix).href, shortCircuit: true }
      }
      throw error
    }
  },
  load(url, context, next) {
    if (!/\.tsx?$/.test(url)) return next(url, context)
    const result = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: fileURLToPath(url) })
    return { format: 'module', source: result.outputText, shortCircuit: true }
  },
})
