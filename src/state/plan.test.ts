// C6：每日份量（handoff §2.5）、失效目標修復（移植網頁版 repairPlan）、手動標記掌握。
import type { LevelBank } from '../data/bank'
import { dayKey, itemKey, type StudyItemRef } from '../domain/learning/types'
import { ensurePlan, isGoalComplete, markVocab, repairPlan, submitAnswer } from './core'
import { createDoc, type AppStateDoc } from './doc'
import { fixtureManifest } from '../test/fixtures'

const on = (h = 12) => () => new Date(2026, 10, 9, h)
const vocab = Array.from({ length: 30 }, (_, i) => ({ w: `語${i}`, r: `ご${i}`, zh: `詞${i}`, en: `w${i}` }))
const q = (id: string) => ({ id, q: `${id}を＿＿`, answer: 'a', distractors: ['b', 'c'], explanation: 'e' })
const bank: LevelBank = {
  vocab,
  grammar: Array.from({ length: 12 }, (_, i) => q(`g${i}`)),
  reading: [{ id: 'r1', level: 'n5', title: 't', type: 'x', text: '本文', notes: [], questions: [{ ...q('rq1') }] }],
  listening: Array.from({ length: 4 }, (_, i) => ({ ...q(`l${i}`), level: 'n5' as const, script: '男：はい。' })),
}
const docWith = (dailyMinutes: 5 | 10 | 20): AppStateDoc => {
  const d = createDoc('i', on())
  return { ...d, learning: { ...d.learning, level: 'n5' }, settings: { ...d.settings, dailyMinutes } }
}
const plan = (doc: AppStateDoc) => doc.learning.plans[dayKey('2026-11-09', 'n5')]
const sizes = (doc: AppStateDoc) =>
  Object.fromEntries(Object.entries(plan(doc).groups).map(([k, g]) => [k, g!.targets.length]))

describe('每日份量依分鐘數（handoff §2.5）', () => {
  test('5 分鐘：單字 5、文法 3、聽力 1（不論選哪個分支）', () => {
    expect(sizes(ensurePlan(docWith(5), 'reading', on(), bank, fixtureManifest))).toEqual({ vocab: 5, grammar: 3, listening: 1 })
  })
  test('10 分鐘：單字 10、文法 5、讀解 1 篇或聽力 3', () => {
    expect(sizes(ensurePlan(docWith(10), 'reading', on(), bank, fixtureManifest))).toEqual({ vocab: 10, grammar: 5, reading: 1 })
    expect(sizes(ensurePlan(docWith(10), 'listening', on(), bank, fixtureManifest))).toEqual({ vocab: 10, grammar: 5, listening: 3 })
  })
  test('20 分鐘：單字 20、文法 10、讀解 1 篇＋聽力 3；兩組都完成才算今日目標完成', () => {
    let doc = ensurePlan(docWith(20), 'listening', on(), bank, fixtureManifest)
    expect(sizes(doc)).toEqual({ vocab: 20, grammar: 10, reading: 1, listening: 3 })
    const p = plan(doc)
    let n = 0
    for (const ref of [...p.groups.vocab!.targets, ...p.groups.grammar!.targets, ...p.groups.listening!.targets])
      doc = submitAnswer(doc, { attemptId: `a${++n}`, ref, mode: ref.kind === 'vocab' ? 'flashcard' : (ref.kind as 'grammar'), correct: true }, on(), bank).doc
    expect(isGoalComplete(doc.learning, '2026-11-09', bank)).toBe(false)
  })
  test('當天改分鐘數不改已排好的今日任務', () => {
    const doc = ensurePlan(docWith(10), 'listening', on(), bank, fixtureManifest)
    const changed = { ...doc, settings: { ...doc.settings, dailyMinutes: 20 as const } }
    expect(ensurePlan(changed, 'listening', on(), bank, fixtureManifest)).toBe(changed)
  })
})

describe('repairPlan：失效目標修復（網頁版 repairPlan）', () => {
  test('只換掉失效目標，保留原有效目標；回報修復數', () => {
    const doc = ensurePlan(docWith(10), 'listening', on(), bank, fixtureManifest)
    const old = plan(doc).groups.grammar!.targets
    const smaller = { ...bank, grammar: bank.grammar.filter((g) => g.id !== old[0].id) }
    const r = repairPlan(doc, 'grammar', on(), smaller, fixtureManifest)
    const targets = plan(r).groups.grammar!.targets.map((t: StudyItemRef) => t.id)
    expect(targets).toHaveLength(5)
    expect(targets).not.toContain(old[0].id)
    expect(targets).toEqual(expect.arrayContaining(old.slice(1).map((t) => t.id)))
    expect(plan(r).groups.grammar!.note).toMatch(/已修復 1 個失效目標/)
  })
  test('題庫全部消失時修復後為 0 題（empty）；沒有今天的組時不改文件', () => {
    const doc = ensurePlan(docWith(10), 'listening', on(), bank, fixtureManifest)
    expect(plan(repairPlan(doc, 'listening', on(), { ...bank, listening: [] }, fixtureManifest)).groups.listening).toMatchObject({ status: 'empty', targets: [] })
    expect(repairPlan(doc, 'reading', on(), bank, fixtureManifest)).toBe(doc)
  })
  test('20 分鐘的大組修復後維持原大小', () => {
    const doc = ensurePlan(docWith(20), 'listening', on(), bank, fixtureManifest)
    const gone = plan(doc).groups.vocab!.targets[0].id
    const r = repairPlan(doc, 'vocab', on(), { ...bank, vocab: bank.vocab.filter((v) => v.w !== gone) }, fixtureManifest)
    expect(plan(r).groups.vocab!.targets).toHaveLength(20)
  })
})

describe('markVocab：手動標記已掌握（S8）', () => {
  test('標記與取消都不給 XP、不算連勝；取消回到學習中', () => {
    const d = docWith(10)
    const known = markVocab(d, 'n5', '語1', true)
    expect(known.learning.vKnown.n5).toHaveProperty('語1', true)
    expect(known.rewards).toBe(d.rewards)
    expect(known.learning.streak).toBe(0)
    expect(known.learning.lastDate).toBe('')
    const undone = markVocab(known, 'n5', '語1', false)
    expect(undone.learning.vKnown.n5).not.toHaveProperty('語1')
    expect(undone.learning.vLearning.n5).toHaveProperty('語1', true)
    expect(itemKey({ level: 'n5', kind: 'vocab', id: '語1' }) in undone.learning.results).toBe(false)
  })
})
