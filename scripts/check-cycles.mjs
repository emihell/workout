// req-164 — lists every static-import cycle among the app's modules (src/, tests excluded).
// Exit 1 if any cycle is found. `import … from` / `export … from` / bare `import '…'` are
// followed (relative specifiers only; .js/.jsx/index resolution as Vite does).
//   node scripts/check-cycles.mjs [srcDir]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(process.argv[2] || 'src')
const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(js|jsx|mjs)$/.test(name) && !/\.test\.js$|fixture/.test(name)) files.push(p)
  }
})(root)

function resolveSpec(from, spec) {
  const base = resolve(dirname(from), spec)
  for (const c of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, join(base, 'index.js'), join(base, 'index.jsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}
const edges = new Map()
for (const f of files) {
  // comments stripped so a commented-out import doesn't count
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const deps = new Set()
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;'"]*?from\s*['"](\.[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g)) {
    const target = resolveSpec(f, m[1] || m[2])
    if (target && !/\.test\.js$/.test(target)) deps.add(target)
  }
  edges.set(f, deps)
}
// Tarjan's SCC: every strongly connected component with >1 module (or a self-import) is a cycle.
let index = 0
const idx = new Map(), low = new Map(), stack = [], on = new Set(), cycles = []
function strong(v) {
  idx.set(v, index); low.set(v, index); index++; stack.push(v); on.add(v)
  for (const w of edges.get(v) || []) {
    if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))) }
    else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)))
  }
  if (low.get(v) === idx.get(v)) {
    const comp = []
    let w
    do { w = stack.pop(); on.delete(w); comp.push(w) } while (w !== v)
    if (comp.length > 1 || (edges.get(v) || new Set()).has(v)) cycles.push(comp)
  }
}
for (const f of files) if (!idx.has(f)) strong(f)
const rel = (p) => relative(resolve('.'), p)
console.log(`check-cycles: ${files.length} modules, ${[...edges.values()].reduce((n, s) => n + s.size, 0)} imports`)
for (const c of cycles) console.log(`  CYCLE (${c.length}): ${c.map(rel).sort().join(' ↔ ')}`)
console.log(cycles.length ? `check-cycles: ${cycles.length} cycle(s)` : 'check-cycles: no import cycles')
process.exit(cycles.length ? 1 : 0)
