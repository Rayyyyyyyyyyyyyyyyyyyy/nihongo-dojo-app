import { bankManifest, loadLevel } from './index'

it('loads one level with shipped items only, matching the manifest lessons', () => {
  const n3 = loadLevel('n3')
  expect(n3.grammar.map((x) => x.id)).toEqual(bankManifest.levels.n3.lessons.grammar.flatMap((l) => l.itemIds))
  expect(n3.grammar.some((x) => x.id === 'g-n3-001')).toBe(false)
  expect(n3.reading.map((x) => x.id)).toEqual(['r-n3-001', 'r-n3-002'])
  expect(n3.listening.map((x) => x.id)).toEqual(['l-n3-001', 'l-n3-002', 'l-n3-003'])
  expect(new Set(n3.vocab.map((v) => v.w)).size).toBe(bankManifest.levels.n3.counts.vocab)
  expect(loadLevel('n3')).toBe(n3)
})

it('keeps other levels separate', () => {
  expect(loadLevel('n5').reading.every((x) => x.level === 'n5')).toBe(true)
  expect(loadLevel('n5').grammar).toHaveLength(80)
})
