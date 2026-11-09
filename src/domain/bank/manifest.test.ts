import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildManifest, RETIRED_IDS, CONTENT_VERSION, type ValidBanks } from './manifest'
import { mapLevels } from '../progress/state'
import { itemKey } from '../learning/types'
import committed from '../../data/bank/manifest.json'

const q = { q: '問', answer: '正', distractors: ['一', '二', '三'], explanation: '解' }
const grammar = (lv: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ ...q, id: `g-${lv}-${String(i + 1).padStart(3, '0')}` }))

it('cuts lessons in bank order (10 grammar, 2 reading, 6 listening, 100 words) and frees N5/N4 only', () => {
  const banks: ValidBanks = {
    vocab: mapLevels(() => []),
    grammar: mapLevels(() => []),
    reading: [],
    listening: [],
  }
  banks.vocab.n2 = Array.from({ length: 101 }, (_, i) => ({ w: `w${i}`, r: 'よみ', zh: '字', en: '' }))
  banks.vocab.n2.splice(1, 0, { w: 'w0', r: 'べつ', zh: '字', en: '' }) // alternate reading, same item
  banks.grammar.n2 = grammar('n2', 21)
  banks.reading = ['a', 'b', 'c'].map((id) => ({
    id,
    level: 'n2' as const,
    title: 't',
    type: 't',
    text: 't',
    notes: [],
    questions: [{ ...q, id: `rq-${id}` }],
  }))
  const m = buildManifest(banks, [])
  expect(m.levels.n2.counts).toEqual({ vocab: 101, grammar: 21, reading: 3, listening: 0 })
  expect(m.levels.n2.lessons.grammar.map((l) => [l.lessonNo, l.itemIds.length])).toEqual([
    [1, 10],
    [2, 10],
    [3, 1],
  ])
  expect(m.levels.n2.lessons.reading).toEqual([
    { lessonNo: 1, itemIds: ['a', 'b'] },
    { lessonNo: 2, itemIds: ['c'] },
  ])
  expect(m.levels.n2.lessons.vocab[1]).toEqual({ lessonNo: 2, itemIds: ['w100'] })
  expect(m.levels.n2.lessons.listening).toEqual([])
  expect([m.levels.n5.free, m.levels.n4.free, m.levels.n3.free, m.levels.n2.free, m.levels.n1.free])
    .toEqual(['all', 'all', 'firstLesson', 'firstLesson', 'firstLesson'])
})

it('leaves retired items out of counts and lessons but lists their keys', () => {
  const banks: ValidBanks = {
    vocab: mapLevels(() => []),
    grammar: mapLevels(() => []),
    reading: [],
    listening: [],
  }
  banks.grammar.n3 = grammar('n3', 3)
  const retired = [
    { key: itemKey({ level: 'n3', kind: 'grammar', id: 'g-n3-002' }), reason: 'unsourced' as const },
  ]
  const m = buildManifest(banks, retired)
  expect(m.levels.n3.counts.grammar).toBe(2)
  expect(m.levels.n3.lessons.grammar).toEqual([{ lessonNo: 1, itemIds: ['g-n3-001', 'g-n3-003'] }])
  expect(m.retiredIds).toEqual(retired)
})

it('retires exactly the unsourced U2 items: g-n3-001–020, reading r1, listening l1/l2/l7/l8', () => {
  const key = (kind: 'grammar' | 'reading' | 'listening', id: string) =>
    JSON.stringify(['n3', kind, id])
  expect(RETIRED_IDS).toEqual([
    ...Array.from({ length: 20 }, (_, i) => ({
      key: key('grammar', `g-n3-${String(i + 1).padStart(3, '0')}`),
      reason: 'unsourced',
    })),
    { key: key('reading', 'r1'), reason: 'unsourced' },
    ...['l1', 'l2', 'l7', 'l8'].map((id) => ({ key: key('listening', id), reason: 'unsourced' })),
  ])
})

const read = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '../../data/bank', `${name}.json`), 'utf8'))
const reviewed = read('reviewed')
const real = (): ValidBanks => ({
  vocab: mapLevels((lv) => read(`vocab-${lv}`)),
  grammar: mapLevels((lv) => [...read(`grammar-${lv}`), ...reviewed.grammar[lv]]),
  reading: [...read('reading'), ...reviewed.reading],
  listening: [...read('listening'), ...reviewed.listening],
})

it('committed manifest.json matches the banks (run npm run check:data -- --write when stale)', () => {
  expect(committed).toEqual(buildManifest(real(), RETIRED_IDS, CONTENT_VERSION))
})

it('every retired key names an item that exists in the copied banks', () => {
  const banks = real()
  const ids = {
    grammar: banks.grammar.n3.map((x) => x.id),
    reading: banks.reading.filter((x) => x.level === 'n3').map((x) => x.id),
    listening: banks.listening.filter((x) => x.level === 'n3').map((x) => x.id),
  }
  for (const { key } of RETIRED_IDS) {
    const [, kind, id] = JSON.parse(key) as ['n3', keyof typeof ids, string]
    expect(ids[kind]).toContain(id)
  }
})
