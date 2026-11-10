// 首次體驗 O1–O5（app-design §3「首次體驗狀態」）：等待、錯誤、恢復、成功、重複操作。
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library'
import type { LevelBank } from '../../data/bank'
import type { Level } from '../../domain/progress/state'
import type { AppStateDoc } from '../../state/doc'
import { fixtureBank, vocabFor } from '../../test/fixtures'
import { makeServices, readyDoc, renderApp } from '../../test/harness'

const at = (onboarding: AppStateDoc['meta']['onboarding']) => readyDoc((d) => ({ ...d, meta: { ...d.meta, onboarding } }))
const open = async (doc: AppStateDoc, load?: (l: Level) => LevelBank | Promise<LevelBank>) => {
  const s = makeServices({ doc, load })
  await renderApp(s, '/')
  return s
}
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }))
const meaning = (word: string) => [...(['n5', 'n4', 'n3', 'n2', 'n1'] as const)].flatMap(vocabFor).find((v) => v.w === word)!.zh
// O4 作答一題：選正確或錯誤的選項，等 400ms 回饋後換下一題。
const answer = async (correct: boolean) => {
  const word = screen.getByRole('header').props.children as string
  const right = meaning(word)
  const options = screen.getAllByRole('button').filter((b) => b.props.accessibilityLabel !== '略過')
  const pick = correct ? right : options.map((o) => o.props.accessibilityLabel as string).find((l) => l && l !== right && l !== '略過')!
  await fireEvent.press(screen.getByRole('button', { name: pick }))
  await act(async () => void jest.advanceTimersByTime(450)) // renderRouter 使用假計時器
}

describe('O1–O5 首次體驗', () => {
  test('O1：未完成首次體驗時從分頁導向 O1；不顯示價格；連點「開始」只前進一步', async () => {
    const s = await open(at('notStarted'))
    expect(await screen.findByText('每天幾分鐘，從 N5 練到 N1')).toBeOnTheScreen()
    expect(screen.queryByText(/NT\$|購買/)).not.toBeOnTheScreen()
    const start = screen.getByRole('button', { name: '開始' })
    await fireEvent.press(start)
    await fireEvent.press(start)
    expect(s.store.getState().doc!.meta.onboarding).toBe('level')
    expect(await screen.findByText('目標等級')).toBeOnTheScreen()
  })

  test('O2→O3：選等級即保存並前進；N3 以上附免費試用、不顯示價格；O3 預設 10 分鐘，選 20 後下一步', async () => {
    const s = await open(at('level'))
    expect(await screen.findByText('目標等級')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^N3.*（N3 第一課可免費試用）$/ })).toBeOnTheScreen()
    expect(screen.queryByText(/NT\$/)).not.toBeOnTheScreen()
    await press(/^N3/)
    expect(s.store.getState().doc!.learning.level).toBe('n3')
    expect(await screen.findByText('每天修行幾分鐘？')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^10 分鐘/ })).toBeSelected()
    await press(/^20 分鐘/)
    await press('下一步')
    expect(s.store.getState().doc!.settings.dailyMinutes).toBe(20)
    expect(s.store.getState().doc!.meta.onboarding).toBe('placement')
    expect(await screen.findByText(/^程度測驗 1／15$/)).toBeOnTheScreen()
  })

  test('恢復：中途關閉回到未完成的那一步（O3 的選擇已保存）', async () => {
    await open(at('minutes'))
    expect(await screen.findByText('每天修行幾分鐘？')).toBeOnTheScreen()
  })

  test('等待：O4 題庫讀取超過 300ms 顯示題卡骨架，載入後出題', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    await open(at('placement'), async (l) => (await gate, fixtureBank(l)))
    expect(await screen.findByLabelText('準備程度測驗')).toBeOnTheScreen()
    await act(async () => release())
    expect(await screen.findByText(/^程度測驗 1／15$/)).toBeOnTheScreen()
  })

  test('錯誤：題庫載入失敗顯示「題庫載入失敗」＋重試；重試成功後出題', async () => {
    let fail = true
    await open(at('placement'), (l) => {
      if (fail) throw Error('invalid bank')
      return fixtureBank(l)
    })
    expect(await screen.findByText('題庫載入失敗')).toBeOnTheScreen()
    fail = false
    await press('重試')
    expect(await screen.findByText(/^程度測驗 1／15$/)).toBeOnTheScreen()
  })

  test('錯誤：仍失敗時「略過測驗」用 O2 等級進 S2，不進 S3', async () => {
    const s = await open(at('placement'), () => {
      throw Error('invalid bank')
    })
    await screen.findByText('題庫載入失敗')
    await press('略過測驗')
    await waitFor(() => expect(s.store.getState().doc!.meta.onboarding).toBe('done'))
    expect(s.store.getState().doc!.learning.level).toBe('n5')
    expect(screen).toHavePathname('/')
  })

  test('恢復：O4 已作答題不保留，重開從第 1 題重來', async () => {
    const s = await open(at('placement'))
    await screen.findByText(/^程度測驗 1／15$/)
    await answer(true)
    expect(screen.getByText(/^程度測驗 2／15$/)).toBeOnTheScreen()
    await screen.unmount()
    await renderApp(makeServices({ doc: s.store.getState().doc! }), '/')
    expect(await screen.findByText(/^程度測驗 1／15$/)).toBeOnTheScreen()
  })

  test('成功：作答後略過 → O5 建議等級與理由；「用建議等級」設定等級、標記完成並進 S3；測驗不給 XP、不留學習紀錄', async () => {
    const s = await open(at('placement'))
    await screen.findByText(/^程度測驗 1／15$/)
    const before = s.store.getState().doc!
    for (let i = 0; i < 3; i++) await answer(true)
    await press('略過')
    expect(await screen.findByText('建議從 N4 開始')).toBeOnTheScreen()
    expect(screen.getByText('測驗答對 100%。作答過的等級都答對 2／3 以上，N4 還沒測到。')).toBeOnTheScreen()
    await press('用建議等級')
    const after = s.store.getState().doc!
    expect(after.learning.level).toBe('n4')
    expect(after.meta.onboarding).toBe('done')
    expect(after.rewards.xpTotal).toBe(0)
    expect(after.learning.results).toEqual(before.learning.results)
    expect(after.learning.schedules).toEqual(before.learning.schedules)
    expect(after.learning.lastDate).toBe(before.learning.lastDate)
    await waitFor(() => expect(screen).toHavePathname('/session'))
  })

  test('成功：O5「維持我選的」保留 O2 等級；第 1 題就略過直接進 S3', async () => {
    const s = await open(at('placement'))
    await screen.findByText(/^程度測驗 1／15$/)
    for (let i = 0; i < 3; i++) await answer(false)
    await press('略過')
    expect(await screen.findByText('建議從 N5 開始')).toBeOnTheScreen()
    await press('維持我選的（N5）')
    expect(s.store.getState().doc!.meta.onboarding).toBe('done')
    await screen.unmount()
    const t = await open(at('placement'))
    await screen.findByText(/^程度測驗 1／15$/)
    await press('略過')
    expect(t.store.getState().doc!.meta.onboarding).toBe('done')
    await waitFor(() => expect(screen).toHavePathname('/session'))
  })
})
