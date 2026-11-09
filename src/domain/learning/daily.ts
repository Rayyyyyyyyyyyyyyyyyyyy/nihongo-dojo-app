// 每日目標份量（handoff §2.5 [假設，需校準]）：5／10／20 分鐘決定今日任務各組題數與包含的組。
import type { DailyPlan, StudyKind } from './types'

export type DailyMinutes = 5 | 10 | 20
type Branch = DailyPlan['branch']

export const DAILY_LIMITS: Record<DailyMinutes, Record<StudyKind, number>> = {
  5: { vocab: 5, grammar: 3, reading: 1, listening: 1 },
  10: { vocab: 10, grammar: 5, reading: 1, listening: 3 },
  20: { vocab: 20, grammar: 10, reading: 1, listening: 3 },
}

// 5 分鐘只有聽力 1；10 分鐘讀解或聽力擇一；20 分鐘兩者都有。
export function planKinds(minutes: DailyMinutes, branch: Branch): StudyKind[] {
  if (minutes === 5) return ['vocab', 'grammar', 'listening']
  if (minutes === 20) return ['vocab', 'grammar', 'reading', 'listening']
  return ['vocab', 'grammar', branch]
}

export const planBranch = (minutes: DailyMinutes, branch: Branch): Branch => (minutes === 5 ? 'listening' : branch)

// 已排好的任務要完成哪些組：單字、文法、分支，加上排進來的另一個深入練習（20 分鐘）。
export function requiredKinds(plan: DailyPlan): StudyKind[] {
  const other: StudyKind = plan.branch === 'reading' ? 'listening' : 'reading'
  return ['vocab', 'grammar', plan.branch, ...(plan.groups[other] ? [other] : [])]
}
