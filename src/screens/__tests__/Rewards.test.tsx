// S5 開寶箱、S6 升段儀式。
import { fireEvent, screen } from 'expo-router/testing-library'
import { AccessibilityInfo } from 'react-native'
import { makeServices, readyDoc, renderApp } from '../../test/harness'

const goalDone = (patch: Partial<ReturnType<typeof readyDoc>['rewards']> = {}) =>
  readyDoc((d) => ({ ...d, rewards: { ...d.rewards, goalCompletedDates: ['2026-11-09'], ...patch } }))

describe('S5 開寶箱', () => {
  test('空結果：今日目標未完成時不可開', async () => {
    await renderApp(makeServices({ doc: readyDoc() }), '/chest')
    expect(await screen.findByText('完成今日目標就能開')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: '打開桐箱' })).not.toBeOnTheScreen()
  })
  test('成功：第一次固定初稽古印並寫明「第一次修行的記念」；結果在動畫前先提交', async () => {
    const s = makeServices({ doc: goalDone() })
    await renderApp(s, '/chest')
    await fireEvent.press(await screen.findByRole('button', { name: '打開桐箱' }))
    expect(s.store.getState().doc!.rewards.chest.lastOpenedDate).toBe('2026-11-09')
    expect(await screen.findByText('初稽古印')).toBeOnTheScreen()
    expect(screen.getByText('第一次修行的記念')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '收下' })).toBeOnTheScreen()
  })
  test('成功：保護卡顯示持有數', async () => {
    const s = makeServices({ doc: goalDone({ chest: { ...readyDoc().rewards.chest, lastOpenedDate: '2026-11-01', ownedCosmetics: [] } }) })
    // 抽到保護卡或外觀都可：外觀時顯示名稱
    await renderApp(s, '/chest')
    await fireEvent.press(await screen.findByRole('button', { name: '打開桐箱' }))
    const r = s.store.getState().doc!.rewards.chest.log.at(-1)!.result
    if (r.type === 'protectionCard') expect(await screen.findByText('持有 1／2')).toBeOnTheScreen()
    else expect(await screen.findByText(/收在收集冊/)).toBeOnTheScreen()
  })
  test('恢復與重複操作：同一天再進來只顯示今天拿到的內容，不再抽', async () => {
    const s = makeServices({ doc: goalDone() })
    await renderApp(s, '/')
    await s.store.load()
    s.store.openChest()
    await renderApp(s, '/chest')
    expect(await screen.findByText('今天已開，明天再來')).toBeOnTheScreen()
    expect(screen.getByText('初稽古印')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: '打開桐箱' })).not.toBeOnTheScreen()
  })
  test('錯誤：保存失敗時內容照常顯示並亮保存失敗橫條', async () => {
    const s = makeServices({ doc: goalDone() })
    s.files.failWrites = true
    await renderApp(s, '/chest')
    await fireEvent.press(await screen.findByRole('button', { name: '打開桐箱' }))
    expect(await screen.findByText('初稽古印')).toBeOnTheScreen()
    expect(await screen.findByText(/進度暫時沒有保存/)).toBeOnTheScreen()
  })
  test('收下且有升段：進入 S6', async () => {
    await renderApp(makeServices({ doc: goalDone() }), '/chest?rank=2&passed=2')
    await fireEvent.press(await screen.findByRole('button', { name: '打開桐箱' }))
    await fireEvent.press(await screen.findByRole('button', { name: '收下' }))
    expect(await screen.findByText('黃帶')).toBeOnTheScreen()
  })
})

describe('S6 升段儀式', () => {
  test('成功：段位名、累積 XP、經過的段位；VoiceOver 公告；觸覺', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const s = makeServices({ doc: readyDoc((d) => ({ ...d, rewards: { ...d.rewards, xpTotal: 650, celebratedRanks: [2, 3] } })) })
    await renderApp(s, '/ceremony?rank=3&passed=2,3')
    expect(await screen.findByText('橙帶')).toBeOnTheScreen()
    expect(screen.getByText('累積 650 XP・修行 0 天')).toBeOnTheScreen()
    expect(screen.getByText('經過：黃帶')).toBeOnTheScreen()
    expect(screen.getByLabelText('橙帶的帶')).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith('升段：橙帶。累積 650 XP')
    expect(s.hapticsEngine.notificationAsync).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '分享' })).toBeOnTheScreen()
  })
  test('減少動態：靜態卡片淡入（仍顯示全部內容）', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    await renderApp(makeServices({ doc: readyDoc() }), '/ceremony?rank=4')
    expect(await screen.findByText('綠帶')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '完成' })).toBeOnTheScreen()
  })
})
