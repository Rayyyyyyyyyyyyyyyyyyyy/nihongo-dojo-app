// Validates src/data/bank with the app's bank contract and keeps counts.json / manifest.json current.
// src/data/web holds the web-identical files that still contain U2-retired items; the app never imports it.
// The shipped copies in src/data/bank are those files minus RETIRED_IDS (only the IDs stay, in manifest.json).
// Usage: npm run check:data [-- --write]   (Node >= 22.18 for built-in TypeScript stripping)
import { register } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
register('./ts-resolve-hook.mjs', import.meta.url)
const { checkData } = await import('../src/domain/bank/contract.ts')
const { buildManifest, RETIRED_IDS } = await import('../src/domain/bank/manifest.ts')
const { itemKey } = await import('../src/domain/learning/types.ts')
const { mapLevels } = await import('../src/domain/progress/state.ts')
const dir = new URL('../src/data/bank/', import.meta.url)
const web = new URL('../src/data/web/', import.meta.url)
const read = (name, from = dir) => JSON.parse(readFileSync(new URL(`${name}.json`, from), 'utf8'))
const save = (name, value) => writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(value, null, 2) + '\n')
const retired = new Set(RETIRED_IDS.map((r) => r.key))
const shipped = {
  'grammar-n3': read('grammar-n3', web).filter((x) => !retired.has(itemKey({ level: 'n3', kind: 'grammar', id: x.id }))),
  reading: read('reading', web).filter((x) => !retired.has(itemKey({ level: x.level, kind: 'reading', id: x.id }))),
  listening: read('listening', web).filter((x) => !retired.has(itemKey({ level: x.level, kind: 'listening', id: x.id }))),
}
const write = process.argv.includes('--write')
for (const [name, items] of Object.entries(shipped)) {
  if (write) save(name, items)
  else if (!isDeepStrictEqual(read(name), items)) {
    console.error(`src/data/bank/${name}.json must be src/data/web/${name}.json without retiredIds; run npm run check:data -- --write`)
    process.exit(1)
  }
}
const reviewed = read('reviewed') // approved drafts, written by npm run check:review -- --write
const banks = {
  vocab: mapLevels((lv) => read(`vocab-${lv}`)),
  grammar: mapLevels((lv) => [...read(`grammar-${lv}`, lv === 'n3' ? web : dir), ...reviewed.grammar[lv]]),
  reading: [...read('reading', web), ...reviewed.reading],
  listening: [...read('listening', web), ...reviewed.listening],
}
const counts = checkData(banks, write ? undefined : read('counts'))
const manifest = buildManifest(banks)
if (write) {
  save('counts', counts)
  save('manifest', manifest)
} else if (!isDeepStrictEqual(read('manifest'), manifest)) {
  console.error('manifest.json is stale; run npm run check:data -- --write')
  process.exit(1)
}
console.log('Bank structure, levels, stable IDs, unique options, counts and manifest verified. Language quality requires separate review.')
