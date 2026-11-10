// S17 從網頁版匯入狀態表：空白、各種錯誤（保留輸入）、預覽（含不可用項目）、確認覆寫、結果與撤銷、保存失敗、首次模式。
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library'
import web from '../../domain/progress/__fixtures__/web-v5.json'
import { defaultState, encodeCode } from '../../domain/progress/state'
import { bankManifest, loadLevel } from '../../data/bank'
import { readyDoc } from '../../test/harness'
import { unavailableCount } from '../settings/Import'
import { vocabFor } from '../../test/fixtures'
import { renderSettings, settingsServices } from '../../test/settingsHarness'

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }))
const raw = (v: unknown) => btoa(encodeURIComponent(JSON.stringify(v)))
const open = async (s = settingsServices({ doc: readyDoc((d) => ({ ...d, rewards: { ...d.rewards, xpTotal: 120 } })) })) => {
  await renderSettings(s, '/import')
  await screen.findByLabelText('網頁版進度碼')
  return s
}
const enter = (code: string) => fireEvent.changeText(screen.getByLabelText('網頁版進度碼'), code)

const word = vocabFor('n5')[0].w
const sample = () => {
  const st = defaultState()
  st.vKnown.n5[word] = true
  st.gDone.n3 = ['g-gone-001']
  st.streak = 12
  st.lastDate = '2026-11-06'
  return st
}

