// Ported from NHK-N3-1 src/domain/progress/progress.test.ts @ aadd243. Session/storage tests
// (import backups, undo, reload, storage exceptions, snapshot bound) wait for the store layer.
import { defaultState, normalize, encodeCode, decodeCode, touchStreak } from './state'
const codeFor = (v: unknown) => btoa(encodeURIComponent(JSON.stringify(v)))
it('rejects unrelated JSON and malformed input', () => {
  for (const code of [
    codeFor({ hello: 'world' }),
    '這不是 base64!!!',
    codeFor({ version: 4, state: { hello: 'world' } }),
  ])
    expect(() => decodeCode(code)).toThrow()
})
it('round trips every field at every level, Unicode and streak', () => {
  const s = defaultState()
  s.level = 'n2'
  s.streak = 7
  s.lastDate = '2026-09-08'
  for (const lv of ['n5', 'n4', 'n3', 'n2', 'n1'] as const) {
    s.vKnown[lv]['水'] = true
    s.vLearning[lv]['曖昧'] = true
    s.gDone[lv] = [`g-${lv}-001`]
    s.rDone[lv] = ['r1']
    s.lDone[lv] = ['l1', 'l2']
    s.lCorrect[lv] = ['l1']
  }
  expect(decodeCode(encodeCode(s))).toEqual(s)
})
it('rejects old codes entirely', () => {
  expect(() => decodeCode(codeFor({ vKnown: { n3: { 水: true } } }))).toThrow(/不支援/)
})
it('normalizes partial same-version data without aliasing', () => {
  const p = { vKnown: { n3: { 水: true } }, gDone: { n3: ['g-n3-001'] }, level: 'invalid' }
  const s = normalize(p)
  expect(s.level).toBe('n5')
  expect(s.gDone.n1).toEqual([])
  s.gDone.n3.push('g-n3-002')
  expect(p.gDone.n3).toHaveLength(1)
})
it('updates streak on same, next and interrupted dates', () => {
  const s = defaultState()
  s.streak = 5
  s.lastDate = '2026-09-07'
  touchStreak(s, '2026-09-07')
  expect(s.streak).toBe(5)
  touchStreak(s, '2026-09-08')
  expect(s.streak).toBe(6)
  touchStreak(s, '2026-09-11')
  expect(s.streak).toBe(1)
})
