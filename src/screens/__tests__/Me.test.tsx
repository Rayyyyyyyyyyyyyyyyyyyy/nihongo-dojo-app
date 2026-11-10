// S13 我的：段位與連勝摘要、導覽入口、隱私政策連結。
import { act, fireEvent, screen } from 'expo-router/testing-library'
import { Linking } from 'react-native'
import { PRIVACY_URL } from '../paywall/Paywall'
import type { AppStateDoc } from '../../state/doc'
import { makeServices, readyDoc, renderApp } from '../../test/harness'

const open = async (patch?: (d: AppStateDoc) => AppStateDoc) => {
  const s = makeServices({ doc: readyDoc(patch) })
  await renderApp(s, '/me', 'me')
  return s
}

describe('S13 我的', () => {
  test('空結果：0 XP 為白帶並寫「第一次修行後就會開始累積」', async () => {
    await open()
    expect(await screen.findByText('白帶')).toBeOnTheScreen()
    expect(screen.getByText('第一次修行後就會開始累積')).toBeOnTheScreen()
    expect(screen.getByText('累積 0 XP・連勝 0 天・保護卡 0・本月修行印 0')).toBeOnTheScreen()
  })
  test('成功：段位、連勝、保護卡、本月修行印', async () => {
    await open((d) => ({
      ...d,
      learning: { ...d.learning, lastDate: '2026-11-09', streak: 3 },
      rewards: { ...d.rewards, xpTotal: 300, protectionCards: 1, goalCompletedDates: ['2026-10-31', '2026-11-08', '2026-11-09'] },
    }))
    expect(await screen.findByLabelText(/連勝 3 天，保護卡 1 張，本月修行印 2 個/)).toBeOnTheScreen()
    expect(screen.queryByText('第一次修行後就會開始累積')).not.toBeOnTheScreen()
  })
  test('入口：各列存在；連點只推入一次；隱私政策用系統瀏覽器開啟', async () => {
    await open()
    for (const name of ['N3–N1 完整版，明天起可查看', '還原購買', '每日目標與提醒，10 分鐘', '聲音、觸覺、外觀', '資料與備份', '分享段位卡', '回報題目說明', '隱私政策', '關於與資料來源'])
      expect(await screen.findByRole('button', { name })).toBeOnTheScreen()
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue()
    await fireEvent.press(screen.getByRole('button', { name: '隱私政策' }))
    expect(spy).toHaveBeenCalledWith(PRIVACY_URL)
    const row = screen.getByRole('button', { name: '資料與備份' })
    await fireEvent.press(row)
    await fireEvent.press(row)
    expect(screen).toHavePathname('/backup')
  })

  test('等待：購買狀態查詢中顯示「確認中」並先用本機快取；查詢完成後消失', async () => {
    const s = makeServices({ doc: readyDoc((d) => ({ ...d, meta: { ...d.meta, firstOpenDate: '2026-11-01' } })) })
    let resolve: (ids: string[]) => void = () => {}
    s.gateway.ownedProductIds = () => new Promise<string[]>((r) => (resolve = r))
    await renderApp(s, '/me', 'me')
    expect(await screen.findByText('完整版購買狀態確認中')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'N3–N1 完整版，未購' })).toBeOnTheScreen()
    await act(async () => resolve([]))
    expect(screen.queryByText('完整版購買狀態確認中')).not.toBeOnTheScreen()
    expect(screen.queryByText('目前無法連線 App Store，顯示上次結果')).not.toBeOnTheScreen()
  })
  test('錯誤：查詢失敗時顯示快取結果並附「目前無法連線 App Store，顯示上次結果」', async () => {
    const doc = readyDoc((d) => ({ ...d, entitlement: { ...d.entitlement, owned: true }, meta: { ...d.meta, firstOpenDate: '2026-11-01' } }))
    const s = makeServices({ doc, storeFail: true })
    await renderApp(s, '/me', 'me')
    expect(await screen.findByText('目前無法連線 App Store，顯示上次結果')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'N3–N1 完整版，已擁有' })).toBeOnTheScreen()
  })
})
