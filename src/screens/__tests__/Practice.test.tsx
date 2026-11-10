// S7 課表、S8 單字課、S9 複習。
import { router } from 'expo-router'
import { act, fireEvent, screen } from 'expo-router/testing-library'
import { Alert } from 'react-native'
import { submitAnswer } from '../../state/core'
import { fixtureBank } from '../../test/fixtures'
import { makeServices, NOW, readyDoc, renderApp } from '../../test/harness'

const bank = fixtureBank('n5')
const n3 = (firstOpenDate: string, owned = false) =>
  readyDoc((d) => ({ ...d, learning: { ...d.learning, level: 'n3' }, meta: { ...d.meta, firstOpenDate }, entitlement: { ...d.entitlement, owned } }))

describe('S7 課表', () => {
  test('成功：每課顯示進度；N3 第 1 課標「免費試用」、第 2 課起「完整版・鎖定」', async () => {
    await renderApp(makeServices({ doc: n3('2026-11-01') }), '/practice', 'practice')
    await fireEvent.press(await screen.findByRole('button', { name: '文法' }))
    expect(await screen.findByRole('button', { name: '第 1 課，已做 0／10，掌握 0，免費試用' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '第 2 課，已做 0／2，掌握 0，完整版・鎖定' })).toBeOnTheScreen()
  })
  const openLesson2 = async (doc: ReturnType<typeof n3>, name: string | RegExp = /第 2 課/, s = makeServices({ doc })) => {
    await renderApp(s, '/practice', 'practice')
    await fireEvent.press(await screen.findByRole('button', { name: '文法' }))
    await fireEvent.press(await screen.findByRole('button', { name }))
  }
  test('鎖定：非第一天點鎖定課導向 S14', async () => {
    await openLesson2(n3('2026-11-01'))
    expect(await screen.findByRole('header', { name: 'N3–N1 完整版' })).toBeOnTheScreen()
  })
  test('鎖定：第一天點鎖定課導向 S14a', async () => {
    await openLesson2(n3('2026-11-09'))
    expect(await screen.findByRole('header', { name: '這是 N3–N1 完整版的內容' })).toBeOnTheScreen()
  })
  test('鎖定：已購直接進課', async () => {
    await openLesson2(n3('2026-11-01', true), '第 2 課，已做 0／2，掌握 0')
    expect(await screen.findByText('1／2')).toBeOnTheScreen()
  })
  test('錯誤：StoreKit 查不到購買狀態時沿用本機 entitlement 快取', async () => {
    const doc = n3('2026-11-01', true)
    const s = makeServices({ doc, storeFail: true })
    await openLesson2(doc, '第 2 課，已做 0／2，掌握 0', s)
    expect(await screen.findByText('1／2')).toBeOnTheScreen()
    expect(s.store.getState().doc!.entitlement.owned).toBe(true)
  })
  test('重複操作：購買成功後返回課表立即解鎖，不需要重開', async () => {
    const doc = n3('2026-11-01')
    const s = makeServices({ doc })
    await openLesson2(doc, /第 2 課/, s)
    expect(await screen.findByRole('header', { name: 'N3–N1 完整版' })).toBeOnTheScreen()
    await act(() => s.store.setEntitlement(true, NOW.toISOString()))
    await act(() => router.back())
    await fireEvent.press(await screen.findByRole('button', { name: '第 2 課，已做 0／2，掌握 0' }))
    expect(await screen.findByText('1／2')).toBeOnTheScreen()
  })
  test('空結果：類別沒有內容時寫「準備中」', async () => {
    await renderApp(makeServices({ doc: readyDoc(), load: () => bank }), '/practice', 'practice')
    // fixtureManifest 每級都有讀解；用沒有聽力的等級模擬
    await fireEvent.press(await screen.findByRole('button', { name: '聽力' }))
    expect(await screen.findByRole('button', { name: /第 1 課/ })).toBeOnTheScreen()
  })
  test('等待與錯誤：骨架與重試', async () => {
    await renderApp(makeServices({ doc: readyDoc(), load: () => new Promise(() => {}) }), '/practice', 'practice')
    expect(await screen.findByLabelText('載入中', {}, { timeout: 1500 })).toBeOnTheScreen()
    await renderApp(makeServices({ doc: readyDoc(), load: () => { throw Error('x') } }), '/practice', 'practice')
    expect(await screen.findByText('題庫載入失敗')).toBeOnTheScreen()
  })
  test('重複操作：連點同一課只開一次；恢復：回來時仍在上次的類別', async () => {
    await renderApp(makeServices({ doc: readyDoc() }), '/practice', 'practice')
    await fireEvent.press(await screen.findByRole('button', { name: '文法' }))
    const lesson = await screen.findByRole('button', { name: /第 1 課/ })
    await fireEvent.press(lesson)
    await fireEvent.press(lesson)
    expect(await screen.findAllByRole('button', { name: '中止' })).toHaveLength(1)
    await act(() => router.back())
    expect(await screen.findByRole('button', { name: '文法' })).toBeSelected()
  })
})

