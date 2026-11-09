// S5 開寶箱、S6 升段儀式。
import { fireEvent, screen } from 'expo-router/testing-library'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { fixtureBank } from '../../test/fixtures'
import { makeServices, readyDoc, renderApp } from '../../test/harness'

const bank = fixtureBank('n5')
const grammarLesson = '/session?src=lesson&kind=grammar&lesson=1'

async function finishGrammarLesson() {
  for (let i = 0; i < 10; i++) {
    const prompt = (await screen.findByRole('header')).props.children as string
    await fireEvent.press(screen.getByRole('button', { name: bank.grammar.find((g) => g.q === prompt)!.answer }))
    await fireEvent.press(screen.getByRole('button', { name: i === 9 ? '看結果' : '下一題' }))
  }
  expect(await screen.findByText('修行結果')).toBeOnTheScreen()
}

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
  test('等待：減少動態時直接顯示內容，不跑 0.8 秒動畫', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    await renderApp(makeServices({ doc: goalDone() }), '/chest')
    await fireEvent.press(await screen.findByRole('button', { name: '打開桐箱' }))
    let node = (await screen.findByText('初稽古印')).parent
    while (node && StyleSheet.flatten(node.props.style)?.opacity === undefined) node = node.parent
    expect(StyleSheet.flatten(node!.props.style).opacity).toBe(1)
  })
  test('重複操作：寶箱已開後加練完成，不再給第二個寶箱', async () => {
    const s = makeServices({ doc: goalDone() })
    await renderApp(s, '/')
    await s.store.load()
    s.store.openChest()
    await renderApp(s, grammarLesson)
    await finishGrammarLesson()
    expect(screen.queryByText('今日修行完成')).not.toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: '開寶箱' })).not.toBeOnTheScreen()
    expect(s.store.openChest()).toBeNull()
    expect(s.store.getState().doc!.rewards.chest.log).toHaveLength(1)
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
  test('錯誤：保存失敗時儀式照常播，並亮保存失敗橫條', async () => {
    const s = makeServices({ doc: goalDone() })
    s.files.failWrites = true
    await renderApp(s, '/chest?rank=2&passed=2')
    await fireEvent.press(await screen.findByRole('button', { name: '打開桐箱' }))
    await fireEvent.press(await screen.findByRole('button', { name: '收下' }))
    expect(await screen.findByText('黃帶')).toBeOnTheScreen()
    expect(s.hapticsEngine.notificationAsync).toHaveBeenCalled()
    expect(screen.getByText(/進度暫時沒有保存/)).toBeOnTheScreen()
  })
  test('恢復：celebratedRanks 已含此段時，重開後 S2 不播', async () => {
    await renderApp(makeServices({ doc: readyDoc((d) => ({ ...d, rewards: { ...d.rewards, xpTotal: 650, celebratedRanks: [2, 3] } })) }), '/')
    expect(await screen.findByRole('button', { name: '開始' })).toBeOnTheScreen()
    expect(screen.queryByText('橙帶')).not.toBeOnTheScreen()
  })
  test('恢復：celebratedRanks 未含此段時，重開後 S2 載入完成重播一次', async () => {
    const s = makeServices({ doc: readyDoc((d) => ({ ...d, rewards: { ...d.rewards, xpTotal: 650, celebratedRanks: [2] } })) })
    await renderApp(s, '/')
    expect(await screen.findByText('橙帶')).toBeOnTheScreen()
    expect(s.store.getState().doc!.rewards.celebratedRanks).toEqual([2, 3])
  })
  test('重複操作：一次跨兩段只播最高段並列出經過的段位；同段不再播', async () => {
    const s = makeServices({ doc: goalDone({ xpTotal: 590, chest: { ...readyDoc().rewards.chest, lastOpenedDate: '2026-11-09' } }) })
    await renderApp(s, grammarLesson)
    await finishGrammarLesson()
    await fireEvent.press(screen.getByRole('button', { name: '繼續' }))
    expect(await screen.findByText('橙帶')).toBeOnTheScreen()
    expect(screen.getByText('經過：黃帶')).toBeOnTheScreen()
    expect(screen.queryByText('黃帶')).not.toBeOnTheScreen()
    expect(s.store.getState().doc!.rewards.celebratedRanks).toEqual([2, 3])
    await renderApp(s, grammarLesson)
    await finishGrammarLesson()
    await fireEvent.press(screen.getByRole('button', { name: '繼續' }))
    expect(screen.queryByText('橙帶')).not.toBeOnTheScreen()
  })
})
