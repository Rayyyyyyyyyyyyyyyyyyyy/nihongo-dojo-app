import { ignoredCountOnOpen, reminderTimes, type ReminderInput } from './reminder'

const base: ReminderInput = {
  enabled: true,
  time: '20:00',
  ignoredCount: 0,
  streak: 3,
  practicedToday: false,
  today: '2026-11-10',
  now: new Date(2026, 10, 10, 9, 0),
}
const days = (ts: Date[]) => ts.map((t) => `${t.getMonth() + 1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`)

describe('提醒排程（S18、F5-4）', () => {
  test('連勝 ≥3 且當天未練：在選定時段每天最多 1 則；預設沒回應，第 4 則起每 3 天 1 則', () => {
    expect(days(reminderTimes(base))).toEqual(['11/10 20:00', '11/11 20:00', '11/12 20:00', '11/15 20:00'])
  })

  test('連勝不到 3 天或關閉提醒：不排任何提醒', () => {
    expect(reminderTimes({ ...base, streak: 2 })).toEqual([])
    expect(reminderTimes({ ...base, enabled: false })).toEqual([])
  })

  test('今天已練或時段已過：今天不提醒', () => {
    expect(days(reminderTimes({ ...base, practicedToday: true }))[0]).toBe('11/11 20:00')
    expect(days(reminderTimes({ ...base, now: new Date(2026, 10, 10, 21, 0) }))[0]).toBe('11/11 20:00')
  })

  test('連續 3 次沒回應後改為每 3 天 1 則', () => {
    expect(days(reminderTimes({ ...base, ignoredCount: 1 }))).toEqual(['11/10 20:00', '11/11 20:00', '11/14 20:00'])
    expect(days(reminderTimes({ ...base, ignoredCount: 3 }))).toEqual(['11/10 20:00', '11/13 20:00', '11/16 20:00'])
  })

  test('開 App 時：之前的日子響過沒開算沒回應，今天響過後打開歸零，沒響過不變', () => {
    const prev = { ...base, lastAppOpen: '2026-11-07' }
    // 11/08、11/09 響過沒開；11/10 20:00 還沒響
    expect(ignoredCountOnOpen(prev, '2026-11-10', new Date(2026, 10, 10, 9, 0))).toBe(2)
    // 11/10 20:00 響過後打開
    expect(ignoredCountOnOpen(prev, '2026-11-10', new Date(2026, 10, 10, 20, 30))).toBe(0)
    // 同一天再開：不變
    expect(ignoredCountOnOpen({ ...prev, ignoredCount: 2, lastAppOpen: '2026-11-10' }, '2026-11-10', new Date(2026, 10, 10, 22, 0))).toBe(2)
    // 上次連勝不足 3：沒排過提醒
    expect(ignoredCountOnOpen({ ...prev, streak: 1 }, '2026-11-10', new Date(2026, 10, 10, 21, 0))).toBe(0)
  })
})
