// Ported from NHK-N3-1 @ aadd243: src/domain/bankContract.test.ts (CLI adapter half; the fetch
// runtime adapter is not ported) and the "data check fails for %s" cases of learning/data.test.ts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkData } from './contract'
import { mapLevels, LEVELS } from '../progress/state'
import type { BankKind } from './types'

const question = { q: '問題', answer: '正', distractors: ['一', '二', '三'], explanation: '解説' }
const vocab = { w: '九', r: 'きゅう', zh: '九', en: 'nine' }
const grammar = { ...question, id: 'g-n3-001' }
const reading = {
  id: 'article',
  level: 'n3',
  title: '題',
  type: '文',
  text: '本文',
  notes: [],
  questions: [{ ...question, id: 'rq-1' }],
}
const listening = { ...question, id: 'listen', level: 'n3', script: '逐字稿' }
const valid = { vocab: [vocab], grammar: [grammar], reading: [reading], listening: [listening] }
function cliInput(kind: BankKind, items: unknown[]) {
  const banks = {
    vocab: mapLevels(() => [] as unknown[]),
    grammar: mapLevels(() => [] as unknown[]),
    reading: [] as unknown[],
    listening: [] as unknown[],
  }
  if (kind === 'vocab' || kind === 'grammar') banks[kind].n3 = items
  else banks[kind] = items
  return banks
}

it.each<BankKind>(['vocab', 'grammar', 'reading', 'listening'])(
  'accepts the same valid %s content',
  (kind) => {
    expect(() => checkData(cliInput(kind, valid[kind]))).not.toThrow()
  },
)

const invalid: [BankKind, string, unknown[]][] = [
  ['vocab', 'null item', [null]],
  ['vocab', 'no translation', [{ ...vocab, zh: '', en: ' ' }]],
  ['vocab', 'blank reading', [{ ...vocab, r: ' ' }]],
  ['grammar', 'wrong level ID', [{ ...grammar, id: 'g-n2-001' }]],
  ['grammar', 'duplicate ID', [grammar, grammar]],
  ['grammar', 'answer among distractors', [{ ...grammar, distractors: ['正', '二', '三'] }]],
  ['grammar', 'too few options', [{ ...grammar, distractors: ['一', '二'] }]],
  ['reading', 'empty article', [{ ...reading, questions: [] }]],
  ['reading', 'invalid level', [{ ...reading, level: 'n6' }]],
  ['reading', 'invalid note', [{ ...reading, notes: [null] }]],
  ['reading', 'subquestion ID reused across articles', [reading, { ...reading, id: 'other' }]],
  ['listening', 'blank script', [{ ...listening, script: ' ' }]],
]
it.each(invalid)('rejects %s %s', (kind, _name, items) => {
  expect(() => checkData(cliInput(kind, items))).toThrow()
})

it('preserves alternate readings while counting one learning item', () => {
  const items = [vocab, { ...vocab, r: 'く' }]
  expect(checkData(cliInput('vocab', items)).n3.vocab).toBe(1)
})

const read = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '../../data/bank', `${name}.json`), 'utf8'))
const banks = () => ({
  vocab: mapLevels((lv) => read(`vocab-${lv}`)),
  grammar: mapLevels((lv) => read(`grammar-${lv}`)),
  reading: read('reading'),
  listening: read('listening'),
})

it('uses distinct words for all generated vocabulary denominators', () => {
  const data = banks()
  const counts = checkData(data, read('counts'))
  for (const lv of LEVELS)
    expect(counts[lv].vocab).toBe(new Set(data.vocab[lv].map((v: { w: string }) => v.w)).size)
})

it.each([
  'duplicate-subquestion',
  'empty-article',
  'stale-counts',
  'invalid-level',
  'blank-script',
  'duplicate-option',
])('data check fails for %s', (mode) => {
  const data = banks(),
    counts = read('counts')
  if (mode === 'duplicate-subquestion')
    data.reading[0].questions[1].id = data.reading[0].questions[0].id
  if (mode === 'empty-article') data.reading[0].questions = []
  if (mode === 'stale-counts') counts.n3.grammar--
  if (mode === 'invalid-level') data.listening[0].level = 'n6'
  if (mode === 'blank-script') data.listening[0].script = ' '
  if (mode === 'duplicate-option') data.grammar.n3[0].distractors[0] = data.grammar.n3[0].answer
  expect(() => checkData(data, counts)).toThrow()
})
