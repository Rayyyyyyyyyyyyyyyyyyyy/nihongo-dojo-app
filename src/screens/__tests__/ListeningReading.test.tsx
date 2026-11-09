// S10 聽力與 S11 讀解。
import { fireEvent, screen } from 'expo-router/testing-library'
import { AppState } from 'react-native'
import { completeReading, submitAnswer } from '../../state/core'
import { fixtureBank } from '../../test/fixtures'
import { makeServices, NOW, readyDoc, renderApp } from '../../test/harness'

const bank = fixtureBank('n5')
const listening = '/session?src=lesson&kind=listening&lesson=1'
const reading = '/session?src=lesson&kind=reading&lesson=1'

describe('S10 聽力', () => {
  test('成功：朗讀前移除「男：」「女：」，畫面文字稿保留；以設定語速 ja-JP 朗讀', async () => {
    const s = makeServices({ doc: readyDoc() })
    await renderApp(s, listening)
    await fireEvent.press(await screen.findByRole('button', { name: '播放' }))
    expect(s.spoken[0]).toBe(bank.listening[0].script.replace(/[男女]：/g, ''))
    expect(s.speechEngine.speak.mock.calls[0][1]).toMatchObject({ language: 'ja-JP', rate: 1 })
    expect(await screen.findByText('播放中')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '顯示文字稿' }))
    expect(screen.getByText(bank.listening[0].script)).toBeOnTheScreen()
  })
  test('等待：按播放到語音開始前顯示「準備語音」', async () => {
    const s = makeServices({ doc: readyDoc() })
    s.speechEngine.speak.mockImplementation((t: string) => void s.spoken.push(t))
    await renderApp(s, listening)
    await fireEvent.press(await screen.findByRole('button', { name: '播放' }))
    expect(await screen.findByRole('button', { name: '準備語音' })).toBeBusy()
  })
  test('暫停／繼續／停止；語速切換為 0.8×', async () => {
    const s = makeServices({ doc: readyDoc() })
    await renderApp(s, listening)
    await fireEvent.press(await screen.findByRole('button', { name: '播放' }))
    await fireEvent.press(await screen.findByRole('button', { name: '暫停' }))
    await fireEvent.press(await screen.findByRole('button', { name: '繼續' }))
    await fireEvent.press(await screen.findByRole('button', { name: '停止' }))
    expect(s.speechEngine.pause).toHaveBeenCalled()
    expect(s.speechEngine.resume).toHaveBeenCalled()
    await fireEvent.press(await screen.findByRole('button', { name: '語速 1.0 倍，點一下切換' }))
    expect(s.store.getState().doc!.settings.speechRate).toBe(0.8)
  })
  test('空結果：沒有日語語音時說明下載方式並提供文字稿', async () => {
    await renderApp(makeServices({ doc: readyDoc(), voices: ['en-US'] }), listening)
    expect(await screen.findByText('這台 iPhone 沒有日語語音')).toBeOnTheScreen()
    await fireEvent.press(screen.getAllByRole('button', { name: '顯示文字稿' })[0])
    expect(screen.getByText(bank.listening[0].script)).toBeOnTheScreen()
  })
  test('錯誤：播放失敗顯示重試與文字稿，不算作答', async () => {
    const s = makeServices({ doc: readyDoc() })
    s.speechEngine.speak.mockImplementation((_t: string, o: { onError?: (e: Error) => void }) => o.onError?.(Error('tts')))
    await renderApp(s, listening)
    await fireEvent.press(await screen.findByRole('button', { name: '播放' }))
    expect(await screen.findByText('播放失敗')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '重試' })).toBeOnTheScreen()
    expect(s.store.getState().doc!.learning.results).toHaveLength(0)
  })
  test('靜音提示每次進入聽力課顯示一次（只在第一題）', async () => {
    await renderApp(makeServices({ doc: readyDoc() }), listening)
    expect(await screen.findByText('聽不到聲音？請關閉側邊的靜音開關並調高音量')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: bank.listening[0].answer }))
    await fireEvent.press(screen.getByRole('button', { name: '下一題' }))
    await screen.findByText('2／3')
    expect(screen.queryByText('聽不到聲音？請關閉側邊的靜音開關並調高音量')).not.toBeOnTheScreen()
  })
  test('恢復與重複操作：App 進背景停止播放；重複播放不產生作答紀錄、每次先停前一段', async () => {
    const listeners: Array<(s: string) => void> = []
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => (listeners.push(cb as never), { remove: () => {} }) as never)
    const s = makeServices({ doc: readyDoc() })
    await renderApp(s, listening)
    const play = await screen.findByRole('button', { name: '播放' })
    await fireEvent.press(play)
    await fireEvent.press(await screen.findByRole('button', { name: '停止' }))
    await fireEvent.press(await screen.findByRole('button', { name: '播放' }))
    expect(s.speechEngine.speak).toHaveBeenCalledTimes(2)
    const stops = s.speechEngine.stop.mock.calls.length
    listeners.forEach((l) => l('background'))
    expect(s.speechEngine.stop.mock.calls.length).toBeGreaterThan(stops)
    expect(await screen.findByRole('button', { name: '播放' })).toBeOnTheScreen()
    expect(s.store.getState().doc!.learning.results).toHaveLength(0)
  })
})