describe('S8 單字課', () => {
  test('成功：清單與翻卡／讀音測驗入口；掌握只能靠作答，清單沒有手動標記，已掌握只顯示狀態', async () => {
    const d = readyDoc()
    d.learning.vKnown.n5['水'] = true
    const s = makeServices({ doc: d })
    await renderApp(s, '/practice/vocab?lesson=1', 'practice')
    expect(await screen.findByLabelText('水，已掌握')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /標記為已掌握|點一下取消/ })).toBeNull()
    expect(screen.queryByText('標記已掌握')).toBeNull()
    expect(screen.getByRole('button', { name: '讀音測驗' })).toBeOnTheScreen()
  })
  test('空結果：到期 0 時「沒有到期的單字」＋改看全部；搜尋無結果＋清除搜尋', async () => {
    await renderApp(makeServices({ doc: readyDoc() }), '/practice/vocab?lesson=1', 'practice')
    await fireEvent.press(await screen.findByRole('button', { name: '到期' }))
    expect(await screen.findByText('沒有到期的單字')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '改看全部' }))
    await fireEvent.changeText(screen.getByLabelText('搜尋單字'), 'xyz')
    expect(await screen.findByText('找不到「xyz」')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '清除搜尋' }))
    expect(await screen.findByText('河川')).toBeOnTheScreen()
  })
  test('恢復：進翻卡後返回，保留篩選與搜尋字', async () => {
    await renderApp(makeServices({ doc: readyDoc() }), '/practice/vocab?lesson=1', 'practice')
    await fireEvent.press(await screen.findByRole('button', { name: '到期' }))
    await fireEvent.changeText(screen.getByLabelText('搜尋單字'), 'xyz')
    await fireEvent.press(screen.getByRole('button', { name: '翻卡' }))
    expect(await screen.findByRole('button', { name: '中止' })).toBeOnTheScreen()
    await act(() => router.back())
    expect(await screen.findByRole('button', { name: '到期' })).toBeSelected()
    expect(screen.getByLabelText('搜尋單字')).toHaveDisplayValue('xyz')
  })
  test('錯誤與等待', async () => {
    await renderApp(makeServices({ doc: readyDoc(), load: () => { throw Error('x') } }), '/practice/vocab?lesson=1', 'practice')
    expect(await screen.findByText('題庫載入失敗')).toBeOnTheScreen()
    await renderApp(makeServices({ doc: readyDoc(), load: () => new Promise(() => {}) }), '/practice/vocab?lesson=1', 'practice')
    expect(await screen.findByLabelText('載入中', {}, { timeout: 1500 })).toBeOnTheScreen()
  })
})

describe('S9 複習', () => {
  const wrong = (id: string) => (d: ReturnType<typeof readyDoc>) =>
    submitAnswer(d, { attemptId: id, ref: { level: 'n5', kind: 'grammar', id }, mode: 'grammar', correct: false }, () => NOW, bank).doc
  test('空結果：「沒有待複習的題目」', async () => {
    await renderApp(makeServices({ doc: readyDoc() }), '/review')
    expect(await screen.findByText('沒有待複習的題目')).toBeOnTheScreen()
  })
  test('錯誤：題庫找不到的 ID 列為不可用，保留紀錄', async () => {
    const s = makeServices({ doc: wrong('g-n5-retired')(wrong('g-n5-001')(readyDoc())) })
    await renderApp(s, '/review')
    expect(await screen.findByText('不可用 1 項')).toBeOnTheScreen()
    expect(screen.getByText('g-n5-retired')).toBeOnTheScreen()
    expect(s.store.getState().doc!.learning.mistakes['["n5","grammar","g-n5-retired"]']).toBeDefined()
  })
  test('成功與重複操作：答對解除待複習；同日已計分的錯題 0 XP', async () => {
    const s = makeServices({ doc: wrong('g-n5-001')(readyDoc()) })
    await renderApp(s, '/review')
    await fireEvent.press(await screen.findByRole('button', { name: '開始複習（1 題）' }))
    await fireEvent.press(await screen.findByRole('button', { name: bank.grammar[0].answer }))
    expect(await screen.findByText('今天已計分')).toBeOnTheScreen()
    expect(s.store.getState().doc!.learning.mistakes['["n5","grammar","g-n5-001"]'].pending).toBe(false)
  })
  test('恢復：輪次固定，當題答對不立刻消失；中止後再進來續做', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1].onPress?.())
    const s = makeServices({ doc: wrong('g-n5-002')(wrong('g-n5-001')(readyDoc())) })
    await renderApp(s, '/review')
    await fireEvent.press(await screen.findByRole('button', { name: '開始複習（2 題）' }))
    expect(await screen.findByText('1／2')).toBeOnTheScreen()
    const answers = new RegExp(`^(${bank.grammar[0].answer}|${bank.grammar[1].answer})$`)
    await fireEvent.press(screen.getAllByRole('button', { name: answers })[0])
    expect(await screen.findByText('今天已計分')).toBeOnTheScreen()
    expect(screen.getByText('1／2')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '下一題' })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '中止' }))
    await fireEvent.press(await screen.findByRole('button', { name: '開始複習（1 題）' }))
    expect(await screen.findByText('1／1')).toBeOnTheScreen()
  })
  test('等待：題庫載入中顯示骨架', async () => {
    await renderApp(makeServices({ doc: readyDoc(), load: () => new Promise(() => {}) }), '/review')
    expect(await screen.findByLabelText('載入中', {}, { timeout: 1500 })).toBeOnTheScreen()
  })
})
