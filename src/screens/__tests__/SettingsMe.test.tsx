// S18 每日目標與提醒、S19 關於與資料來源、S20 回報題目、S21 分享段位卡、S22 聲音觸覺外觀。
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import * as Clipboard from 'expo-clipboard'
import { AccessibilityInfo, AppState, Linking, Share, Text } from 'react-native'
import * as RN from 'react-native'
import About from '../me/About'
import Report, { COPIED_MS } from '../me/Report'
import ShareScreen from '../me/Share'
import { RootNavigator } from '../RootNavigator'
import Reminders from '../settings/Reminders'
import Settings from '../settings/Settings'
import { DATA_SOURCES } from '../../content/attribution'
import type { fakeNotifier } from '../../services/notifications'
import { AppGate } from '../../state/AppGate'
import { AppProvider } from '../../state/AppProvider'
import type { AppStateDoc } from '../../state/doc'
import { makeServices, readyDoc } from '../../test/harness'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { palettes } from '../../theme/tokens'

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }))

type Services = ReturnType<typeof makeServices>
const notifierOf = (s: Services) => s.services.notifier as ReturnType<typeof fakeNotifier>

async function openWith(s: Services, url: string) {
  const Root = () => (
    <ThemeProvider>
      <AppProvider services={s.services}>
        <AppGate>
          <RootNavigator />
        </AppGate>
      </AppProvider>
    </ThemeProvider>
  )
  const stubs = Object.fromEntries(['(tabs)/index', 'onboarding', 'session', 'chest', 'ceremony', 'paywall', 'paywall-explain'].map((n) => [n, () => <Text>占位 {n}</Text>]))
  const routes = { _layout: Root, ...stubs, reminders: Reminders, settings: Settings, about: About, report: Report, share: ShareScreen }
  await renderRouter(routes as never, { initialUrl: url })
  return s
}
const open = (url: string, doc = readyDoc()) => openWith(makeServices({ doc }), url)
const settings = (s: Services) => s.store.getState().doc!.settings
const withReminder = (patch: Partial<AppStateDoc['settings']['reminder']>) =>
  readyDoc((d) => ({ ...d, settings: { ...d.settings, reminder: { ...d.settings.reminder, ...patch } } }))
const SUCCESS = (time: string) => `每天 ${time} 提醒（連勝 3 天以上且當天未練時）`

afterEach(() => jest.restoreAllMocks())

describe('S18 每日目標與提醒', () => {
  test('空結果：未設定提醒顯示「目前沒有提醒」；改每日目標即保存；沒有恐嚇式文案', async () => {
    const s = await open('/reminders')
    expect(await screen.findByText('目前沒有提醒')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '20 分鐘' }))
    expect(settings(s).dailyMinutes).toBe(20)
    expect(screen.queryByText(/失去|錯過|再不|最後機會|中斷/)).not.toBeOnTheScreen()
  })
  test('等待→成功：權限未決定時先顯示說明卡，按「設定提醒」才呼叫系統權限', async () => {
    const s = makeServices({ doc: readyDoc() })
    notifierOf(s).status = 'undetermined'
    const request = jest.spyOn(notifierOf(s), 'request')
    await openWith(s, '/reminders')
    await fireEvent(await screen.findByRole('switch', { name: '提醒' }), 'valueChange', true)
    expect(screen.getByText('要不要每天提醒你修行？你選時段，每天最多 1 則。')).toBeOnTheScreen()
    expect(request).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: '設定提醒' }))
    expect(request).toHaveBeenCalledTimes(1)
    expect(settings(s).reminder.enabled).toBe(true)
    expect(await screen.findByText(SUCCESS('20:00'))).toBeOnTheScreen()
  })
  test('「之後再說」關掉說明卡，不請求權限也不開提醒', async () => {
    const s = makeServices({ doc: readyDoc() })
    notifierOf(s).status = 'undetermined'
    const request = jest.spyOn(notifierOf(s), 'request')
    await openWith(s, '/reminders')
    await fireEvent(await screen.findByRole('switch', { name: '提醒' }), 'valueChange', true)
    await fireEvent.press(screen.getByRole('button', { name: '之後再說' }))
    expect(screen.queryByText(/要不要每天提醒你修行/)).not.toBeOnTheScreen()
    expect(request).not.toHaveBeenCalled()
    expect(settings(s).reminder.enabled).toBe(false)
  })
  test('錯誤＋恢復：權限被拒顯示「通知權限已關閉」＋打開系統設定；回到前景時重新讀權限並排程', async () => {
    const listeners: Array<(state: string) => void> = []
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (state: string) => void) => {
      listeners.push(fn)
      return { remove: jest.fn() }
    }) as never)
    const s = makeServices({ doc: withReminder({ enabled: true }) })
    notifierOf(s).status = 'denied'
    await openWith(s, '/reminders')
    expect(await screen.findByText('通知權限已關閉')).toBeOnTheScreen()
    expect(screen.getByText('目前沒有提醒')).toBeOnTheScreen()
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    await fireEvent.press(screen.getByRole('button', { name: '打開系統設定' }))
    expect(openSettings).toHaveBeenCalled()
    notifierOf(s).status = 'granted'
    await act(async () => listeners.forEach((l) => l('active')))
    expect(await screen.findByText(SUCCESS('20:00'))).toBeOnTheScreen()
    expect(screen.queryByText('通知權限已關閉')).not.toBeOnTheScreen()
  })
  test('錯誤：排程失敗顯示「提醒沒有排好，請再試一次」，重試成功後消失', async () => {
    const s = makeServices({ doc: withReminder({ enabled: true }) })
    notifierOf(s).fail = true
    await openWith(s, '/reminders')
    expect(await screen.findByText('提醒沒有排好，請再試一次')).toBeOnTheScreen()
    notifierOf(s).fail = false
    await fireEvent.press(screen.getByRole('button', { name: '重試' }))
    expect(screen.queryByText('提醒沒有排好，請再試一次')).not.toBeOnTheScreen()
  })
  test('重複操作：改時段即重排（先清再排），同一天不重複', async () => {
    const s = makeServices({ doc: withReminder({ enabled: true }) })
    const replace = jest.spyOn(notifierOf(s), 'replaceAll')
    await openWith(s, '/reminders')
    await screen.findByText(SUCCESS('20:00'))
    const before = replace.mock.calls.length
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    await fireEvent.press(screen.getByRole('button', { name: '延後 30 分鐘' }))
    await fireEvent.press(screen.getByRole('button', { name: '延後 30 分鐘' }))
    expect(settings(s).reminder.time).toBe('21:00')
    expect(await screen.findByText(SUCCESS('21:00'))).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith(SUCCESS('21:00'))
    expect(replace.mock.calls.length).toBe(before + 2)
    const days = notifierOf(s).scheduled.map((x) => x.t.toDateString())
    expect(new Set(days).size).toBe(days.length)
  })
})

