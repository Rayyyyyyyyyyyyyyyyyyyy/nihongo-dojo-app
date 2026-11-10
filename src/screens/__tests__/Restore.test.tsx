// S15 還原購買（從「我的」推入的獨立畫面；狀態沿用 S15 狀態表）。
import { act, fireEvent, screen } from 'expo-router/testing-library'
import { AccessibilityInfo } from 'react-native'
import { PRODUCT_ID } from '../../state/doc'
import { makeServices, readyDoc, renderApp } from '../../test/harness'

const doc = (owned = false) => readyDoc((d) => ({ ...d, entitlement: { ...d.entitlement, owned } }))
const btn = () => screen.findByRole('button', { name: '還原購買' })
const open = async (o: Parameters<typeof makeServices>[0] = {}) => {
  const s = makeServices({ doc: doc(), ...o })
  await renderApp(s, '/restore')
  return s
}

describe('S15 還原購買', () => {
  test('初始：只有還原鈕與說明，沒有結果文字', async () => {
    await open()
    expect(await btn()).toBeEnabled()
    expect(screen.getByText(/用購買時的 Apple 帳號/)).toBeOnTheScreen()
    expect(screen.queryByText(/正在向 App Store 確認|已還原|沒有完整版購買紀錄/)).not.toBeOnTheScreen()
  })
  test('等待：<300ms 只顯示進行中，之後「正在向 App Store 確認」，超過 10 秒「還在處理，可以先離開」；連點只送一次', async () => {
    const s = makeServices({ doc: doc() })
    const restore = jest.fn(() => new Promise<string[]>(() => {}))
    s.gateway.restore = restore
    await renderApp(s, '/restore')
    const b = await btn()
    jest.useFakeTimers({ now: new Date(2026, 10, 9, 12), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
    try {
      await fireEvent.press(b)
      await fireEvent.press(screen.getByRole('button', { name: '還原購買' }))
      expect(restore).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: '還原購買' })).toBeBusy()
      expect(screen.queryByText('正在向 App Store 確認')).not.toBeOnTheScreen()
      await act(() => jest.advanceTimersByTime(300))
      expect(screen.getByText('正在向 App Store 確認')).toBeOnTheScreen()
      expect(screen.queryByText('還在處理，可以先離開')).not.toBeOnTheScreen()
      await act(() => jest.advanceTimersByTime(10_000))
      expect(screen.getByText('還在處理，可以先離開')).toBeOnTheScreen()
      expect(s.store.getState().doc!.entitlement.owned).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })
  test('成功：還原後寫入 entitlement；再按顯示已確認，不重複請求', async () => {
    const s = await open()
    s.gateway.owned = [PRODUCT_ID] // 啟動時查不到（例如重新安裝前），按還原才取得
    const spy = jest.spyOn(s.gateway, 'restore')
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    await fireEvent.press(await btn())
    expect(await screen.findByText('已還原完整版')).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith('已還原完整版') // iOS VoiceOver 不讀 liveRegion
    expect(s.store.getState().doc!.entitlement.owned).toBe(true)
    await fireEvent.press(screen.getByRole('button', { name: '還原購買' }))
    expect(await screen.findByText('已確認，你擁有完整版')).toBeOnTheScreen()
    expect(spy).toHaveBeenCalledTimes(1)
  })
  test('空結果：沒有購買紀錄時說明切換帳號，entitlement 不變', async () => {
    const s = await open()
    await fireEvent.press(await btn())
    expect(await screen.findByText(/這個 Apple 帳號沒有完整版購買紀錄。如果你用其他 Apple 帳號購買過/)).toBeOnTheScreen()
    expect(s.store.getState().doc!.entitlement.owned).toBe(false)
  })
  test('錯誤：無法連線顯示錯誤＋重試，重試成功解鎖', async () => {
    const s = await open({ gateway: { fail: true } })
    await fireEvent.press(await btn())
    expect(await screen.findByText('無法連線 App Store')).toBeOnTheScreen()
    expect(s.store.getState().doc!.entitlement.owned).toBe(false)
    s.gateway.fail = false
    s.gateway.owned = [PRODUCT_ID]
    await fireEvent.press(screen.getByRole('button', { name: '重試' }))
    expect(await screen.findByText('已還原完整版')).toBeOnTheScreen()
    expect(s.store.getState().doc!.entitlement.owned).toBe(true)
  })
})
