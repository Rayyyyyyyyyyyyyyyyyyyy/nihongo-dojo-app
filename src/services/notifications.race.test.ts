// C8 第 2 輪 R1：重疊的 syncReminders 依序執行，不會交錯成重複提醒。
import { createDoc } from '../state/doc'
import { syncReminders, type Notifier } from './notifications'

test('R1：兩次同時重排（像真實 expoNotifier 一樣逐筆非同步排程）不會重複', async () => {
  const scheduled: string[] = []
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const notifier: Notifier = {
    permission: async () => 'granted',
    request: async () => 'granted',
    async replaceAll(times, body) {
      await tick()
      scheduled.length = 0
      for (const t of times) {
        await tick()
        scheduled.push(`${t.toISOString()}|${body}`)
      }
    },
  }
  const clock = () => new Date(2026, 10, 10, 9)
  const d = createDoc('x', clock)
  const doc = { ...d, learning: { ...d.learning, lastDate: '2026-11-09', streak: 3 }, settings: { ...d.settings, reminder: { ...d.settings.reminder, enabled: true } } }
  await Promise.all([syncReminders(notifier, doc, clock), syncReminders(notifier, doc, clock)])
  expect(scheduled.length).toBeGreaterThan(0)
  expect(new Set(scheduled).size).toBe(scheduled.length)
})
