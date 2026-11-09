// C10 release gate: validates review/ledger.jsonl against src/data/drafts and keeps src/data/bank/reviewed.json current.
// Usage: npm run check:review [-- --write] [-- --list]   (--list prints a ledger template line per pending draft)
import { register } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
register('./ts-resolve-hook.mjs', import.meta.url)
const { DRAFT_KINDS, parseLedger, reviewGate } = await import('../src/domain/bank/review.ts')
const { RETIRED_IDS } = await import('../src/domain/bank/manifest.ts')
const { itemKey } = await import('../src/domain/learning/types.ts')
const { LEVELS, mapLevels } = await import('../src/domain/progress/state.ts')
const root = new URL('../', import.meta.url)
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))

const drafts = mapLevels((lv) =>
  Object.fromEntries(
    DRAFT_KINDS.filter((k) => existsSync(new URL(`src/data/drafts/${lv}/${k}.json`, root))).map((k) => [
      k,
      read(`src/data/drafts/${lv}/${k}.json`),
    ]),
  ),
)
const official = new Set([
  ...LEVELS.flatMap((level) => read(`src/data/bank/grammar-${level}.json`).map((x) => itemKey({ level, kind: 'grammar', id: x.id }))),
  ...['reading', 'listening'].flatMap((kind) =>
    read(`src/data/bank/${kind}.json`).map((x) => itemKey({ level: x.level, kind, id: x.id })),
  ),
])
const ledger = parseLedger(readFileSync(new URL('review/ledger.jsonl', root), 'utf8'))
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const r = reviewGate(drafts, ledger, official, RETIRED_IDS, sha256)

if (process.argv.includes('--list')) {
  const today = new Date().toISOString().slice(0, 10)
  for (const p of r.pending)
    console.log(JSON.stringify({ key: JSON.parse(p.key), contentHash: p.contentHash, decision: '', reviewer: '', role: '', date: today, notes: '' }))
}
const out = 'src/data/bank/reviewed.json'
if (process.argv.includes('--write') && !r.errors.length)
  writeFileSync(new URL(out, root), JSON.stringify(r.reviewed, null, 2) + '\n')
else if (!isDeepStrictEqual(read(out), r.reviewed))
  r.errors.push(`${out} is stale; run npm run check:review -- --write, then npm run check:data -- --write`)
const shipped = Object.values(r.reviewed.grammar).flat().length + r.reviewed.reading.length + r.reviewed.listening.length
console.error(
  `Review: ${r.total} drafts; ${shipped} approved and shipped, ${r.pending.length} awaiting review, ${r.revise.length} need revision, ${r.rejected.length} rejected.`,
)
for (const e of r.errors) console.error(`ERROR ${e}`)
if (r.errors.length) process.exit(1)
