// C10 review gate (Q12 §6.3): drafts ship only when the ledger's latest decision approves their exact content.
// Pure rules; the CLI injects sha256 so this module stays free of Node and Expo APIs.
import { itemKey } from '../learning/types'
import { LEVELS, mapLevels, type Level, type LevelMap } from '../progress/state'
import { assertBank } from './contract'
import type { RetiredId } from './manifest'
import type { Grammar, Listening, Reading } from './types'

export const DRAFT_KINDS = ['grammar', 'reading', 'listening'] as const
export type DraftKind = (typeof DRAFT_KINDS)[number]
export type DraftFiles = Partial<LevelMap<Partial<Record<DraftKind, unknown>>>>
export interface ReviewedBank {
  grammar: LevelMap<Grammar[]>
  reading: Reading[]
  listening: Listening[]
}
export const DECISIONS = ['approve', 'reject', 'revise'] as const
export interface LedgerEntry {
  key: [Level, DraftKind, string]
  contentHash: string
  decision: (typeof DECISIONS)[number]
  reviewer: string
  role: string
  date: string
  notes: string
}

// Provenance fields describe the review, not the item, so they are left out of the hash.
const REVIEW_FIELDS = ['origin', 'source', 'draftedAt']
const sorted = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted((v as Record<string, unknown>)[k])]),
        )
      : v
export const reviewContent = (item: Record<string, unknown>) =>
  JSON.stringify(sorted(Object.fromEntries(Object.entries(item).filter(([k]) => !REVIEW_FIELDS.includes(k)))))

const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export function parseLedger(source: string): LedgerEntry[] {
  return source.split('\n').flatMap((line, i) => {
    if (!line.trim()) return []
    const at = `ledger line ${i + 1}`
    let e: any
    try {
      e = JSON.parse(line)
    } catch {
      throw Error(`${at}: invalid JSON`)
    }
    const k = e?.key
    if (!(Array.isArray(k) && k.length === 3 && LEVELS.includes(k[0]) && DRAFT_KINDS.includes(k[1]) && text(k[2])))
      throw Error(`${at}: key must be [level, grammar|reading|listening, id]`)
    if (!(typeof e.contentHash === 'string' && /^[0-9a-f]{64}$/.test(e.contentHash)))
      throw Error(`${at}: contentHash must be 64 hex chars`)
    if (!DECISIONS.includes(e.decision)) throw Error(`${at}: decision must be approve|reject|revise`)
    if (!(text(e.reviewer) && text(e.role))) throw Error(`${at}: reviewer and role required`)
    if (!date(e.date)) throw Error(`${at}: date must be YYYY-MM-DD`)
    if (typeof e.notes !== 'string') throw Error(`${at}: notes must be a string`)
    return [e as LedgerEntry]
  })
}

export interface ReviewReport {
  reviewed: ReviewedBank
  total: number
  pending: { key: string; contentHash: string }[]
  revise: string[]
  rejected: string[]
  errors: string[]
}

// officialIds: itemKey of every item in the bank files, retired ones included.
export function reviewGate(
  drafts: DraftFiles,
  ledger: LedgerEntry[],
  officialIds: Set<string>,
  retired: RetiredId[],
  hash: (content: string) => string,
): ReviewReport {
  const latest = new Map(ledger.map((e) => [JSON.stringify(e.key), e]))
  const taken = new Set([...officialIds, ...retired.map((r) => r.key)])
  const report: ReviewReport = {
    reviewed: { grammar: mapLevels(() => []), reading: [], listening: [] },
    total: 0,
    pending: [],
    revise: [],
    rejected: [],
    errors: [],
  }
  for (const level of LEVELS)
    for (const kind of DRAFT_KINDS) {
      const items = drafts[level]?.[kind]
      if (items === undefined) continue
      const where = `drafts/${level}/${kind}.json`
      try {
        assertBank(kind, items, level)
      } catch (e) {
        throw Error(`${where}: ${(e as Error).message}`)
      }
      for (const item of items as (Grammar | Reading | Listening)[]) {
        const raw = item as unknown as Record<string, unknown>
        const key = itemKey({ level, kind, id: item.id })
        const at = `${where} ${item.id}`
        if (kind !== 'grammar' && raw.level !== level) throw Error(`${at}: level must be ${level}`)
        if (raw.origin !== 'ai-draft') throw Error(`${at}: origin must be 'ai-draft'`)
        if (!date(raw.draftedAt) || !text(raw.source)) throw Error(`${at}: draftedAt and source required`)
        if (kind === 'grammar' && !text(raw.grammarPoint)) throw Error(`${at}: grammarPoint required`)
        if (taken.has(key)) throw Error(`${at}: ID already used by the bank or retired`)
        taken.add(key)
        report.total++
        const contentHash = hash(reviewContent(raw))
        const entry = latest.get(key)
        if (!entry || (entry.decision !== 'approve' && entry.contentHash !== contentHash))
          report.pending.push({ key, contentHash })
        else if (entry.decision === 'approve' && entry.contentHash !== contentHash)
          report.errors.push(`${at}: content changed after approval on ${entry.date}; review again`)
        else if (entry.decision === 'revise') report.revise.push(key)
        else if (entry.decision === 'reject') report.rejected.push(key)
        else {
          const { draftedAt: _, ...rest } = raw
          const shipped = {
            ...rest,
            origin: 'ai-draft-human-reviewed',
            source: `本專案原創練習題，非 JLPT 官方試題；AI 輔助起草，經人工審閱 ${entry.date}。`,
          }
          if (kind === 'grammar') report.reviewed.grammar[level].push(shipped as unknown as Grammar)
          else (report.reviewed[kind] as unknown[]).push(shipped)
        }
      }
    }
  return report
}
