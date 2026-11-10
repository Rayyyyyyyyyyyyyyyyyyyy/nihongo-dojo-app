import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OPEN_SOURCE } from './licenses'

const root = join(__dirname, '../..')
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))

test('S19 開源套件清單涵蓋 package.json 每個執行期依賴，授權與套件本身一致', () => {
  const deps = Object.keys(read('package.json').dependencies).sort()
  expect(OPEN_SOURCE.map((p) => p.name).sort()).toEqual(deps)
  for (const p of OPEN_SOURCE) expect(p.license).toBe(read(`node_modules/${p.name}/package.json`).license)
})
