// S14 付費畫面、S14a 第一天說明（含還原購買，S15 狀態表）。
import { router } from 'expo-router'
import { act, fireEvent, screen } from 'expo-router/testing-library'
import { Linking } from 'react-native'
import { PRODUCT_ID } from '../../state/doc'
import { makeServices, readyDoc, renderApp } from '../../test/harness'

const doc = (owned = false) =>
  readyDoc((d) => ({ ...d, learning: { ...d.learning, level: 'n3' }, meta: { ...d.meta, firstOpenDate: '2026-11-01' }, entitlement: { ...d.entitlement, owned } }))
const open = async (o: Parameters<typeof makeServices>[0] = {}, url = '/paywall') => {
  const s = makeServices({ doc: doc(), ...o })
  await renderApp(s, url)
  return s
}
const buyBtn = () => screen.findByRole('button', { name: '購買 NT$290' })

describe('S14 付費畫面', () => {
  test('成功載入：內容清單列出 N3–N1 各級已審題數、StoreKit 價格與購買鈕、隱私政策與條款連結', async () => {
    await open()
    expect(await buyBtn()).toBeEnabled()
    expect(screen.getByText('NT$290')).toBeOnTheScreen()
    for (const l of ['N3', 'N2', 'N1']) expect(screen.getByText(`${l}：文法 12 題、讀解 1 題、聽力 3 題、單字 24 題`)).toBeOnTheScreen()
    expect(screen.queryByText(/限時|倒數|只剩/)).not.toBeOnTheScreen()
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue()
    await fireEvent.press(screen.getByRole('link', { name: '隱私政策' }))
    expect(spy).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: '使用條款' })).toBeOnTheScreen()
  })
  test('等待：商品載入中顯示價格骨架，購買鈕停用', async () => {
    const s = makeServices({ doc: doc() })
    s.gateway.fetchPrice = () => new Promise(() => {})
    await renderApp(s, '/paywall')
    expect(await screen.findByRole('button', { name: '載入價格中' })).toBeDisabled()
    expect(await screen.findByRole('progressbar', { name: '載入價格中' })).toBeOnTheScreen()
  })
  test('錯誤：取不到價格時顯示錯誤＋重試，購買鈕停用；重試成功後可購買', async () => {
    const s = await open({ gateway: { fail: true } })
    expect(await screen.findByText('無法連線 App Store')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '購買' })).toBeDisabled()
    s.gateway.fail = false
    await fireEvent.press(screen.getByRole('button', { name: '重試' }))
    expect(await buyBtn()).toBeEnabled()
  })
  test('空結果：查無商品時「目前無法購買」，還原購買仍可用', async () => {
    await open({ gateway: { price: null } })
    expect(await screen.findByText('目前無法購買，請稍後再試')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '還原購買' })).toBeEnabled()
  })
  test('重複操作：購買中鈕顯示進行中，連點只送一筆；10 秒內不可關閉，之後出現「先離開」；背景完成仍解鎖', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 9, 12), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
    try {
      const s = await open({}, '/')
      await screen.findByLabelText('目標等級')
      await act(() => router.push('/paywall'))
      await fireEvent.press(await buyBtn())
      await fireEvent.press(screen.getByRole('button', { name: '購買 NT$290' }))
      expect(s.gateway.requests).toEqual([PRODUCT_ID])
      expect(screen.getByRole('button', { name: '購買 NT$290' })).toBeBusy()
      expect(screen.queryByRole('button', { name: /關閉|先離開/ })).not.toBeOnTheScreen()
      s.time.now = new Date(s.time.now.getTime() + 10_000)
      await act(() => jest.advanceTimersByTime(10_000))
      await fireEvent.press(screen.getByRole('button', { name: '先離開，完成後會自動解鎖' }))
      expect(screen.queryByRole('header', { name: 'N3–N1 完整版' })).not.toBeOnTheScreen()
      await act(() => s.gateway.emit(PRODUCT_ID))
      expect(s.store.getState().doc!.entitlement.owned).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })
  test('取消：使用者取消不顯示錯誤，可再按購買', async () => {
    const s = await open()
    await fireEvent.press(await buyBtn())
    await act(() => s.gateway.emitError(true))
    expect(await buyBtn()).toBeEnabled()
    expect(screen.queryByText('購買沒有完成，沒有扣款')).not.toBeOnTheScreen()
  })
  test('錯誤：購買失敗顯示「沒有扣款」並可重試', async () => {
    const s = await open()
    await fireEvent.press(await buyBtn())
    await act(() => s.gateway.emitError(false))
    expect(await screen.findByText('購買沒有完成，沒有扣款')).toBeOnTheScreen()
    await fireEvent.press(await buyBtn())
    expect(s.gateway.requests).toHaveLength(2)
  })
  test('恢復：Ask to Buy 待核准顯示等待家長核准', async () => {
    const s = await open()
    await fireEvent.press(await buyBtn())
    await act(() => s.gateway.emit(PRODUCT_ID, 'pending'))
    expect(await screen.findByText('已送出，等待家長核准')).toBeOnTheScreen()
  })
  test('成功：購買完成寫入 entitlement 並進入原本要進的課', async () => {
    const s = await open({}, '/paywall?kind=grammar&lesson=2')
    await fireEvent.press(await buyBtn())
    await act(() => s.gateway.emit(PRODUCT_ID))
    expect(s.store.getState().doc!.entitlement.owned).toBe(true)
    expect(await screen.findByText('1／2')).toBeOnTheScreen()
  })
  test('已購：顯示「你已擁有完整版」，不顯示購買鈕；還原顯示已確認', async () => {
    await open({ doc: doc(true) })
    expect(await screen.findByText('你已擁有完整版')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^購買/ })).not.toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '還原購買' }))
    expect(await screen.findByText('已確認，你擁有完整版')).toBeOnTheScreen()
  })
  test('還原：有購買紀錄時還原並解鎖；沒有紀錄時說明切換帳號', async () => {
    const s = await open()
    await fireEvent.press(await screen.findByRole('button', { name: '還原購買' }))
    expect(await screen.findByText(/這個 Apple 帳號沒有完整版購買紀錄/)).toBeOnTheScreen()
    s.gateway.owned = [PRODUCT_ID]
    await fireEvent.press(screen.getByRole('button', { name: '還原購買' }))
    expect(await screen.findByText('已還原完整版')).toBeOnTheScreen()
    expect(s.store.getState().doc!.entitlement.owned).toBe(true)
  })
})

describe('S14a 第一天說明', () => {
  test('不顯示價格與購買鈕；回到第 1 課', async () => {
    await open({}, '/paywall-explain')
    expect(await screen.findByRole('header', { name: '這是 N3–N1 完整版的內容' })).toBeOnTheScreen()
    expect(screen.queryByText(/NT\$|購買 /)).not.toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '回到第 1 課' })).toBeOnTheScreen()
  })
  test('還原購買：無法連線時錯誤＋重試，重試成功解鎖', async () => {
    const s = await open({ gateway: { fail: true } }, '/paywall-explain')
    await fireEvent.press(await screen.findByRole('button', { name: '還原購買' }))
    expect(await screen.findByText('無法連線 App Store')).toBeOnTheScreen()
    s.gateway.fail = false
    s.gateway.owned = [PRODUCT_ID]
    await fireEvent.press(screen.getByRole('button', { name: '重試' }))
    expect(await screen.findByText('已還原完整版')).toBeOnTheScreen()
  })
})
