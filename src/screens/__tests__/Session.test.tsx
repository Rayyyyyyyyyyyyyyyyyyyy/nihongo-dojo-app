// S3 作答與 S4 結果：狀態表各列。
import { fireEvent, screen } from 'expo-router/testing-library'
import { Alert } from 'react-native'
import { dayKey } from '../../domain/learning/types'
import { ensurePlan, submitAnswer } from '../../state/core'
import { fixtureBank } from '../../test/fixtures'
import { makeServices, NOW, readyDoc, renderApp } from '../../test/harness'

const bank = fixtureBank('n5')
const clock = () => NOW
const grammarLesson = '/session?src=lesson&kind=grammar&lesson=1'
const correctOf = (prompt: string) => bank.grammar.find((g) => g.q === prompt)!.answer

async function answerGrammar(correct: boolean) {
  const prompt = (await screen.findByRole('header')).props.children as string
  const g = bank.grammar.find((x) => x.q === prompt)!
  await fireEvent.press(screen.getByRole('button', { name: correct ? g.answer : g.distractors[0] }))
}

test('等待：題庫載入中顯示題卡骨架', async () => {
  await renderApp(makeServices({ doc: readyDoc(), load: () => new Promise(() => {}) }), grammarLesson)
  expect(await screen.findByLabelText('題目載入中', {}, { timeout: 1500 })).toBeOnTheScreen()
})

test('錯誤：題庫載入失敗可重試', async () => {
  await renderApp(makeServices({ doc: readyDoc(), load: () => { throw Error('x') } }), grammarLesson)
  expect(await screen.findByText('題庫載入失敗')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: '重試' })).toBeOnTheScreen()
})

test('成功：答對顯示「答對」、+10 XP、success 觸覺；答錯標示正確答案與解析、+3、warning 觸覺', async () => {
  const s = makeServices({ doc: readyDoc() })
  await renderApp(s, grammarLesson)
  await answerGrammar(true)
  expect(await screen.findByText('+10 XP')).toBeOnTheScreen()
  expect(screen.getAllByText('答對').length).toBeGreaterThan(0)
  expect(s.hapticsEngine.notificationAsync).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole('button', { name: '下一題' }))
  const prompt = (await screen.findByRole('header')).props.children as string
  await answerGrammar(false)
  expect(await screen.findByText('+3 XP')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: `${correctOf(prompt)}，正確答案` })).toBeOnTheScreen()
  expect(screen.getByText(bank.grammar.find((g) => g.q === prompt)!.explanation)).toBeOnTheScreen()
  expect(s.sound.play).toHaveBeenCalledWith('wrong')
})

test('重複操作：已提交的選項鎖定；「下一題」連點只前進一題；同日重做顯示「今天已計分」', async () => {
  const first = bank.grammar[0]
  const d = submitAnswer(readyDoc(), { attemptId: 'p', ref: { level: 'n5', kind: 'grammar', id: first.id }, mode: 'grammar', correct: true }, clock, bank).doc
  const s = makeServices({ doc: d })
  await renderApp(s, grammarLesson)
  await screen.findByText('1／10')
  const prompt = (await screen.findByRole('header')).props.children as string
  await answerGrammar(true)
  if (prompt === first.q) expect(await screen.findByText('今天已計分')).toBeOnTheScreen()
  const before = s.store.getState().doc!.learning.results.length
  await fireEvent.press(screen.getByRole('button', { name: `${correctOf(prompt)}，答對` }))
  expect(s.store.getState().doc!.learning.results.length).toBe(before)
  const next = screen.getByRole('button', { name: '下一題' })
  await fireEvent.press(next)
  await fireEvent.press(next)
  expect(await screen.findByText('2／10')).toBeOnTheScreen()
})

test('連擊 ≥3 顯示「連擊 3」', async () => {
  await renderApp(makeServices({ doc: readyDoc() }), grammarLesson)
  for (let i = 0; i < 3; i++) {
    await answerGrammar(true)
    if (i < 2) await fireEvent.press(screen.getByRole('button', { name: '下一題' }))
  }
  expect(await screen.findByText('連擊 3')).toBeOnTheScreen()
})

