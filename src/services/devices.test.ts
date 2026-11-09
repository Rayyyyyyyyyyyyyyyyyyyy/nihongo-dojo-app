import { NotificationFeedbackType, ImpactFeedbackStyle } from 'expo-haptics'
import { createDoc } from '../state/doc'
import { createHaptics } from './haptics'
import { fakeNotifier, syncReminders } from './notifications'
import { createSpeech } from './speech'

const clock = () => new Date(2026, 10, 10, 9)
const withReminder = (enabled: boolean, streak = 3) => {
  const d = createDoc('i', () => new Date(2026, 10, 1, 12))
  return {
    ...d,
    learning: { ...d.learning, lastDate: '2026-11-09', streak },
    settings: { ...d.settings, dailyMinutes: 5 as const, reminder: { ...d.settings.reminder, enabled } },
  }
}

describe('notifications', () => {
  test('啟用且有權限：清掉舊的再排；文案正向', async () => {
    const n = fakeNotifier()
    expect(await syncReminders(n, withReminder(true), clock)).toBe('scheduled')
    expect(n.scheduled[0]).toEqual({ t: new Date(2026, 10, 10, 20, 0), body: '今天的 5 分鐘修行還在等你' })
    expect(await syncReminders(n, withReminder(true, 2), clock)).toBe('scheduled')
    expect(n.scheduled).toEqual([])
  })
  test('關閉提醒清空；權限被拒回報 denied；排程失敗回報 failed', async () => {
    const n = fakeNotifier('denied')
    n.scheduled = [{ t: new Date(), body: 'x' }]
    expect(await syncReminders(n, withReminder(false), clock)).toBe('off')
    expect(n.scheduled).toEqual([])
    expect(await syncReminders(n, withReminder(true), clock)).toBe('denied')
    const f = fakeNotifier()
    f.fail = true
    expect(await syncReminders(f, withReminder(true), clock)).toBe('failed')
  })
})

describe('speech', () => {
  const engine = (languages: string[]) => {
    const e = {
      calls: [] as string[],
      speak: jest.fn((text: string, _options?: object) => void e.calls.push(`speak:${text}`)),
      stop: jest.fn(async () => void e.calls.push('stop')),
      getAvailableVoicesAsync: async () => languages.map((language, i) => ({ identifier: `v${i}`, language })),
    }
    return e
  }
  test('偵測日語語音；沒有 ja 語音回傳 missing（S10 空狀態）', async () => {
    expect(await createSpeech(engine(['en-US', 'ja-JP'])).japaneseVoice()).toBe('available')
    expect(await createSpeech(engine(['en-US'])).japaneseVoice()).toBe('missing')
    expect(await createSpeech(engine([])).japaneseVoice()).toBe('missing')
  })
  test('播放前先停止前一段，以 ja-JP 與設定語速朗讀', async () => {
    const e = engine(['ja-JP'])
    const s = createSpeech(e)
    await s.speak('こんにちは', 0.8)
    await s.speak('さようなら', 1.0)
    expect(e.calls).toEqual(['stop', 'speak:こんにちは', 'stop', 'speak:さようなら'])
    expect(e.speak.mock.calls[0][1]).toMatchObject({ language: 'ja-JP', rate: 0.8 })
  })
})

describe('haptics', () => {
  const engine = () => ({ notificationAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), selectionAsync: jest.fn(async () => {}) })
  test('依 tokens 的 haptic 事件呼叫對應觸覺', async () => {
    const e = engine(),
      h = createHaptics(() => true, e)
    await h.play('correct')
    await h.play('wrong')
    await h.play('stamp')
    await h.play('combo')
    await h.play('selection')
    expect(e.notificationAsync.mock.calls).toEqual([[NotificationFeedbackType.Success], [NotificationFeedbackType.Warning]])
    expect(e.impactAsync.mock.calls).toEqual([[ImpactFeedbackStyle.Heavy], [ImpactFeedbackStyle.Light]])
    expect(e.selectionAsync).toHaveBeenCalledTimes(1)
  })
  test('設定關閉時不觸發；引擎失敗不丟錯', async () => {
    const e = engine()
    await createHaptics(() => false, e).play('correct')
    expect(e.notificationAsync).not.toHaveBeenCalled()
    e.impactAsync.mockRejectedValueOnce(Error('low power'))
    await expect(createHaptics(() => true, e).play('stamp')).resolves.toBeUndefined()
  })
})
