// S2 道場的推導值（只讀文件，不另存完成紀錄）。
import type { LevelBank } from '../../data/bank'
import { requiredKinds } from '../../domain/learning/daily'
import { inspectGroup, priority } from '../../domain/learning/plans'
import { addDays, localDate } from '../../domain/learning/calendar'
import { refAccessible } from '../../domain/access'
import type { BankManifest } from '../../domain/bank/manifest'
import { dayKey, type StudyItemRef } from '../../domain/learning/types'
import { useAppState, useServices } from '../../state/AppProvider'
import type { AppStateDoc } from '../../state/doc'

// 未購時付費課的紀錄不計（與 reviewQueue 的購買限制一致），否則徽章會停在清不掉的數字。
export function reviewCounts(doc: AppStateDoc, today: string, manifest: BankManifest) {
  const level = doc.learning.level
  const open = (ref: StudyItemRef) => refAccessible(ref, manifest.levels[level], doc.entitlement.owned)
  const due = Object.values(doc.learning.schedules).filter((s) => s.ref.level === level && s.dueOn <= today && open(s.ref)).length
  const mistakes = Object.values(doc.learning.mistakes).filter((m) => m.ref.level === level && m.pending && open(m.ref)).length
  return { due, mistakes }
}

// 道場分頁徽章：本等級到期單字＋待複習錯題。
export function useDueCount(): number {
  const { clock, bank } = useServices()
  return useAppState((s) => {
    if (!s.doc) return 0
    const c = reviewCounts(s.doc, localDate(clock()), bank.manifest)
    return c.due + c.mistakes
  })
}

export function todayProgress(doc: AppStateDoc, bank: LevelBank, today: string) {
  const plan = doc.learning.plans[dayKey(today, doc.learning.level)]
  if (!plan) return null
  let done = 0,
    total = 0,
    allKnown = true,
    firstWord: { w: string; r: string } | null = null
  for (const kind of requiredKinds(plan)) {
    const g = inspectGroup(doc.learning, plan, kind, bank[kind] as never[])
    done += g.done
    total += g.total
    if (kind === 'vocab' && g.selected.length) firstWord = g.selected[0] as { w: string; r: string }
    // 「都學過了」：今天的目標全是已掌握（未到期單字、已答對的文法／讀解／聽力）。
    for (const ref of plan.groups[kind]?.targets ?? [])
      if (priority(doc.learning, ref, today)[0] < (kind === 'vocab' ? 3 : kind === 'grammar' ? 2 : 1)) allKnown = false
  }
  return { plan, done, total, firstWord, allKnown: total > 0 && allKnown, started: done > 0 }
}

export const yesterday = (today: string) => addDays(today, -1)
