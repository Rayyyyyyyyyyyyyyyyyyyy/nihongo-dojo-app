// Ported from NHK-N3-1 src/domain/learning/plans.test.ts @ aadd243.
import { defaultState, encodeCode, decodeCode } from '../progress/state'
import { recordResult } from './reducer'
import { inspectGroup, repairGroup } from './plans'
import { type DailyPlan, itemKey } from './types'

it('uses one target inspection for missing items, completion and resuming without changing saved targets', () => {
  const ref = { level: 'n3', kind: 'vocab', id: '水' } as const
  const state = recordResult(
    defaultState(),
    { ref, attemptId: 'water', mode: 'flashcard', correct: false },
    () => new Date('2026-10-16T12:00:00'),
  )
  const plan: DailyPlan = {
    date: '2026-10-16',
    level: 'n3',
    branch: 'reading',
    started: false,
    groups: { vocab: { status: 'ready', targets: [ref, { ...ref, id: 'gone' }], note: '' } },
  }
  state.plans['["2026-10-16","n3"]'] = plan
  const before = encodeCode(state)
  const items = [
    { w: '水', r: 'みず', zh: '水', en: 'water' },
    { w: '__proto__', r: 'あたらしい', zh: '新', en: 'new' },
  ]
  expect(inspectGroup(state, plan, 'vocab')).toMatchObject({
    done: 1,
    total: 2,
    complete: false,
    missing: [],
    selected: [],
  })
  expect(inspectGroup(state, plan, 'vocab', items)).toMatchObject({
    done: 1,
    total: 2,
    correct: 0,
    complete: false,
    missing: [{ ...ref, id: 'gone' }],
    selected: [],
  })
  const repaired = repairGroup(state, plan, 'vocab', items)!
  expect(repaired.targets).toEqual([ref, { ...ref, id: '__proto__' }])
  expect(encodeCode(state)).toBe(before)
  plan.groups.vocab = repaired
  expect(inspectGroup(state, plan, 'vocab', items)).toMatchObject({
    done: 1,
    total: 2,
    complete: false,
    missing: [],
    selected: [items[1]],
  })
  expect(state.days['["2026-10-16","n3"]'].items).toEqual([itemKey(ref)])
  expect(decodeCode(encodeCode(state))).toEqual(state)
  plan.groups.vocab = repairGroup(state, plan, 'vocab', [])
  expect(inspectGroup(state, plan, 'vocab', [])).toMatchObject({
    total: 0,
    complete: false,
    missing: [],
    selected: [],
  })
})

it('counts whole reading articles rather than subquestion activity when inspecting saved targets', () => {
  const state = defaultState()
  const article = {
    id: 'article',
    level: 'n3' as const,
    title: '題',
    type: '文',
    text: '本文',
    notes: [],
    questions: [
      { id: 'rq', q: '問', answer: '正', distractors: ['一', '二', '三'], explanation: '解' },
    ],
  }
  const plan: DailyPlan = {
    date: '2026-10-16',
    level: 'n3',
    branch: 'reading',
    started: true,
    groups: {
      reading: {
        status: 'ready',
        targets: [{ level: 'n3', kind: 'reading', id: article.id, articleId: article.id }],
        note: '',
      },
    },
  }
  state.days['["2026-10-16","n3"]'] = {
    date: plan.date,
    level: plan.level,
    items: [itemKey({ level: 'n3', kind: 'reading', id: 'rq' })],
    correctItems: [],
    articles: [],
    articleAttempts: [],
  }
  expect(inspectGroup(state, plan, 'reading', [article])).toMatchObject({
    done: 0,
    correct: 0,
    complete: false,
    selected: [article],
  })
  state.days['["2026-10-16","n3"]'].articles.push(article.id)
  expect(inspectGroup(state, plan, 'reading', [article])).toMatchObject({
    done: 1,
    correct: 0,
    complete: true,
    selected: [],
  })
  expect(inspectGroup(state, plan, 'reading', [])).toMatchObject({
    done: 0,
    total: 1,
    complete: false,
    missing: plan.groups.reading!.targets,
  })
})
