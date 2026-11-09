// 鎖定判定（handoff §2.3、app-design §5.1）：N5/N4 全開；N3–N1 第 1 課免費；第一天點鎖定課只開說明（S14a）。
import type { LevelManifest } from './bank/manifest'

export type LessonAccess = 'open' | 'explainOnly' | 'paywall'

export function lessonAccess(a: {
  free: LevelManifest['free']
  lessonNo: number
  owned: boolean
  today: string
  firstOpenDate: string
}): LessonAccess {
  if (a.free === 'all' || a.lessonNo <= 1 || a.owned) return 'open'
  return a.today === a.firstOpenDate ? 'explainOnly' : 'paywall'
}
