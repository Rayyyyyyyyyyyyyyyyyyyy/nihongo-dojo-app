// S12 收集冊：掌握狀態的檢視（rewards §7）。
import { fireEvent, screen } from 'expo-router/testing-library'
import type { AppStateDoc } from '../../state/doc'
import { fixtureBank } from '../../test/fixtures'
import { makeServices, readyDoc, renderApp } from '../../test/harness'

const EMPTY = '掌握一個單字或文法，就會在這裡掛上第一塊札'
const open = async (patch?: (d: AppStateDoc) => AppStateDoc, o: Parameters<typeof makeServices>[0] = {}) => {
  const s = makeServices({ doc: readyDoc(patch), ...o })
  await renderApp(s, '/collection', 'collection')
  return s
}
const mastered = (d: AppStateDoc): AppStateDoc => ({
  ...d,
  learning: { ...d.learning, vKnown: { ...d.learning.vKnown, n5: { 水: true } }, gDone: { ...d.learning.gDone, n5: ['g-n5-001'] } },
})

describe('S12 收集冊', () => {
  test('空結果：還沒點亮任何札時顯示說明與「去修行」，札都是輪廓', async () => {
    await open()
    expect(await screen.findByText(EMPTY)).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: '單字札板・已掛 0／24' })).toBeOnTheScreen()
    expect(screen.getByLabelText('水，未掌握')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '去修行' }))
    expect(screen).toHavePathname('/practice')
  })
  test('成功：已掌握的札點亮並計數；切換類別看文法札板', async () => {
    await open(mastered)
    expect(await screen.findByRole('header', { name: '單字札板・已掛 1／24' })).toBeOnTheScreen()
    expect(screen.queryByText(EMPTY)).not.toBeOnTheScreen()
    expect(screen.getByLabelText('水，已掌握')).toBeOnTheScreen()
    expect(screen.getByLabelText('山，未掌握')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '文法' }))
    expect(await screen.findByRole('header', { name: '文法札板・已掛 1／12' })).toBeOnTheScreen()
    expect(screen.getByLabelText('正1，已掌握')).toBeOnTheScreen()
  })
  test('N3–N1 未購：只列免費課的札並寫「完整版另有 n 項」；已購則全列', async () => {
    await open((d) => ({ ...d, learning: { ...d.learning, level: 'n3' } }))
    await fireEvent.press(await screen.findByRole('button', { name: '文法' }))
    expect(await screen.findByText('完整版另有 2 項')).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: '文法札板・已掛 0／12' })).toBeOnTheScreen()
    expect(screen.queryByLabelText('正11，未掌握')).not.toBeOnTheScreen()
  })
  test('N3 已購：全部札都列出，沒有「完整版另有」', async () => {
    await open((d) => ({ ...d, learning: { ...d.learning, level: 'n3' }, entitlement: { ...d.entitlement, owned: true } }))
    await fireEvent.press(await screen.findByRole('button', { name: '文法' }))
    expect(await screen.findByLabelText('正11，未掌握')).toBeOnTheScreen()
    expect(screen.queryByText(/完整版另有/)).not.toBeOnTheScreen()
  })
  test('錯誤：題庫載入失敗時卡片內錯誤＋重試，重試後顯示札板', async () => {
    let fail = true
    await open(undefined, {
      load: (l) => {
        if (fail) throw Error('bad bank')
        return fixtureBank(l)
      },
    })
    expect(await screen.findByText('題庫載入失敗')).toBeOnTheScreen()
    fail = false
    await fireEvent.press(screen.getByRole('button', { name: '重試' }))
    expect(await screen.findByRole('header', { name: '單字札板・已掛 0／24' })).toBeOnTheScreen()
  })
})