describe('S22 聲音、觸覺、外觀', () => {
  test('成功：開關即時保存；開音效播一次示範音，開觸覺觸發一次 selection', async () => {
    const doc = readyDoc((d) => ({ ...d, settings: { ...d.settings, sound: false, haptics: false } }))
    const s = await open('/settings', doc)
    await fireEvent(await screen.findByRole('switch', { name: '音效' }), 'valueChange', true)
    expect(settings(s).sound).toBe(true)
    expect(s.sound.play).toHaveBeenCalledTimes(1)
    await fireEvent(screen.getByRole('switch', { name: '觸覺' }), 'valueChange', true)
    expect(settings(s).haptics).toBe(true)
    expect(s.hapticsEngine.selectionAsync).toHaveBeenCalledTimes(1)
    await fireEvent(screen.getByRole('switch', { name: '音效' }), 'valueChange', false)
    expect(settings(s).sound).toBe(false)
    expect(s.sound.play).toHaveBeenCalledTimes(1)
    await fireEvent.press(screen.getByRole('button', { name: '0.8 倍' }))
    expect(settings(s).speechRate).toBe(0.8)
  })
  test('外觀：選深色／淺色覆寫系統，選跟隨系統回到系統深淺色', async () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('light')
    const s = await open('/settings')
    const heading = await screen.findByText('外觀', { exact: true })
    expect(heading).toHaveStyle({ color: palettes.light.ink })
    await fireEvent.press(screen.getByRole('button', { name: '深色' }))
    expect(settings(s).appearance).toBe('dark')
    expect(screen.getByText('外觀', { exact: true })).toHaveStyle({ color: palettes.dark.ink })
    await fireEvent.press(screen.getByRole('button', { name: '跟隨系統' }))
    expect(screen.getByText('外觀', { exact: true })).toHaveStyle({ color: palettes.light.ink })
  })
  test('錯誤：保存失敗時切換照常生效並顯示保存失敗橫條', async () => {
    const s = await open('/settings')
    await screen.findByRole('switch', { name: '音效' })
    s.files.failWrites = true
    await fireEvent(screen.getByRole('switch', { name: '音效' }), 'valueChange', false)
    await act(() => s.store.flush())
    expect(settings(s).sound).toBe(false)
    expect(await screen.findByText(/進度暫時沒有保存/)).toBeOnTheScreen()
  })
})

