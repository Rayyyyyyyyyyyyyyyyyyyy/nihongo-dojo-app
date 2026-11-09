// Port of NHK-N3-1 src/domain/bankContract.mjs and tools/data-contract.mjs @ aadd243.
import { LEVELS, type Level, type LevelMap } from '../progress/state'
import type { BankKind, Banks, Vocab } from './types'

type Loose = Record<string, any>
const object = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message)
}
function unique(ids: unknown[], label: string) {
  check(new Set(ids).size === ids.length, `${label}: duplicate ID`)
}
function question(q: Loose) {
  for (const key of ['q', 'answer', 'explanation'])
    check(text(q[key]), `${key}: expected nonempty string`)
  check(Array.isArray(q.distractors) && q.distractors.length === 3, 'three distractors required')
  check(q.distractors.every(text), 'distractor: expected nonempty string')
  check(new Set([q.answer, ...q.distractors]).size === 4, 'four unique options required')
}
export function assertBank<K extends BankKind>(
  kind: K,
  items: unknown,
  level?: Level,
): asserts items is Banks[K][] {
  check(['vocab', 'grammar', 'reading', 'listening'].includes(kind), 'unknown bank kind')
  check(Array.isArray(items), `${kind}: expected array`)
  for (const item of items as unknown[]) {
    check(object(item), `${kind}: expected item object`)
    if (kind === 'vocab') {
      check(text(item.w) && text(item.r), 'word and reading: expected nonempty string')
      check(
        typeof item.zh === 'string' && typeof item.en === 'string',
        'vocabulary translations must be strings',
      )
      check(item.zh.trim() || item.en.trim(), 'at least one translation required')
      continue
    }
    check(text(item.id), `${kind}: expected nonempty ID`)
    if (kind === 'grammar') {
      check(
        LEVELS.includes(level!) && new RegExp(`^g-${level}-\\d{3,}$`).test(item.id),
        'invalid grammar ID or level',
      )
      question(item)
      continue
    }
    check(LEVELS.includes(item.level), `invalid ${kind} level`)
    if (kind === 'listening') {
      check(text(item.script), 'script: expected nonempty string')
      question(item)
      continue
    }
    for (const key of ['title', 'type', 'text'])
      check(text(item[key]), `${key}: expected nonempty string`)
    check(Array.isArray(item.notes), 'notes required')
    for (const note of item.notes)
      check(object(note) && text(note.term) && text(note.meaning), 'invalid reading note')
    check(Array.isArray(item.questions) && item.questions.length > 0, 'article must have questions')
    for (const q of item.questions) {
      check(object(q) && text(q.id), 'subquestion: expected nonempty ID')
      question(q)
    }
  }
  const list = items as Loose[]
  if (kind !== 'vocab')
    unique(
      list.map((x) => x.id),
      kind,
    )
  if (kind === 'reading')
    unique(
      list.flatMap((x) => x.questions.map((q: Loose) => q.id)),
      'reading subquestion',
    )
}
export const vocabCount = (items: readonly Vocab[]) => new Set(items.map((v) => v.w)).size

export type BankCounts = LevelMap<Record<BankKind, number>>
export interface RawBanks {
  vocab: LevelMap<unknown>
  grammar: LevelMap<unknown>
  reading: unknown
  listening: unknown
}
export function checkData(banks: RawBanks, expectedCounts?: unknown): BankCounts {
  const { vocab, grammar, reading, listening } = banks
  assertBank('reading', reading)
  assertBank('listening', listening)
  const counts = {} as BankCounts
  for (const lv of LEVELS) {
    const v = vocab[lv],
      g = grammar[lv]
    assertBank('vocab', v, lv)
    assertBank('grammar', g, lv)
    counts[lv] = {
      vocab: vocabCount(v),
      grammar: g.length,
      reading: reading.filter((x) => x.level === lv).length,
      listening: listening.filter((x) => x.level === lv).length,
    }
  }
  // shortcut: key-order sensitive (web used deepEqual); counts.json is written by our own script in this order.
  if (expectedCounts !== undefined)
    check(
      JSON.stringify(expectedCounts) === JSON.stringify(counts),
      'counts.json is stale; run npm run check:data -- --write',
    )
  return counts
}
