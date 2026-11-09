// 課的進度（S7「已做／總數、掌握數」）：只讀移植的學習狀態，掌握判定沿用既有欄位。
import { itemKey, type StudyKind } from '../../domain/learning/types'
import type { Level, ProgressState } from '../../domain/progress/state'

export function lessonStats(s: ProgressState, level: Level, kind: StudyKind, ids: string[]) {
  const key = (id: string) => itemKey({ level, kind, id })
  const tried = new Set(s.results.filter((r) => r.ref.level === level && r.ref.kind === kind).map((r) => r.ref.articleId ?? r.ref.id))
  const mastered = (id: string) =>
    kind === 'vocab' ? Object.hasOwn(s.vKnown[level], id) : kind === 'grammar' ? s.gDone[level].includes(id) : kind === 'listening' ? s.lCorrect[level].includes(id) : s.rDone[level].includes(id)
  const done = (id: string) =>
    tried.has(id) || mastered(id) || (kind === 'vocab' && (Object.hasOwn(s.vLearning[level], id) || !!s.schedules[key(id)])) || (kind === 'listening' && s.lDone[level].includes(id))
  return { done: ids.filter(done).length, mastered: ids.filter(mastered).length, total: ids.length }
}