describe('S17 從網頁版匯入', () => {
  test('空結果：空白送出時欄位下方「請貼上進度碼」', async () => {
    await open()
    await press('檢查進度碼')
    expect(screen.getByText('請貼上進度碼')).toBeOnTheScreen()
  })

  test.each([
    ['格式錯誤', 'not a code', '這不是有效的進度碼。'],
    ['v4 碼', raw({ version: 4, state: {} }), '這是舊版（v4）進度碼。請先在網頁版開啟一次，讓它升級，再重新匯出。'],
    ['未知版本', raw({ version: 6, state: {} }), '這個進度碼的版本比 App 新，請更新 App。'],
    ['欄位錯誤', raw({ version: 5, state: { level: 'n5' } }), '進度碼內容不完整或互相矛盾。'],
    ['未知欄位', raw({ version: 5, state: defaultState(), extra: 1 }), '進度碼內容不完整或互相矛盾。'],
  ])('錯誤：%s 寫在欄位下方，輸入保留，進度不動', async (_, code, message) => {
    const s = await open()
    const before = JSON.stringify(s.store.getState().doc)
    await enter(code)
    await press('檢查進度碼')
    expect(screen.getByText(message)).toBeOnTheScreen()
    expect(screen.getByLabelText('網頁版進度碼').props.value).toBe(code)
    expect(JSON.stringify(s.store.getState().doc)).toBe(before)
    expect(s.store.getState().snapshots).toHaveLength(0)
  })

  test('預覽：各級單字掌握、連勝與最後學習日、錯題、不可用項目；寫明覆寫範圍；尚未套用', async () => {
    const s = await open()
    await enter(encodeCode(sample()))
    await press('檢查進度碼')
    expect(screen.getByText('N5 單字 1／24 掌握')).toBeOnTheScreen()
    expect(screen.getByText('N1 單字 0／24 掌握')).toBeOnTheScreen()
    expect(screen.getByText('連勝 12 天（最後學習 11/06）')).toBeOnTheScreen()
    expect(screen.getByText('錯題 0')).toBeOnTheScreen()
    expect(screen.getByText('不可用項目 1（題目已更新或退役，紀錄會保留）')).toBeOnTheScreen()
    expect(screen.getByText(/匯入會覆寫這台 iPhone 上的學習進度。你的 XP、段位、寶箱收藏與保護卡不受影響/)).toBeOnTheScreen()
    expect(s.store.getState().doc!.learning.vKnown.n5[word]).toBeUndefined()
    await press('修改進度碼')
    expect(screen.getByLabelText('網頁版進度碼').props.value).toBe(encodeCode(sample()))
  })

  test('確認覆寫 → 結果 → 撤銷：先建立快照，XP 不變；撤銷回到匯入前，撤銷本身也建立快照', async () => {
    const s = await open()
    await enter(web.code)
    await press('檢查進度碼')
    await press('覆寫並匯入')
    expect(screen.getByText('確定要用這個進度碼覆寫目前的學習進度嗎？')).toBeOnTheScreen()
    expect(s.store.getState().snapshots).toHaveLength(0)
    await act(async () => press('確定覆寫'))
    expect(await screen.findByText(/^匯入完成。已依掌握紀錄點亮收集冊 [\d,]+ 塊札。XP 從今天的修行開始累計。$/)).toBeOnTheScreen()
    const imported = s.store.getState().doc!
    expect(imported.learning.results.length).toBeGreaterThan(0)
    expect(imported.rewards.xpTotal).toBe(120)
    expect(s.store.getState().snapshots.map((x) => x.reason)).toEqual(['beforeImport'])
    await act(async () => press('撤銷這次匯入'))
    expect(await screen.findByText(/已撤銷這次匯入/)).toBeOnTheScreen()
    expect(s.store.getState().doc!.learning.results).toHaveLength(0)
    expect(s.store.getState().snapshots.map((x) => x.reason)).toEqual(['beforeImport', 'beforeUndo'])
  })

  test('取消確認不套用；同一碼再匯入一次照常先建立快照', async () => {
    const s = await open()
    await enter(web.code)
    await press('檢查進度碼')
    await press('覆寫並匯入')
    await press('取消')
    expect(s.store.getState().snapshots).toHaveLength(0)
    await act(() => s.store.importV5(web.code))
    await press('覆寫並匯入')
    await act(async () => press('確定覆寫'))
    await screen.findByText(/^匯入完成/)
    expect(s.store.getState().snapshots).toHaveLength(2)
  })

  test('保存失敗：「匯入沒有套用，你的進度沒有變動」，文件不變', async () => {
    const s = await open()
    const before = JSON.stringify(s.store.getState().doc)
    await enter(web.code)
    await press('檢查進度碼')
    await press('覆寫並匯入')
    s.files.failWrites = true
    await act(async () => press('確定覆寫'))
    expect(await screen.findByText('匯入沒有套用，你的進度沒有變動。')).toBeOnTheScreen()
    expect(JSON.stringify(s.store.getState().doc)).toBe(before)
    expect(screen.getByRole('button', { name: '覆寫並匯入' })).toBeEnabled()
  })

  test('首次模式：O1「我用過網頁版」→ 匯入成功 →「繼續設定」回到 O3', async () => {
    const s = settingsServices({ doc: readyDoc((d) => ({ ...d, meta: { ...d.meta, onboarding: 'notStarted' } })) })
    await renderSettings(s, '/onboarding')
    await act(async () => press(await screen.findByText('我用過網頁版，匯入進度').then(() => '我用過網頁版，匯入進度')))
    await enter(await screen.findByLabelText('網頁版進度碼').then(() => web.code))
    await press('檢查進度碼')
    await press('覆寫並匯入')
    await act(async () => press('確定覆寫'))
    await screen.findByText(/^匯入完成/)
    await act(async () => press('繼續設定'))
    await waitFor(() => expect(s.store.getState().doc!.meta.onboarding).toBe('minutes'))
    expect(await screen.findByText('每天修行幾分鐘？')).toBeOnTheScreen()
  })
})

test('U2：出貨題庫已不含退役題的內容，匯入碼裡的退役 ID 仍算「不可用」（只靠 manifest 的 ID）', () => {
  const st = defaultState()
  st.gDone.n3 = ['g-n3-001', 'g-n3-020', 'g-n3-021']
  st.rDone.n3 = ['r1']
  st.lDone.n3 = ['l7']
  expect(loadLevel('n3').grammar.some((g) => g.id === 'g-n3-001')).toBe(false)
  expect(unavailableCount(st, bankManifest)).toBe(4)
})
