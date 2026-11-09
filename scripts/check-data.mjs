// Validates src/data/bank with the app's bank contract and keeps counts.json / manifest.json current.
// Usage: npm run check:data [-- --write]   (Node >= 22.18 for built-in TypeScript stripping)
import { register } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
register('./ts-resolve-hook.mjs', import.meta.url)
const { checkData } = await import('../src/domain/bank/contract.ts')
const { buildManifest } = await import('../src/domain/bank/manifest.ts')
const { mapLevels } = await import('../src/domain/progress/state.ts')
const dir = new URL('../src/data/bank/', import.meta.url)
const read = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'))
const save = (name, value) => writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(value, null, 2) + '\n')
const reviewed = read('reviewed') // approved drafts, written by npm run check:review -- --write
const banks = {
  vocab: mapLevels((lv) => read(`vocab-${lv}`)),
  grammar: mapLevels((lv) => [...read(`grammar-${lv}`), ...reviewed.grammar[lv]]),
  reading: [...read('reading'), ...reviewed.reading],
  listening: [...read('listening'), ...reviewed.listening],
}
const write = process.argv.includes('--write')
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
