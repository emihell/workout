// req-156 (audit F-TEST-1) — Node module hooks so `node --test` can import the app's .jsx.
// Registered by render.js (module.register), never by the app. Two jobs, both what Vite
// does for the real build:
//   - resolve: an extensionless relative import ('../views/shared', './add-set') tries
//     .js, .jsx, then /index.js, /index.jsx — Vite resolves these; Node's ESM does not.
//   - load: a .jsx file is compiled with the automatic JSX runtime by rolldown's
//     transform (rolldown ships with Vite, so this adds no dependency).
import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'rolldown/experimental'

const TRY = ['.js', '.jsx', '/index.js', '/index.jsx']

function isFile(url) {
  const path = fileURLToPath(url)
  return existsSync(path) && statSync(path).isFile()
}

export async function resolve(specifier, context, next) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../')
  if (relative && context.parentURL?.startsWith('file:')) {
    const base = new URL(specifier, context.parentURL)
    if (!isFile(base)) {
      for (const suffix of TRY) {
        const candidate = new URL(base.href + suffix)
        if (isFile(candidate)) return { url: candidate.href, shortCircuit: true }
      }
    }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (!url.endsWith('.jsx')) return next(url, context)
  const path = fileURLToPath(url)
  const source = await readFile(path, 'utf8')
  const out = transformSync(path, source, { lang: 'jsx', jsx: { runtime: 'automatic' } })
  if (out.errors?.length) throw new Error(`jsx-loader: ${path}: ${out.errors.map((e) => e.message).join('; ')}`)
  return { format: 'module', source: out.code, shortCircuit: true }
}
