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

it('adds unreviewed drafts, still marked ai-draft, only when the dev opt-in is set', () => {
  process.env.EXPO_PUBLIC_DOJO_INCLUDE_DRAFTS = '1'
  try {
    jest.isolateModules(() => {
      const draft = {
        id: 'g-n3-999',
        q: '雨＿＿降る。',
        answer: 'が',
        distractors: ['を', 'に', 'で'],
        explanation: '解',
        grammarPoint: '〜が',
        origin: 'ai-draft',
        draftedAt: '2026-11-09',
        source: 'AI 起草（未經人工審閱）2026-11-09',
      }
      jest.doMock('../drafts/n3/grammar.json', () => [draft])
      const { loadLevel: load } = require('./index')
      const ids = load('n3').grammar.map((x: { id: string }) => x.id)
      expect(ids).toContain(draft.id)
      expect(load('n3').grammar.find((x: { id: string }) => x.id === draft.id).origin).toBe('ai-draft')
      expect(new Set(ids).size).toBe(ids.length)
    })
  } finally {
    delete process.env.EXPO_PUBLIC_DOJO_INCLUDE_DRAFTS
  }
  expect(loadLevel('n3').grammar.every((x) => x.origin !== 'ai-draft')).toBe(true)
})
