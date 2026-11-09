import manifest from './manifest.json'
import { assertBank } from '../../domain/bank/contract'
import type { BankManifest } from '../../domain/bank/manifest'
import type { Grammar, Listening, Reading, Vocab } from '../../domain/bank/types'
import { itemKey } from '../../domain/learning/types'
import type { Level } from '../../domain/progress/state'

export const bankManifest = manifest as BankManifest

// Metro bundles every file below, but a JSON module is evaluated only on its first require.
const vocab: Record<Level, () => unknown> = {
  n5: () => require('./vocab-n5.json'),
  n4: () => require('./vocab-n4.json'),
  n3: () => require('./vocab-n3.json'),
  n2: () => require('./vocab-n2.json'),
  n1: () => require('./vocab-n1.json'),
}
const grammar: Record<Level, () => unknown> = {
  n5: () => require('./grammar-n5.json'),
  n4: () => require('./grammar-n4.json'),
  n3: () => require('./grammar-n3.json'),
  n2: () => require('./grammar-n2.json'),
  n1: () => require('./grammar-n1.json'),
}

export interface LevelBank {
  vocab: Vocab[]
  grammar: Grammar[]
  reading: Reading[]
  listening: Listening[]
}
const cache: Partial<Record<Level, LevelBank>> = {}

// Throws when a built-in file fails the bank contract (handoff §2.1: show S2 error, allow retry).
export function loadLevel(level: Level): LevelBank {
  const hit = cache[level]
  if (hit) return hit
  const v = vocab[level](),
    g = grammar[level](),
    r: unknown = require('./reading.json'),
    l: unknown = require('./listening.json')
  assertBank('vocab', v, level)
  assertBank('grammar', g, level)
  assertBank('reading', r)
  assertBank('listening', l)
  const retired = new Set(bankManifest.retiredIds.map((x) => x.key))
  const ships = (kind: 'grammar' | 'reading' | 'listening', id: string) =>
    !retired.has(itemKey({ level, kind, id }))
  return (cache[level] = {
    vocab: v,
    grammar: g.filter((x) => ships('grammar', x.id)),
    reading: r.filter((x) => x.level === level && ships('reading', x.id)),
    listening: l.filter((x) => x.level === level && ships('listening', x.id)),
  })
}
