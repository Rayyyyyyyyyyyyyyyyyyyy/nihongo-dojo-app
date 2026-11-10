import { lessonBatch } from '../../domain/learning/plans'
import { dayKey, itemKey } from '../../domain/learning/types'
import { ensurePlan, submitAnswer } from '../../state/core'
import { createDoc, type AppStateDoc } from '../../state/doc'
import { fixtureBank, fixtureManifest } from '../../test/fixtures'
import { extraQueue, lessonQueue, readingResume, reviewQueue, todayQueue } from './queue'

const on = () => new Date(2026, 10, 9, 12)
const bank = fixtureBank('n5')
const base = (): AppStateDoc => {
  const d = createDoc('i', on)
  return ensurePlan({ ...d, learning: { ...d.learning, level: 'n5' } }, 'listening', on, bank, fixtureManifest)
}
let n = 0
const answer = (doc: AppStateDoc, ref: Parameters<typeof itemKey>[0], correct = true, attemptId = `a${++n}`) =>
  submitAnswer(doc, { attemptId, ref, mode: ref.kind === 'vocab' ? 'flashcard' : (ref.kind as 'grammar'), correct }, on, bank).doc

describe('todayQueue：今日任務題目固定，續做從未作答的開始', () => {
  test('順序 單字 → 文法 → 聽力；已作答的不再出現', () => {
    let doc = base()
    const q = todayQueue(doc, bank, '2026-11-09', fixtureManifest)
    expect(q.items.map((i) => i.type)).toEqual([...Array(10).fill('flashcard'), ...Array(5).fill('choice'), ...Array(3).fill('listening')])
    doc = answer(doc, q.items[0].refs[0])
    expect(todayQueue(doc, bank, '2026-11-09', fixtureManifest).items).toHaveLength(17)
    expect(q.missing).toEqual([])
  })
  test('選項打亂但穩定；文法選項含答案與干擾項', () => {
    const a = todayQueue(base(), bank, '2026-11-09', fixtureManifest).items[10]
    const b = todayQueue(base(), bank, '2026-11-09', fixtureManifest).items[10]
    if (a.type !== 'choice' || b.type !== 'choice') throw Error('expected choice')
    expect(a.options).toEqual(b.options)
    expect([...a.options].sort()).toEqual([a.answer, ...bank.grammar.find((g) => g.q === a.prompt)!.distractors].sort())
  })
  test('題庫更新後的失效目標回報 missing 的組', () => {
    const doc = base()
    const gone = doc.learning.plans[dayKey('2026-11-09', 'n5')].groups.grammar!.targets[0].id
    const q = todayQueue(doc, { ...bank, grammar: bank.grammar.filter((g) => g.id !== gone) }, '2026-11-09', fixtureManifest)
    expect(q.missing).toEqual(['grammar'])
  })
  test('缺選項的題目標為資料有問題', () => {
    const broken = { ...bank, grammar: bank.grammar.map((g) => ({ ...g, distractors: [] })) }
    const item = todayQueue(base(), broken, '2026-11-09', fixtureManifest).items[10]
    expect(item.type === 'choice' && item.broken).toBe(true)
  })
})

describe('extraQueue：加練優先到期 → 錯題 → 未學，排除今天做過的', () => {
  test('同份量；今天做過的不再出現；錯題在前', () => {
    let doc = base()
    const first = todayQueue(doc, bank, '2026-11-09', fixtureManifest).items
    doc = answer(doc, first[0].refs[0], false)
    const q = extraQueue(doc, bank, '2026-11-09', fixtureManifest)
    const vocab = q.items.filter((i) => i.type === 'flashcard')
    expect(vocab).toHaveLength(10)
    expect(vocab.map((i) => i.refs[0].id)).not.toContain(first[0].refs[0].id)
  })
})

describe('reviewQueue：到期與錯題；題庫找不到的列為不可用', () => {
  test('錯題（文法）與到期單字都進入複習；不存在的 ID 進 unavailable', () => {
    let doc = base()
    doc = answer(doc, { level: 'n5', kind: 'grammar', id: 'g-n5-001' }, false)
    doc = answer(doc, { level: 'n5', kind: 'grammar', id: 'g-n5-gone' as string }, false)
    const q = reviewQueue(doc, bank, '2026-11-09')
    expect(q.items.map((i) => i.refs[0].id)).toContain('g-n5-001')
    expect(q.unavailable.map((r) => r.id)).toEqual(['g-n5-gone'])
  })
  test('沒有待複習時為空', () => {
    expect(reviewQueue(base(), bank, '2026-11-09').items).toEqual([])
  })
})

describe('lessonQueue 與讀解續做', () => {
  test('單字課一次 10 張：未學過的依課內順序優先，其次到期，最後其他', () => {
    const ids = bank.vocab.map((v) => v.w) // 24 字
    const ref = (id: string) => ({ level: 'n5' as const, kind: 'vocab' as const, id })
    let doc = base()
    doc = answer(doc, ref(ids[0]), true) // 學過：明天到期
    doc = answer(doc, ref(ids[1]), true)
    const s = doc.learning
    const picked = lessonBatch(s, 'n5', ids, '2026-11-10') // 隔天：ids[0]、ids[1] 到期
    expect(picked).toEqual(ids.slice(2, 12))
    const after = lessonBatch(s, 'n5', ids.slice(0, 5), '2026-11-10')
    expect(after).toEqual([ids[2], ids[3], ids[4], ids[0], ids[1]])
    expect(lessonBatch(s, 'n5', ids.slice(0, 4), '2026-11-09')).toEqual([ids[2], ids[3], ids[0], ids[1]])
  })
  test('lessonQueue 對單字課只出 10 張，其他種類不截斷', () => {
    expect(lessonQueue(bank, fixtureManifest, 'n5', 'vocab', 1, 'flashcard', '2026-11-09', base().learning)).toHaveLength(10)
    expect(lessonQueue(bank, fixtureManifest, 'n5', 'vocab', 1, 'pronunciation', '2026-11-09', base().learning)).toHaveLength(10)
    expect(lessonQueue(bank, fixtureManifest, 'n5', 'grammar', 1, 'flashcard', '2026-11-09', base().learning)).toHaveLength(
      fixtureManifest.levels.n5.lessons.grammar[0].itemIds.length,
    )
  })
  test('單字課可選翻卡或讀音測驗；讀音測驗的選項是讀音', () => {
    const q = lessonQueue(bank, fixtureManifest, 'n5', 'vocab', 1, 'pronunciation', '2026-11-09', base().learning)
    expect(q[0].type).toBe('choice')
    if (q[0].type === 'choice') expect(q[0].options).toContain(q[0].answer)
    expect(lessonQueue(bank, fixtureManifest, 'n5', 'vocab', 1, 'flashcard', '2026-11-09', base().learning)[0].type).toBe('flashcard')
  })
  test('讀解：同一篇未完成的 attempt 從第一個未答子題續做', () => {
    let doc = base()
    const article = bank.reading[0]
    const ref = { level: 'n5' as const, kind: 'reading' as const, id: article.questions[0].id, articleId: article.id }
    doc = submitAnswer(doc, { attemptId: JSON.stringify(['art-1', ref.id]), ref, mode: 'reading', correct: true }, on, bank).doc
    expect(readingResume(doc.learning, 'n5', article.id, '2026-11-09')).toEqual({ attemptId: 'art-1', answered: [ref.id] })
    expect(readingResume(base().learning, 'n5', article.id, '2026-11-09')).toBeNull()
  })
})
