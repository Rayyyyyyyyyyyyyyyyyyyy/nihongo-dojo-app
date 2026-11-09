import { createHash } from 'node:crypto'
import { parseLedger, reviewContent, reviewGate, type LedgerEntry } from './review'
import { RETIRED_IDS } from './manifest'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const draft = (id: string, q = '雨＿＿降る。') => ({
  id,
  q,
  answer: 'が',
  distractors: ['を', 'に', 'で'],
  explanation: '解',
  grammarPoint: '〜が',
  origin: 'ai-draft',
  draftedAt: '2026-11-09',
  source: 'AI 起草（未經人工審閱）2026-11-09',
})
const entry = (id: string, item: object, decision: LedgerEntry['decision']): LedgerEntry => ({
  key: ['n3', 'grammar', id],
  contentHash: sha(reviewContent(item as Record<string, unknown>)),
  decision,
  reviewer: 'R1',
  role: 'native-teacher',
  date: '2026-12-01',
  notes: '',
})
const gate = (items: unknown[], ledger: LedgerEntry[], official = new Set<string>()) =>
  reviewGate({ n3: { grammar: items } }, ledger, official, RETIRED_IDS, sha)

it('hashes content with stable key order and without provenance fields', () => {
  const a = draft('g-n3-031')
  const { q, id, ...rest } = a
  expect(reviewContent({ ...rest, origin: 'x', source: 'y', id, q })).toBe(reviewContent(a))
  expect(reviewContent({ ...a, q: '別' })).not.toBe(reviewContent(a))
})

it('ships only approved drafts whose hash matches, relabelled as reviewed', () => {
  const [a, b, c, d] = ['031', '032', '033', '034'].map((n) => draft(`g-n3-${n}`, `文${n}＿＿。`))
  const r = gate([a, b, c, d], [entry(a.id, a, 'approve'), entry(b.id, b, 'revise'), entry(c.id, c, 'reject')])
  expect(r.reviewed.grammar.n3.map((x) => x.id)).toEqual(['g-n3-031'])
  expect(r.reviewed.grammar.n3[0]).toMatchObject({ origin: 'ai-draft-human-reviewed', grammarPoint: '〜が' })
  expect(r.reviewed.grammar.n3[0]).not.toHaveProperty('draftedAt')
  expect([r.total, r.pending.map((p) => p.key), r.revise, r.rejected, r.errors]).toEqual([
    4,
    ['["n3","grammar","g-n3-034"]'],
    ['["n3","grammar","g-n3-032"]'],
    ['["n3","grammar","g-n3-033"]'],
    [],
  ])
})

it('fails when approved content was edited, and re-queues edited revise/reject items', () => {
  const a = draft('g-n3-031')
  const r = gate([{ ...a, answer: 'は' }], [entry(a.id, a, 'approve')])
  expect(r.reviewed.grammar.n3).toEqual([])
  expect(r.errors).toEqual([expect.stringContaining('content changed after approval')])
  const later = gate([{ ...a, answer: 'は' }], [entry(a.id, a, 'approve'), entry(a.id, a, 'revise')])
  expect([later.errors, later.pending.length]).toEqual([[], 1])
})

it('rejects draft IDs used by the bank or retired, and missing draft fields', () => {
  expect(() => gate([draft('g-n3-005')], [])).toThrow('retired')
  expect(() => gate([draft('g-n3-031')], [], new Set(['["n3","grammar","g-n3-031"]']))).toThrow('already used')
  expect(() => gate([{ ...draft('g-n3-031'), grammarPoint: '' }], [])).toThrow('grammarPoint')
  expect(() => gate([{ ...draft('g-n3-031'), origin: undefined }], [])).toThrow('origin')
  expect(() => gate([{ ...draft('g-n3-031'), distractors: ['を', 'を', 'に'] }], [])).toThrow('four unique')
})

it('validates ledger lines', () => {
  const ok = entry('g-n3-031', draft('g-n3-031'), 'approve')
  expect(parseLedger(`${JSON.stringify(ok)}\n\n`)).toEqual([ok])
  expect(() => parseLedger('{')).toThrow('line 1: invalid JSON')
  expect(() => parseLedger(JSON.stringify({ ...ok, decision: 'ok' }))).toThrow('decision')
  expect(() => parseLedger(JSON.stringify({ ...ok, contentHash: 'abc' }))).toThrow('contentHash')
  expect(() => parseLedger(JSON.stringify({ ...ok, key: ['n3', 'vocab', 'x'] }))).toThrow('key')
  expect(() => parseLedger(JSON.stringify({ ...ok, date: '12/1' }))).toThrow('date')
})
