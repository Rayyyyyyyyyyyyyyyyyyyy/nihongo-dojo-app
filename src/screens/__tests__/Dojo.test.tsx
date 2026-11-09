// S2 道場：app-design §6 狀態表（等待／空結果／錯誤／恢復／成功／重複操作）。
import { fireEvent, screen } from 'expo-router/testing-library'
import { dayKey } from '../../domain/learning/types'
import { ensurePlan, submitAnswer } from '../../state/core'
import { fixtureBank } from '../../test/fixtures'
import { makeServices, NOW, readyDoc, renderApp } from '../../test/harness'

const bank = fixtureBank('n5')
const clock = () => NOW
const planned = () => ensurePlan(readyDoc(), 'listening', clock, bank)
const targets = (d: ReturnType<typeof planned>) => {
  const p = d.learning.plans[dayKey('2026-11-09', 'n5')]
  return [...p.groups.vocab!.targets, ...p.groups.grammar!.targets, ...p.groups.listening!.targets]
}
const answerAll = (d: ReturnType<typeof planned>, refs = targets(d)) =>
  refs.reduce(
    (doc, ref, i) => submitAnswer(doc, { attemptId: `t${i}`, ref, mode: ref.kind === 'vocab' ? 'flashcard' : (ref.kind as 'grammar'), correct: true }, clock, bank).doc,
    d,
  )

test('等待：題庫還在載入時 300ms 後顯示骨架', async () => {
  await renderApp(makeServices({ doc: readyDoc(), load: () => new Promise(() => {}) }))
  expect(await screen.findByLabelText('載入中', {}, { timeout: 1500 })).toBeOnTheScreen()
})

test('空結果：沒有到期項目時寫「今天沒有到期項目」，不硬塞題', async () => {
  await renderApp(makeServices({ doc: readyDoc() }))
  expect(await screen.findByText('今天沒有到期項目')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: '開始' })).toBeOnTheScreen()
  expect(screen.getByText('今日修行・10 分鐘')).toBeOnTheScreen()
})

test('錯誤：題庫載入失敗顯示卡片內錯誤與重試，連勝與段位仍顯示；重試成功後出現任務', async () => {
  let fail = true
  await renderApp(makeServices({ doc: readyDoc(), load: (l) => { if (fail) throw Error('bad'); return fixtureBank(l) } }))
  expect(await screen.findByText('題庫載入失敗')).toBeOnTheScreen()
  expect(screen.getByLabelText('連勝 0 天')).toBeOnTheScreen()
  expect(screen.getByText('段位　白帶')).toBeOnTheScreen()
  fail = false
  await fireEvent.press(screen.getByRole('button', { name: '重試' }))
  expect(await screen.findByRole('button', { name: '開始' })).toBeOnTheScreen()
})

test('恢復：今日任務已開始未完成時顯示「續做（已完成 n／18）」', async () => {
  const d = answerAll(planned(), targets(planned()).slice(0, 2))
  await renderApp(makeServices({ doc: d }))
  expect(await screen.findByRole('button', { name: '續做（已完成 2／18）' })).toBeOnTheScreen()
})

test('成功：今日目標完成顯示「今日修行完成」、加練與開寶箱', async () => {
  await renderApp(makeServices({ doc: answerAll(planned()) }))
  expect(await screen.findByText('今日修行完成')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: '加練' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: '開寶箱' })).toBeOnTheScreen()
  expect(screen.getByLabelText('今天的修行印')).toBeOnTheScreen()
})

test('重複操作：寶箱已開時寫「今天已開，明天再來」；連點「開始」只開一個修行', async () => {
  const s = makeServices({ doc: answerAll(planned()) })
  await renderApp(s)
  await screen.findByText('今日修行完成')
  s.store.openChest()
  expect(await screen.findByText('今天已開，明天再來。今天拿到：初稽古印')).toBeOnTheScreen()

  const s2 = makeServices({ doc: readyDoc() })
  await renderApp(s2)
  const start = await screen.findByRole('button', { name: '開始' })
  await fireEvent.press(start)
  await fireEvent.press(start)
  expect(await screen.findAllByRole('button', { name: '中止' })).toHaveLength(1)
})

test('切換等級時任務依新等級重建，不重設另一等級的任務', async () => {
  const s = makeServices({ doc: readyDoc() })
  await renderApp(s)
  await screen.findByRole('button', { name: '開始' })
  const n5 = s.store.getState().doc!.learning.plans[dayKey('2026-11-09', 'n5')]
  await fireEvent.press(screen.getByRole('button', { name: 'N4' }))
  expect(await screen.findByRole('button', { name: '開始' })).toBeOnTheScreen()
  expect(s.store.getState().doc!.learning.plans[dayKey('2026-11-09', 'n4')]).toBeDefined()
  expect(s.store.getState().doc!.learning.plans[dayKey('2026-11-09', 'n5')]).toEqual(n5)
})

test('段位與等級切換有 VoiceOver 標籤；到期項目出現在複習卡', async () => {
  const d = submitAnswer(planned(), { attemptId: 'w', ref: { level: 'n5', kind: 'grammar', id: 'g-n5-001' }, mode: 'grammar', correct: false }, clock, bank).doc
  await renderApp(makeServices({ doc: d }))
  expect(await screen.findByRole('button', { name: '錯題，1' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'N5' })).toBeSelected()
  expect(screen.getByLabelText('段位 白帶，累積 3 XP')).toBeOnTheScreen()
})
