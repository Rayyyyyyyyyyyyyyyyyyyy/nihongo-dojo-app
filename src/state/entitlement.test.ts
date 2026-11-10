// F1／D16：今日任務與加練不可繞過付費；未購 N3–N1 只從第 1 課取題，購買後擴大。
import { bankManifest, loadLevel } from '../data/bank'
import type { BankKind } from '../domain/bank/types'
import { dayKey, type StudyKind } from '../domain/learning/types'
import type { Level } from '../domain/progress/state'
import { extraQueue, todayQueue } from '../screens/session/queue'
import { ensurePlan, markVocab, repairPlan } from './core'
import { createDoc, type AppStateDoc } from './doc'

const TODAY = '2026-11-12'
const clock = () => new Date(2026, 10, 12, 9)
const free = (level: Level, kind: BankKind) => new Set(bankManifest.levels[level].lessons[kind][0].itemIds)
const userAt = (level: Level, owned: boolean): AppStateDoc => {
  const d = createDoc('x', () => new Date(2026, 10, 10, 9))
  let doc: AppStateDoc = {
    ...d,
    learning: { ...d.learning, level },
    settings: { ...d.settings, dailyMinutes: 20 },
    entitlement: { ...d.entitlement, owned },
  }
  // 第 1 課單字全部掌握：舊行為會從第 2 課起補今日單字。
  for (const w of free(level, 'vocab')) doc = markVocab(doc, level, w, true)
  return doc
}
const targets = (doc: AppStateDoc, kind: StudyKind) =>
  doc.learning.plans[dayKey(TODAY, doc.learning.level)].groups[kind]?.targets.map((t) => t.id) ?? []
const outside = (level: Level, kind: BankKind, ids: string[]) => ids.filter((id) => !free(level, kind).has(id))
const extraIds = (doc: AppStateDoc, kind: StudyKind) =>
  extraQueue(doc, loadLevel(doc.learning.level), TODAY, bankManifest)
    .items.filter((i) => i.refs[0].kind === kind)
    .map((i) => (kind === 'reading' ? i.refs[0].articleId! : i.refs[0].id))

describe.each(['n3', 'n2', 'n1'] as const)('%s 未購買：今日任務與加練只出第 1 課', (level) => {
  const bank = loadLevel(level)
  const planned = ensurePlan(userAt(level, false), 'listening', clock, bank, bankManifest)

  test('今日任務每一組的目標都在第 1 課', () => {
    for (const kind of ['vocab', 'grammar', 'reading', 'listening'] as const) expect(outside(level, kind, targets(planned, kind))).toEqual([])
    expect(targets(planned, 'grammar').length).toBeGreaterThan(0)
  })
  test('加練的題目都在第 1 課', () => {
    for (const kind of ['vocab', 'grammar', 'reading', 'listening'] as const) expect(outside(level, kind, extraIds(planned, kind))).toEqual([])
  })
})

describe('購買狀態改變時', () => {
  const bank = loadLevel('n3')
  test('已購買：今日任務與加練從整個等級取題', () => {
    const doc = ensurePlan(userAt('n3', true), 'listening', clock, bank, bankManifest)
    expect(outside('n3', 'vocab', targets(doc, 'vocab')).length).toBeGreaterThan(0)
    expect(outside('n3', 'vocab', extraIds(doc, 'vocab')).length).toBeGreaterThan(0)
  })
  test('未購時排好的任務在購買後仍有效（不需修復），加練立即擴大', () => {
    const unowned = ensurePlan(userAt('n3', false), 'listening', clock, bank, bankManifest)
    const owned = { ...unowned, entitlement: { ...unowned.entitlement, owned: true } }
    expect(todayQueue(owned, bank, TODAY, bankManifest).missing).toEqual([])
    expect(ensurePlan(owned, 'listening', clock, bank, bankManifest)).toBe(owned)
    expect(outside('n3', 'vocab', extraIds(owned, 'vocab')).length).toBeGreaterThan(0)
  })
  test('失去購買（退款）後，付費目標視為失效並只換成第 1 課的題目', () => {
    const owned = ensurePlan(userAt('n3', true), 'listening', clock, bank, bankManifest)
    const lost = { ...owned, entitlement: { ...owned.entitlement, owned: false } }
    const q = todayQueue(lost, bank, TODAY, bankManifest)
    expect(q.missing).toContain('vocab')
    expect(q.items.filter((i) => i.refs[0].kind === 'vocab').map((i) => i.refs[0].id).filter((id) => !free('n3', 'vocab').has(id))).toEqual([])
    let repaired = lost
    for (const kind of q.missing) repaired = repairPlan(repaired, kind, clock, bank, bankManifest)
    for (const kind of ['vocab', 'grammar', 'listening'] as const) expect(outside('n3', kind, targets(repaired, kind))).toEqual([])
    expect(todayQueue(repaired, bank, TODAY, bankManifest).missing).toEqual([])
  })
})
