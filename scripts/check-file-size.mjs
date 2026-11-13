// No source file over 500 lines (CONTRIBUTING rule 3). Prints "ok" or the offenders.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LIMIT = 500
const bad = []
const walk = d => {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== 'dist' && !n.startsWith('.')) walk(p); continue }
    if (!/\.(ts|tsx|css|mjs|js)$/.test(n)) continue
    const lines = readFileSync(p, 'utf8').split('\n').length
    if (lines > LIMIT) bad.push(`${p}: ${lines} lines`)
  }
}
walk('src'); walk('scripts')
if (bad.length) { console.error(bad.join('\n')); process.exit(1) }
console.log('ok')
