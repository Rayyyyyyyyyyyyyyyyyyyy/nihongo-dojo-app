// BankManifest per handoff §2.1. Levels stay lowercase so keys match web v5 item keys.
import { itemKey } from '../learning/types'
import { LEVELS, mapLevels, type Level, type LevelMap } from '../progress/state'
import type { BankKind, Grammar, Listening, Reading, Vocab } from './types'

export const CONTENT_VERSION = '2026.11.1'
// Decision F5-7 [assumption]: lessons follow bank order; vocab trial matches the first lesson.
export const LESSON_SIZE: Record<BankKind, number> = { vocab: 100, grammar: 10, reading: 2, listening: 6 }

export interface LessonIndex {
  lessonNo: number
  itemIds: string[]
}
export interface RetiredId {
  key: string
  reason: 'unsourced' | 'rewritten' | 'removed'
  replacedBy?: string
}
export interface LevelManifest {
  counts: Record<BankKind, number>
  lessons: Record<BankKind, LessonIndex[]>
  free: 'all' | 'firstLesson'
}
export interface BankManifest {
  contentVersion: string
  levels: LevelMap<LevelManifest>
  retiredIds: RetiredId[]
}
export interface ValidBanks {
  vocab: LevelMap<Vocab[]>
  grammar: LevelMap<Grammar[]>
  reading: Reading[]
  listening: Listening[]
}

// U2 safe default: items without a source are not shipped; old IDs stay listed so imports show them as unavailable.
const n3 = (kind: BankKind, id: string): RetiredId => ({
  key: itemKey({ level: 'n3', kind, id }),
  reason: 'unsourced',
})
export const RETIRED_IDS: RetiredId[] = [
  ...Array.from({ length: 20 }, (_, i) => n3('grammar', `g-n3-${String(i + 1).padStart(3, '0')}`)),
  n3('reading', 'r1'),
  ...['l1', 'l2', 'l7', 'l8'].map((id) => n3('listening', id)),
]

const chunk = (ids: string[], size: number): LessonIndex[] =>
  Array.from({ length: Math.ceil(ids.length / size) }, (_, i) => ({
    lessonNo: i + 1,
    itemIds: ids.slice(i * size, (i + 1) * size),
  }))

export function shippedIds(banks: ValidBanks, level: Level, retired: RetiredId[]) {
  const gone = new Set(retired.map((r) => r.key))
  const ids: Record<BankKind, string[]> = {
    vocab: [...new Set(banks.vocab[level].map((v) => v.w))],
    grammar: banks.grammar[level].map((x) => x.id),
    reading: banks.reading.filter((x) => x.level === level).map((x) => x.id),
    listening: banks.listening.filter((x) => x.level === level).map((x) => x.id),
  }
  for (const kind of Object.keys(ids) as BankKind[])
    ids[kind] = ids[kind].filter((id) => !gone.has(itemKey({ level, kind, id })))
  return ids
}

export function buildManifest(
  banks: ValidBanks,
  retired: RetiredId[] = RETIRED_IDS,
  contentVersion = CONTENT_VERSION,
): BankManifest {
  return {
    contentVersion,
    levels: mapLevels((level) => {
      const ids = shippedIds(banks, level, retired)
      const kinds = Object.keys(ids) as BankKind[]
      return {
        counts: Object.fromEntries(kinds.map((k) => [k, ids[k].length])) as LevelManifest['counts'],
        lessons: Object.fromEntries(
          kinds.map((k) => [k, chunk(ids[k], LESSON_SIZE[k])]),
        ) as LevelManifest['lessons'],
        free: LEVELS.indexOf(level) < 2 ? 'all' : 'firstLesson',
      }
    }),
    retiredIds: retired,
  }
}
