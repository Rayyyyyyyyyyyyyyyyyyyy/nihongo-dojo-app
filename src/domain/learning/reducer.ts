import { cloneState, touchStreak, type ProgressState } from '../progress/state'
import { validRef, validMode } from '../progress/validation'
import { localDate, addDays } from './calendar'
import {
  itemKey,
  dayKey,
  systemClock,
  type Clock,
  type LearningInput,
  type ArticleCompletion,
  type VocabSchedule,
} from './types'
const put = (items: string[], id: string) => {
  if (!items.includes(id)) items.push(id)
}
function summary(state: ProgressState, date: string, level: LearningInput['ref']['level']) {
  const key = dayKey(date, level)
  return (state.days[key] ??= {
    date,
    level,
    items: [],
    correctItems: [],
    articles: [],
    articleAttempts: [],
  })
}
export function pruneDays(state: ProgressState, today: string) {
  const oldest = addDays(today, -89)
  for (const map of [state.days, state.plans])
    for (const [key, value] of Object.entries(map)) if (value.date < oldest) delete map[key]
  // Clock rollback can create future dates. Keep the most recent 90 distinct dates bounded too.
  for (const map of [state.days, state.plans]) {
    const dates = [...new Set(Object.values(map).map((x) => x.date))].sort().slice(-90)
    for (const [key, value] of Object.entries(map)) if (!dates.includes(value.date)) delete map[key]
  }
}
export function scheduleResult(
  previous: VocabSchedule | undefined,
  input: LearningInput,
  today: string,
): VocabSchedule {
  const schedule = previous
    ? { ...previous }
    : { ref: input.ref, stage: 0, dueOn: today, lastScheduledOn: '', lastResult: null }
  schedule.lastResult = input.correct
  if (!input.correct) {
    schedule.stage = 0
    schedule.dueOn = today
    schedule.lastScheduledOn = today
  } else if (schedule.lastScheduledOn !== today && schedule.dueOn <= today) {
    schedule.stage = Math.min(5, schedule.stage + 1)
    schedule.dueOn = addDays(today, [0, 1, 3, 7, 14, 30][schedule.stage])
    schedule.lastScheduledOn = today
  }
  if (input.correct && schedule.lastScheduledOn !== today) schedule.lastScheduledOn = today
  return schedule
}
export function recordResult(
  state: ProgressState,
  input: LearningInput,
  clock: Clock = systemClock,
): ProgressState {
  if (
    !input.attemptId?.trim() ||
    !validRef(input.ref) ||
    !validMode(input.ref, input.mode) ||
    typeof input.correct !== 'boolean'
  )
    return state
  if (state.results.some((x) => x.attemptId === input.attemptId)) return state
  const now = clock(),
    date = localDate(now),
    next = cloneState(state)
  const result = { ...input, at: now.toISOString(), date },
    { level, kind, id } = input.ref,
    key = itemKey(input.ref)
  next.results.push(result)
  next.results = next.results.slice(-2000)
  if (kind === 'vocab' && input.mode === 'flashcard') {
    delete next[input.correct ? 'vLearning' : 'vKnown'][level][id]
    Object.defineProperty(next[input.correct ? 'vKnown' : 'vLearning'][level], id, {
      value: true,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  if (kind === 'grammar') {
    next.gDone[level] = next.gDone[level].filter((x) => x !== id)
    if (input.correct) put(next.gDone[level], id)
  }
  if (kind === 'listening') {
    put(next.lDone[level], id)
    next.lCorrect[level] = next.lCorrect[level].filter((x) => x !== id)
    if (input.correct) put(next.lCorrect[level], id)
  }
  const old = next.mistakes[key]
  if (!input.correct)
    next.mistakes[key] = {
      ref: input.ref,
      wrongCount: (old?.wrongCount ?? 0) + 1,
      lastWrongAt: result.at,
      lastResultAt: result.at,
      pending: true,
      lastWrongMode: input.mode,
    }
  else if (old) {
    old.pending = false
    old.lastResultAt = result.at
  }
  if (kind === 'vocab') next.schedules[key] = scheduleResult(next.schedules[key], input, date)
  const day = summary(next, date, level)
  put(day.items, key)
  day.correctItems = day.correctItems.filter((x) => x !== key)
  if (input.correct) put(day.correctItems, key)
  touchStreak(next, date)
  pruneDays(next, date)
  return next
}
export function completeArticle(
  state: ProgressState,
  input: ArticleCompletion,
  clock: Clock = systemClock,
): ProgressState {
  if (
    !input.attemptId ||
    !input.questionIds.length ||
    new Set(input.questionIds).size !== input.questionIds.length ||
    input.resultIds.length !== input.questionIds.length ||
    new Set(input.resultIds).size !== input.resultIds.length
  )
    return state
  const results = input.resultIds.map((id) => state.results.find((r) => r.attemptId === id))
  if (
    !results.every(
      (r, i) =>
        r &&
        r.mode === 'reading' &&
        r.ref.level === input.level &&
        r.ref.articleId === input.articleId &&
        r.ref.id === input.questionIds[i] &&
        r.attemptId === JSON.stringify([input.attemptId, input.questionIds[i]]),
    )
  )
    return state
  const date = localDate(clock()),
    key = dayKey(date, input.level)
  if (state.days[key]?.articleAttempts.includes(input.attemptId)) return state
  const next = cloneState(state)
  // A whole-article attempt may span midnight; completion belongs to the final submission day.
  const day = summary(next, date, input.level)
  put(day.articles, input.articleId)
  put(day.articleAttempts, input.attemptId)
  if (results.every((r) => r!.correct)) put(next.rDone[input.level], input.articleId)
  pruneDays(next, date)
  return next
}