describe('S11 讀解', () => {
  const a = bank.reading[0]
  test('成功：每子題各自計 XP；整篇答完記任務完成，全對才記掌握', async () => {
    const s = makeServices({ doc: readyDoc() })
    await renderApp(s, reading)
    expect(await screen.findByText(a.title)).toBeOnTheScreen()
    expect(screen.getByText('第 1／2 題')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: a.questions[0].answer }))
    expect(await screen.findByText('+10 XP')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '下一個子題' }))
    await fireEvent.press(await screen.findByRole('button', { name: a.questions[1].answer }))
    await fireEvent.press(screen.getByRole('button', { name: '看結果' }))
    expect(await screen.findByText('修行結果')).toBeOnTheScreen()
    expect(s.store.getState().doc!.learning.rDone.n5).toEqual([a.id])
  })
  test('恢復：同一篇未完成的 attempt 從第一個未答子題續做', async () => {
    const q = a.questions[0]
    const d = submitAnswer(readyDoc(), { attemptId: JSON.stringify(['art', q.id]), ref: { level: 'n5', kind: 'reading', id: q.id, articleId: a.id }, mode: 'reading', correct: true }, () => NOW, bank).doc
    await renderApp(makeServices({ doc: d }), reading)
    expect(await screen.findByText('第 2／2 題')).toBeOnTheScreen()
  })
  test('空結果：該課沒有文章時顯示「沒有可以練習的題目」', async () => {
    await renderApp(makeServices({ doc: readyDoc(), load: () => ({ ...bank, reading: [] }) }), reading)
    expect(await screen.findByText('沒有可以練習的題目')).toBeOnTheScreen()
  })
  test('重複操作：同日重做同篇作答照常回饋，XP 0', async () => {
    const d = a.questions.reduce(
      (doc, q) => submitAnswer(doc, { attemptId: JSON.stringify(['old', q.id]), ref: { level: 'n5', kind: 'reading', id: q.id, articleId: a.id }, mode: 'reading', correct: true }, () => NOW, bank).doc,
      readyDoc(),
    )
    const done = completeReading(d, { attemptId: 'old', level: 'n5', articleId: a.id, questionIds: a.questions.map((q) => q.id), resultIds: a.questions.map((q) => JSON.stringify(['old', q.id])) }, () => NOW, bank).doc
    await renderApp(makeServices({ doc: done }), reading)
    expect(await screen.findByText('第 1／2 題')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: a.questions[0].answer }))
    expect(await screen.findByText('今天已計分')).toBeOnTheScreen()
  })
})
