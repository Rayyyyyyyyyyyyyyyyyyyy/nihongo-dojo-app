// 本機提醒排程規則（app-design S18；決策 F5-4）。純函式，時鐘由呼叫端傳入。
import { addDays, localDate } from './learning/calendar'

export interface ReminderInput {
  enabled: boolean
  time: string // 'HH:mm'
  ignoredCount: number // 連續沒回應的提醒數
  streak: number // 排程當下的有效連勝
  practicedToday: boolean
  today: string
  now: Date
}

const WINDOW_DAYS = 7 // 每次進前景重排未來 7 天（研究 §7 推論）

const at = (day: string, time: string) => {
  const [y, m, d] = day.split('-').map(Number),
    [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}

// 連勝 ≥3 且當天沒練才提醒；每天最多 1 則；連續 3 次沒回應後改為每 3 天 1 則。
// 「14 天沒開就停止」由視窗保證：只在 App 開啟時排未來 7 天，沒開就不會再排新的。
export function reminderTimes(i: ReminderInput): Date[] {
  if (!i.enabled || i.streak < 3) return []
  const out: Date[] = []
  let ignored = i.ignoredCount,
    last = -Infinity
  for (let d = 0; d < WINDOW_DAYS; d++) {
    if (d === 0 && i.practicedToday) continue
    const t = at(addDays(i.today, d), i.time)
    if (t <= i.now) continue
    if (ignored >= 3 && d - last < 3) continue
    out.push(t)
    last = d
    ignored++ // 預設沒回應；使用者開 App 時會重排並重算
  }
  return out
}

// App 進前景時：重算上次開啟時排下的提醒，哪些已經響過。之後的日子響過卻沒開 App 算沒回應；
// 今天響過後打開 App 算回應，計數歸零。上次開啟以來學習狀態沒變（沒開 App 就不能作答），所以可以重算。
export function ignoredCountOnOpen(
  prev: Omit<ReminderInput, 'today' | 'now' | 'practicedToday'> & { lastAppOpen: string },
  today: string,
  now: Date,
): number {
  if (prev.lastAppOpen >= today) return prev.ignoredCount
  const fired = reminderTimes({
    ...prev,
    practicedToday: true,
    today: prev.lastAppOpen,
    now: at(prev.lastAppOpen, '23:59'),
  }).filter((t) => t <= now)
  if (!fired.length) return prev.ignoredCount
  return localDate(fired[fired.length - 1]) === today ? 0 : prev.ignoredCount + fired.length
}

export const reminderBody = (minutes: number) => `今天的 ${minutes} 分鐘修行還在等你`
