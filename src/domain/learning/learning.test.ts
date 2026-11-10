// Ported from NHK-N3-1 src/domain/learning/learning.test.ts @ aadd243. Session/storage assertions
// (backups, disk writes, v4 storage upgrade) belong to the not-yet-ported store layer and are omitted.
import { defaultState, encodeCode, decodeCode, LEVELS } from '../progress/state'
import { validateV4, validateV5 } from '../progress/validation'
import { upgradeV4 } from '../progress/state'
import { recordResult, completeArticle } from './reducer'
import { itemKey, dayKey, type LearningInput } from './types'
import { localDate, addDays } from './calendar'
import { generateGroup, refsFor, vocabQueue, inspectGroup } from './plans'
const clock =
  (day = '2026-10-16') =>
  () =>
    new Date(`${day}T12:00:00`)
const input = (id = '水', correct = false, attemptId = 'a'): LearningInput => ({
  attemptId,
  ref: { level: 'n3', kind: 'vocab', id },
  mode: 'pronunciation',
  correct,
})
const legacy = () => {
  const { results, days, plans, mistakes, schedules, ...s } = defaultState()
  return s
}
const code = (state: unknown, version = 4) =>
  btoa(encodeURIComponent(JSON.stringify({ version, state })))
describe('strict imported trust boundary', () => {
  it('rejects malformed and conflicting v4', () => {
    const invalid: unknown[] = [
      { vKnown: [] },
      { ...legacy(), extra: 1 },
      { ...legacy(), streak: NaN },
      { ...legacy(), streak: -1 },
      { ...legacy(), streak: 1.5 },
      { ...legacy(), lastDate: '2026-02-30' },
      { ...legacy(), level: 'n6' },
    ]
    const missing = legacy()
    delete (missing.vKnown as Partial<typeof missing.vKnown>).n1
    invalid.push(missing)
    const badFlag = legacy()
    ;(badFlag.vKnown.n1 as Record<string, unknown>).水 = 'true'
    invalid.push(badFlag)
    const duplicates = legacy()
    duplicates.gDone.n3 = ['same', 'same']
    invalid.push(duplicates)
    const overlap = legacy()
    overlap.vKnown.n5.水 = true
    overlap.vLearning.n5.水 = true
    invalid.push(overlap)
    const subset = legacy()
    subset.lCorrect.n1 = ['unknown']
    invalid.push(subset)
    for (const value of invalid) {
      expect(() => decodeCode(code(value))).toThrow()
    }
    for (const version of [2, 3, 6]) expect(() => decodeCode(code(legacy(), version))).toThrow()
  })
  it('accepts complete blanks and unknown IDs, preserving all five levels and baseline', () => {
    const old = legacy()
    old.level = 'n1'
    old.streak = 9
    old.lastDate = '2026-10-16'
    for (const lv of LEVELS) {
      old.vKnown[lv]['水|[]'] = true
      old.vLearning[lv]['曖昧'] = true
      old.gDone[lv] = ['not-in-bank']
      old.rDone[lv] = ['gone']
      old.lDone[lv] = ['gone']
      old.lCorrect[lv] = ['gone']
    }
    const next = upgradeV4(old, '2026-10-16')
    expect(decodeCode(code(old), '2026-10-16')).toEqual(next)
    expect(next.results).toEqual([])
    expect(Object.values(next.schedules)).toHaveLength(10)
    expect(
      Object.values(next.schedules).every(
        (x) => x.stage === 0 && x.dueOn === '2026-10-16' && x.lastScheduledOn === '',
      ),
    ).toBe(true)
    expect(decodeCode(encodeCode(next))).toEqual(next)
    expect(validateV5(defaultState())).toBe(true)
  })
  it('rejects new field corruption, duplicates, invalid modes/dates/capacity and unknown nested fields', () => {
    const state = recordResult(defaultState(), input(), clock())
    const changed = (f: (s: typeof state) => void) => {
      const copy = JSON.parse(JSON.stringify(state))
      f(copy)
      expect(() => decodeCode(code(copy, 5))).toThrow()
    }
    changed((s) => {
      s.results.push(s.results[0])
    })
    changed((s) => {
      s.results[0].mode = 'grammar'
    })
    changed((s) => {
      s.results[0].date = '2026-02-30'
    })
    changed((s) => {
      s.schedules[itemKey(input().ref)].stage = 6
    })
    changed((s) => {
      s.days[dayKey('2026-10-16', 'n3')].correctItems = ['absent']
    })
    changed((s) => {
      ;(s.mistakes[itemKey(input().ref)] as unknown as Record<string, unknown>).extra = true
    })
    changed((s) => {
      s.results = Array.from({ length: 2001 }, (_, i) => ({
        ...s.results[0],
        attemptId: String(i),
      }))
    })
  })
})
describe('learning projection', () => {
  it('keys distinguish levels and special characters; duplicate attempts are no-ops', () => {
    expect(itemKey(input('a,b').ref)).not.toBe(itemKey({ ...input('a,b').ref, level: 'n1' }))
    expect(itemKey(input('a,b').ref)).not.toBe(itemKey(input('a","b').ref))
    const s = recordResult(defaultState(), input(), clock())
    expect(recordResult(s, input(), clock())).toBe(s)
    expect(s.vLearning.n3.水).toBe(true)
    expect(s.streak).toBe(1)
    expect(s.results).toHaveLength(1)
    expect(recordResult(s, { ...input(), mode: 'grammar', attemptId: 'bad' }, clock())).toBe(s)
  })
  it('wrong → correct → wrong and shared vocabulary modes preserve counts, latest result and mastery semantics', () => {
    let s = recordResult(defaultState(), input(), clock())
    s = recordResult(s, { ...input('水', true, 'b'), mode: 'pronunciation' }, clock())
    const key = itemKey(input().ref)
    expect(s.mistakes[key].pending).toBe(false)
    expect(s.vKnown.n3.水).toBe(true)
    s = recordResult(s, { ...input('水', false, 'c'), mode: 'pronunciation' }, clock())
    expect(s.vKnown.n3.水).toBeUndefined()
    expect(s.mistakes[key].wrongCount).toBe(2)
    expect(s.mistakes[key].lastWrongMode).toBe('pronunciation')
    s = recordResult(s, input('水', true, 'd'), clock())
    expect(s.vKnown.n3.水).toBe(true)
    expect(s.vLearning.n3.水).toBeUndefined()
    const day = s.days[dayKey('2026-10-16', 'n3')]
    expect(day.items).toHaveLength(1)
    expect(day.correctItems).toHaveLength(1)
  })
  it('keeps long-lived projections when 2,000 event window truncates and 90 days prune', () => {
    let s = recordResult(defaultState(), input('first', false, 'first'), clock())
    s.results = Array.from({ length: 1999 }, (_, i) => ({
      ...s.results[0],
      attemptId: `other-${i}`,
    })).concat(s.results)
    s = recordResult(s, input('last', true, 'last'), clock())
    expect(s.results).toHaveLength(2000)
    expect(s.vLearning.n3.first).toBe(true)
    expect(s.mistakes[itemKey(input('first').ref)]).toBeTruthy()
    expect(s.days[dayKey('2026-10-16', 'n3')].items).toHaveLength(2)
    s = recordResult(s, input('next', true, 'next'), clock('2027-02-01'))
    expect(s.days[dayKey('2026-10-16', 'n3')]).toBeUndefined()
    expect(s.schedules[itemKey(input('first').ref)]).toBeTruthy()
  })
  it('streak handles first, same, next, interrupted, clock rollback and v4 same-day baseline', () => {
    let s = defaultState()
    for (const [i, day, expected] of [
      [0, '2026-10-16', 1],
      [1, '2026-10-16', 1],
      [2, '2026-10-17', 2],
      [3, '2026-10-15', 2],
      [4, '2026-10-17', 2],
      [5, '2026-10-20', 1],
    ] as const) {
      s = recordResult(s, input('水', false, String(i)), clock(day))
      expect(s.streak).toBe(expected)
    }
    const old = legacy()
    old.streak = 5
    old.lastDate = '2026-10-16'
    s = recordResult(upgradeV4(old, '2026-10-16'), input(), clock())
    expect(s.streak).toBe(5)
  })
  it('uses stable reading subquestion IDs and requires complete matching article attempt', () => {
    let s = defaultState()
    const articleAttempt = 'article-A',
      ids = ['rq-second', 'rq-first']
    const resultIds = ids.map((id) => JSON.stringify([articleAttempt, id]))
    ids.forEach((id, i) => {
      s = recordResult(
        s,
        {
          attemptId: resultIds[i],
          ref: { level: 'n3', kind: 'reading', id, articleId: 'r1' },
          mode: 'reading',
          correct: i === 0,
        },
        clock(),
      )
    })
    expect(
      completeArticle(
        s,
        {
          attemptId: articleAttempt,
          level: 'n3',
          articleId: 'r1',
          questionIds: ids,
          resultIds: ['missing'],
        },
        clock(),
      ),
    ).toBe(s)
    s = completeArticle(
      s,
      { attemptId: articleAttempt, level: 'n3', articleId: 'r1', questionIds: ids, resultIds },
      clock(),
    )
    expect(s.rDone.n3).toEqual([])
    expect(s.days[dayKey('2026-10-16', 'n3')].articles).toEqual(['r1'])
    expect(
      completeArticle(
        s,
        { attemptId: articleAttempt, level: 'n3', articleId: 'r1', questionIds: ids, resultIds },
        clock(),
      ),
    ).toBe(s)
  })
})
describe('spaced local-calendar vocabulary', () => {
  it('progresses 1/3/7/14/30 then repeats 30, preventing early and same-day advancement', () => {
    let s = defaultState(),
      day = '2026-10-16'
    const key = itemKey(input().ref)
    for (let i = 0; i < 6; i++) {
      s = recordResult(s, input('水', true, `a${i}`), clock(day))
      const schedule = s.schedules[key]
      expect(schedule.stage).toBe(Math.min(i + 1, 5))
      expect(schedule.dueOn).toBe(addDays(day, [1, 3, 7, 14, 30, 30][i]))
      const due = schedule.dueOn
      s = recordResult(s, input('水', true, `same${i}`), clock(day))
      expect(s.schedules[key].dueOn).toBe(due)
      if (i > 0) {
        s = recordResult(s, input('水', true, `early${i}`), clock(addDays(day, 1)))
        expect(s.schedules[key].dueOn).toBe(due)
      }
      day = due
    }
    s = recordResult(s, input('水', false, 'fail'), clock(day))
    s = recordResult(s, input('水', true, 'retry'), clock(day))
    expect(s.schedules[key].stage).toBe(0)
    expect(s.schedules[key].dueOn).toBe(day)
    expect(s.mistakes[key].pending).toBe(false)
  })
  it('uses calendar days over DST and prioritizes a unique max-10 due-only queue', () => {
    const previous = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
      expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
      expect(localDate(new Date('2026-03-09T00:30:00'))).toBe('2026-03-09')
    } finally {
      process.env.TZ = previous
    }
    const items = Array.from({ length: 16 }, (_, i) => ({
      w: String(i),
      r: `音${i}`,
      zh: '字',
      en: 'word',
    }))
    let s = defaultState()
    for (const item of items.slice(0, 15))
      s = recordResult(s, input(item.w, false, item.w), clock())
    const queue = vocabQueue([...items, items[0]], s, 'n3', '2026-10-16', true)
    expect(queue).toHaveLength(10)
    expect(new Set(queue.map((v) => v.w)).size).toBe(10)
    expect(queue.every((v) => v.w !== '15')).toBe(true)
    expect(vocabQueue(items, defaultState(), 'n3', '2026-10-16', true)).toEqual([])
  })
})
describe('fixed tasks and persistence', () => {
  it('counts prior-day matching activity once, fixes unique targets and never completes zero', () => {
    let s = recordResult(defaultState(), input('水', false, 'a'), clock())
    const items = [{ w: '水', r: 'みず', zh: '水', en: 'water' }]
    const group = generateGroup(s, refsFor('vocab', 'n3', items), 'vocab', '2026-10-16')
    const plan = {
      date: '2026-10-16',
      level: 'n3' as const,
      branch: 'reading' as const,
      started: false,
      groups: { vocab: group },
    }
    s.plans[dayKey(plan.date, plan.level)] = plan
    expect(inspectGroup(s, plan, 'vocab', items)).toMatchObject({
      done: 1,
      total: 1,
      correct: 0,
      complete: true,
    })
    expect(inspectGroup(s, plan, 'vocab', items).selected).toEqual([])
    expect(inspectGroup(s, plan, 'grammar', []).complete).toBe(false)
    s = recordResult(s, input('水', true, 'redo'), clock())
    expect(inspectGroup(s, plan, 'vocab', items).done).toBe(1)
    expect(inspectGroup(s, plan, 'vocab', items).correct).toBe(1)
    expect(decodeCode(encodeCode(s))).toEqual(s)
  })
})

