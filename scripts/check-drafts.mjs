// Rule checks for src/data/drafts (C9/G1): blanks, options, empty fields, duplicate or near-duplicate grammar sentences.
// Usage: node scripts/check-drafts.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs'
const root = new URL('../src/data/', import.meta.url)
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const errors = []
const fail = (at, msg) => errors.push(`${at}: ${msg}`)
const empty = (v) => typeof v !== 'string' || !v.trim()
// Keeps only kana/kanji/latin/digits so spacing, punctuation and the blank do not hide a repeat.
const norm = (s) => s.replace(/＿＿/g, '').replace(/[^\p{L}\p{N}]/gu, '')
const bigrams = (s) => new Set(Array.from({ length: Math.max(s.length - 1, 0) }, (_, i) => s.slice(i, i + 2)))
const similarity = (a, b) => {
  const x = bigrams(a), y = bigrams(b)
  return [...x].filter((g) => y.has(g)).length / (new Set([...x, ...y]).size || 1)
}
function question(at, q) {
  for (const k of ['q', 'answer', 'explanation']) if (empty(q[k])) fail(at, `${k} is empty`)
  const ds = Array.isArray(q.distractors) ? q.distractors : []
  if (ds.length !== 3 || ds.some(empty)) fail(at, 'needs three nonempty distractors')
  if (ds.includes(q.answer)) fail(at, 'answer appears in distractors')
  if (new Set(ds).size !== ds.length) fail(at, 'duplicate distractors')
}
let total = 0
for (const level of readdirSync(new URL('drafts/', root))) {
  for (const kind of ['grammar', 'reading', 'listening']) {
    const file = `drafts/${level}/${kind}.json`
    if (!existsSync(new URL(file, root))) continue
    const items = read(file)
    for (const item of items) {
      const at = `${file} ${item.id}`
      total++
      for (const k of ['id', 'origin', 'draftedAt', 'source', ...(kind === 'grammar' ? ['grammarPoint'] : [])])
        if (empty(item[k])) fail(at, `${k} is empty`)
      if (kind === 'reading') for (const q of item.questions ?? []) question(`${at}/${q.id}`, q)
      else question(at, item)
      if (kind === 'grammar' && (item.q?.match(/＿＿/g) ?? []).length !== 1) fail(at, 'q must contain exactly one ＿＿')
    }
    if (kind !== 'grammar') continue
    const bank = existsSync(new URL(`bank/grammar-${level}.json`, root)) ? read(`bank/grammar-${level}.json`) : []
    const all = [...bank, ...items].map((x) => ({ id: x.id, n: norm(x.q ?? '') }))
    for (let i = bank.length; i < all.length; i++)
      for (let j = 0; j < i; j++) {
        const s = all[i].n === all[j].n ? 1 : similarity(all[i].n, all[j].n)
        if (s >= 0.45) fail(`${file} ${all[i].id}`, `q ${s === 1 ? 'duplicates' : `is ${Math.round(s * 100)}% similar to`} ${all[j].id}`)
      }
  }
}
for (const e of errors) console.error(`ERROR ${e}`)
console.log(`Drafts: ${total} items checked, ${errors.length} problems. Language quality and single-answer correctness need human review.`)
if (errors.length) process.exit(1)
