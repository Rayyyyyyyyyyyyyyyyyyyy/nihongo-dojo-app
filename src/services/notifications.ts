// 本機提醒（S18）：規則在 domain/reminder.ts；這裡只負責權限與重排。
import * as Notifications from 'expo-notifications'
import type { Clock } from '../domain/learning/types'
import { reminderBody } from '../domain/reminder'
import { plannedReminders } from '../state/core'
import type { AppStateDoc } from '../state/doc'

export type Permission = 'granted' | 'denied' | 'undetermined'

export interface Notifier {
  permission(): Promise<Permission>
  request(): Promise<Permission> // 只在使用者按「設定提醒」時呼叫（第一次完成今日任務後）
  replaceAll(times: Date[], body: string): Promise<void>
}

export const expoNotifier: Notifier = {
  permission: async () => (await Notifications.getPermissionsAsync()).status as Permission,
  request: async () =>
    (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } })).status as Permission,
  async replaceAll(times, body) {
    await Notifications.cancelAllScheduledNotificationsAsync()
    for (const date of times)
      await Notifications.scheduleNotificationAsync({
        content: { title: '日本語道場', body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      })
  },
}

export type SyncResult = 'scheduled' | 'off' | 'denied' | 'failed'

// 同一個 notifier 的重排依序執行：replaceAll 是「全部取消再逐筆排」，兩次同時跑會交錯成重複的提醒。
const queues = new WeakMap<Notifier, Promise<unknown>>()

// App 進前景、作答後、改設定時呼叫：先清掉舊的再排，所以同一天不會重複。
export function syncReminders(notifier: Notifier, doc: AppStateDoc, clock: Clock): Promise<SyncResult> {
  const run = (queues.get(notifier) ?? Promise.resolve()).then(() => syncNow(notifier, doc, clock))
  queues.set(notifier, run)
  return run
}

async function syncNow(notifier: Notifier, doc: AppStateDoc, clock: Clock): Promise<SyncResult> {
  try {
    if (!doc.settings.reminder.enabled) {
      await notifier.replaceAll([], '')
      return 'off'
    }
    if ((await notifier.permission()) !== 'granted') {
      await notifier.replaceAll([], '')
      return 'denied' // S18：「通知權限已關閉」＋打開系統設定
    }
    await notifier.replaceAll(plannedReminders(doc, clock), reminderBody(doc.settings.dailyMinutes))
    return 'scheduled'
  } catch {
    return 'failed' // S18：「提醒沒有排好，請再試一次」
  }
}

export function fakeNotifier(permission: Permission = 'granted') {
  const n = {
    permission: async () => n.status,
    request: async () => (n.status = n.requestAnswer),
    async replaceAll(times: Date[], body: string) {
      if (n.fail) throw Error('schedule failed')
      n.scheduled = times.map((t) => ({ t, body }))
    },
    status: permission as Permission,
    requestAnswer: 'granted' as Permission,
    fail: false,
    scheduled: [] as Array<{ t: Date; body: string }>,
  }
  return n
}