describe('掌握只來自讀音測驗；翻卡自評只影響排程', () => {
  const pron = (id: string, correct: boolean, attemptId: string): LearningInput => ({ ...input(id, correct, attemptId), mode: 'pronunciation' })
  const at = clock()
  const flash = (id: string, correct: boolean, attemptId: string): LearningInput => ({ ...input(id, correct, attemptId), mode: 'flashcard' })
  it('讀音測驗答對進 vKnown、答錯進 vLearning 並移出 vKnown', () => {
    let s = recordResult(defaultState(), pron('水', true, 'p1'), at)
    expect(Object.hasOwn(s.vKnown.n3, '水')).toBe(true)
    s = recordResult(s, pron('水', false, 'p2'), at)
    expect(Object.hasOwn(s.vKnown.n3, '水')).toBe(false)
    expect(Object.hasOwn(s.vLearning.n3, '水')).toBe(true)
    s = recordResult(s, pron('水', true, 'p3'), at)
    expect(Object.hasOwn(s.vLearning.n3, '水')).toBe(false)
    expect(Object.hasOwn(s.vKnown.n3, '水')).toBe(true)
  })
  it('翻卡自評不寫 vKnown／vLearning、不進錯題，但照常排程；既有 vKnown 不被改寫', () => {
    const known = recordResult(defaultState(), pron('水', true, 'p1'), at)
    const s = recordResult(known, flash('水', false, 'f1'), at)
    expect(Object.hasOwn(s.vKnown.n3, '水')).toBe(true)
    expect(Object.hasOwn(s.vLearning.n3, '水')).toBe(false)
    expect(Object.keys(s.mistakes)).toEqual([])
    expect(Object.values(s.schedules)[0].stage).toBe(0)
    const r = recordResult(defaultState(), flash('山', true, 'f2'), at)
    expect(Object.hasOwn(r.vKnown.n3, '山')).toBe(false)
    expect(Object.values(r.schedules)[0].stage).toBe(1)
  })
})