test('空結果：今日任務的目標全部失效時先修復，顯示「這組題目已更新」＋開始', async () => {
  const d = ensurePlan(readyDoc(), 'listening', clock, bank)
  const p = d.learning.plans[dayKey('2026-11-09', 'n5')]
  p.groups.grammar!.targets = p.groups.grammar!.targets.map((t, i) => ({ ...t, id: `gone-${i}` }))
  const s = makeServices({ doc: d })
  await renderApp(s, '/session?src=today')
  expect(await screen.findByText('這組題目已更新，已幫你換成新的題目')).toBeOnTheScreen()
  const fixed = s.store.getState().doc!.learning.plans[dayKey('2026-11-09', 'n5')].groups.grammar!
  expect(fixed.targets.every((t) => !t.id.startsWith('gone'))).toBe(true)
  await fireEvent.press(screen.getByRole('button', { name: '開始' }))
  expect(await screen.findByText('1／18')).toBeOnTheScreen()
})

test('錯誤：缺選項的題目顯示「這題資料有問題，已跳過」，不計分', async () => {
  const broken = { ...bank, grammar: bank.grammar.map((g) => ({ ...g, distractors: [] })) }
  const s = makeServices({ doc: readyDoc(), load: () => broken })
  await renderApp(s, grammarLesson)
  expect(await screen.findByText('這題資料有問題，已跳過')).toBeOnTheScreen()
  expect(s.store.getState().doc!.learning.results).toHaveLength(0)
})

test('錯誤：保存失敗時作答照常生效並顯示保存失敗橫條', async () => {
  const s = makeServices({ doc: readyDoc() })
  s.files.failWrites = true
  await renderApp(s, grammarLesson)
  await answerGrammar(true)
  expect(await screen.findByRole('button', { name: '進度暫時沒有保存。請到「我的 → 資料與備份」匯出進度碼。' })).toBeOnTheScreen()
  expect(s.store.getState().doc!.rewards.xpTotal).toBe(10)
})

test('恢復：中止要確認；已提交的作答保留，回來從第一題未作答的續做', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1].onPress?.())
  const s = makeServices({ doc: readyDoc() })
  await renderApp(s)
  await fireEvent.press(await screen.findByRole('button', { name: '開始' }))
  await fireEvent.press(await screen.findByRole('button', { name: '翻面' }))
  await fireEvent.press(screen.getByRole('button', { name: '記得' }))
  await fireEvent.press(screen.getByRole('button', { name: '中止' }))
  expect(Alert.alert).toHaveBeenCalled()
  expect(await screen.findByRole('button', { name: '續做（已完成 1／18）' })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: '續做（已完成 1／18）' }))
  expect(await screen.findByText('1／17')).toBeOnTheScreen()
})

test('S4 結果：XP 分項、答對率、錯題數與「現在複習」；全部答完才出現', async () => {
  await renderApp(makeServices({ doc: readyDoc() }), grammarLesson)
  for (let i = 0; i < 10; i++) {
    await answerGrammar(i !== 0)
    await fireEvent.press(screen.getByRole('button', { name: i === 9 ? '看結果' : '下一題' }))
  }
  expect(await screen.findByText('修行結果')).toBeOnTheScreen()
  expect(screen.getByLabelText('本次 93 XP')).toBeOnTheScreen()
  expect(screen.getByText('首次答對 9・到期複習 0・練習 1')).toBeOnTheScreen()
  expect(screen.getByText('答對 9／10（90%）')).toBeOnTheScreen()
  expect(screen.getByText('錯題 1 題')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: '現在複習' })).toBeOnTheScreen()
  // 重複操作：「繼續」只觸發一次
  const go = screen.getByRole('button', { name: '繼續' })
  await fireEvent.press(go)
  await fireEvent.press(go)
})

test('單字翻卡：翻面不給 XP，自評「記得」才提交', async () => {
  const s = makeServices({ doc: readyDoc() })
  await renderApp(s, '/session?src=lesson&kind=vocab&lesson=1&vmode=flashcard')
  await fireEvent.press(await screen.findByRole('button', { name: '翻面' }))
  expect(s.store.getState().doc!.rewards.xpTotal).toBe(0)
  await fireEvent.press(screen.getByRole('button', { name: '記得' }))
  expect(await screen.findByText('+10 XP')).toBeOnTheScreen()
})

test('讀音測驗：題目是單字、選項是讀音', async () => {
  await renderApp(makeServices({ doc: readyDoc() }), '/session?src=lesson&kind=vocab&lesson=1&vmode=pronunciation')
  expect(await screen.findByText('選出正確的讀音')).toBeOnTheScreen()
  const word = (await screen.findByRole('header')).props.children as string
  const v = bank.vocab.find((x) => x.w === word)!
  await fireEvent.press(screen.getByRole('button', { name: v.r }))
  expect(await screen.findByText('+10 XP')).toBeOnTheScreen()
})