describe('S19 關於與資料來源', () => {
  test('成功：顯示版本、內容版本、賣家佔位、非官方聲明與每個資料來源的授權連結', async () => {
    const s = await open('/about')
    expect(await screen.findByText(`內容版本 ${s.services.bank.manifest.contentVersion}`)).toBeOnTheScreen()
    expect(screen.getByText(/^版本 /)).toBeOnTheScreen()
    expect(screen.getByText('賣家 {{SELLER_NAME}}')).toBeOnTheScreen()
    expect(screen.getByText(/非 JLPT 官方試題/)).toBeOnTheScreen()
    expect(screen.getByText(/繁中釋義：作為/)).toBeOnTheScreen()
    for (const d of DATA_SOURCES) expect(screen.getAllByRole('link', { name: `授權：${d.license}` }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('chyyran/jlpt-anki-decks', { exact: true })).toHaveLength(2) // 資料來源＋授權全文
    expect(screen.getByText('react-native（MIT）')).toBeOnTheScreen()
    expect(screen.queryByText(/NHK/)).not.toBeOnTheScreen()
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue()
    await fireEvent.press(screen.getByRole('link', { name: `來源：${DATA_SOURCES[0].name}` }))
    expect(openURL).toHaveBeenCalledWith(DATA_SOURCES[0].url)
  })
  test('錯誤：連結開啟失敗時改顯示可選取的網址文字', async () => {
    await open('/about')
    jest.spyOn(Linking, 'openURL').mockRejectedValue(Error('no browser'))
    await fireEvent.press(await screen.findByRole('link', { name: `來源：${DATA_SOURCES[0].name}` }))
    const url = await screen.findByText(DATA_SOURCES[0].url)
    expect(url.props.selectable).toBe(true)
  })
})

describe('S20 回報題目', () => {
  const key = encodeURIComponent(JSON.stringify(['n3', 'grammar', 'g-n3-045']))
  test('成功：顯示題目代碼，拷貝後「已拷貝」1.5 秒並公告；不自動傳送資料', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
    try {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      const s = await open(`/report?key=${key}`)
      const code = `N3-grammar-g-n3-045@c${s.services.bank.manifest.contentVersion}`
      expect(await screen.findByText(code)).toBeOnTheScreen()
      expect(screen.getByText(/不會自動傳送任何資料/)).toBeOnTheScreen()
      await fireEvent.press(screen.getByRole('button', { name: '拷貝' }))
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(code)
      expect(screen.getByText('已拷貝')).toBeOnTheScreen()
      expect(announce).toHaveBeenCalledWith('已拷貝')
      await fireEvent.press(screen.getByRole('button', { name: '拷貝' })) // 重複拷貝無副作用
      await act(() => jest.advanceTimersByTime(COPIED_MS))
      expect(screen.queryByText('已拷貝')).not.toBeOnTheScreen()
    } finally {
      jest.useRealTimers()
    }
  })
  test('錯誤：拷貝失敗時提示手動選取，代碼為可選取文字', async () => {
    jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(Error('denied'))
    await open(`/report?key=${key}`)
    const code = await screen.findByText(/^N3-grammar-g-n3-045@c/)
    await fireEvent.press(screen.getByRole('button', { name: '拷貝' }))
    expect(await screen.findByText(/請長按上方代碼手動選取/)).toBeOnTheScreen()
    expect(code.props.selectable).toBe(true)
  })
  test('從「我的」進入（沒有題目）：只顯示如何回報的說明', async () => {
    await open('/report')
    expect(await screen.findByText(/在那題的解析區按「回報這題」/)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: '拷貝' })).not.toBeOnTheScreen()
  })
})

describe('S21 分享段位卡', () => {
  const streakDoc = () => readyDoc((d) => ({ ...d, rewards: { ...d.rewards, xpTotal: 0 } }))
  test('空結果：連勝 0 時卡片只顯示段位；取消分享不顯示訊息、不給 XP', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction, activityType: undefined })
    const s = await open('/share', streakDoc())
    expect(await screen.findByText('白帶')).toBeOnTheScreen()
    expect(screen.queryByText(/連勝/)).not.toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '分享' }))
    expect(share).toHaveBeenCalledWith({ message: '日本語道場｜白帶' })
    expect(screen.queryByText('無法開啟分享面板')).not.toBeOnTheScreen()
    expect(s.store.getState().doc!.rewards.xpTotal).toBe(0)
  })
  test('重複操作：分享面板開著時連點只開一個', async () => {
    let done: (v: { action: string }) => void = () => {}
    const share = jest.spyOn(Share, 'share').mockReturnValue(new Promise((r) => (done = r)) as never)
    await open('/share')
    const btn = await screen.findByRole('button', { name: '分享' })
    await fireEvent.press(btn)
    await fireEvent.press(btn)
    expect(share).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '分享' })).toBeBusy()
    await act(async () => done({ action: Share.sharedAction }))
    expect(screen.getByRole('button', { name: '分享' })).toBeEnabled()
  })
  test('錯誤：分享面板無法開啟時顯示訊息＋重試', async () => {
    const share = jest.spyOn(Share, 'share').mockRejectedValueOnce(Error('fail')).mockResolvedValue({ action: Share.sharedAction, activityType: undefined })
    await open('/share')
    await fireEvent.press(await screen.findByRole('button', { name: '分享' }))
    expect(await screen.findByText('無法開啟分享面板')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '重試' }))
    expect(share).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('無法開啟分享面板')).not.toBeOnTheScreen()
  })
})
