import { LEVELS, type LegacyState, type ProgressState } from './state'
import { validDate } from '../learning/calendar'
import { dayKey, itemKey, taskLimit, type StudyItemRef, type StudyMode } from '../learning/types'
export const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const keys = (v: Record<string, unknown>, required: string[], optional: string[] = []) =>
  required.every((k) => Object.hasOwn(v, k)) &&
  Object.keys(v).every((k) => [...required, ...optional].includes(k))
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const ids = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(text) && new Set(v).size === v.length
const date = (v: unknown) => v === '' || validDate(v)
export const validTimestamp = (v: unknown): v is string =>
  typeof v === 'string' &&
  Number.isFinite(Date.parse(v)) &&
  validDate(v.slice(0, 10)) &&
  new Date(v).toISOString() === v
const level = (v: unknown) => LEVELS.includes(v as (typeof LEVELS)[number])
const modes = ['flashcard', 'pronunciation', 'grammar', 'reading', 'listening']
export function validRef(v: unknown): v is StudyItemRef {
  return (
    object(v) &&
    keys(v, ['level', 'kind', 'id'], ['articleId']) &&
    level(v.level) &&
    ['vocab', 'grammar', 'reading', 'listening'].includes(v.kind as string) &&
    text(v.id) &&
    (v.kind === 'reading' ? text(v.articleId) : !('articleId' in v))
  )
}
export function validMode(ref: StudyItemRef, mode: unknown): mode is StudyMode {
  return (
    modes.includes(mode as string) &&
    (ref.kind === 'vocab'
      ? ['flashcard', 'pronunciation'].includes(mode as string)
      : mode === ref.kind)
  )
}
const legacyKeys = [
  'level',
  'streak',
  'lastDate',
  'vKnown',
  'vLearning',
  'gDone',
  'lDone',
  'lCorrect',
  'rDone',
]
const newKeys = ['results', 'days', 'plans', 'mistakes', 'schedules']
function legacy(v: Record<string, unknown>): boolean {
  if (!level(v.level) || !integer(v.streak) || !date(v.lastDate)) return false
  for (const key of legacyKeys.slice(3)) {
    const map = v[key]
    if (!object(map) || !keys(map, [...LEVELS])) return false
    for (const lv of LEVELS) {
      const values = map[lv]
      if (key === 'vKnown' || key === 'vLearning') {
        if (!object(values) || !Object.entries(values).every(([k, x]) => text(k) && x === true))
          return false
      } else if (!ids(values)) return false
    }
  }
  const s = v as unknown as LegacyState
  return LEVELS.every(
    (lv) =>
      !Object.keys(s.vKnown[lv]).some((w) => Object.hasOwn(s.vLearning[lv], w)) &&
      s.lCorrect[lv].every((id) => s.lDone[lv].includes(id)),
  )
}
export function validateV4(v: unknown): v is LegacyState {
  return object(v) && keys(v, legacyKeys) && legacy(v)
}
const mapEvery = (v: unknown, check: (key: string, value: Record<string, unknown>) => boolean) =>
  object(v) && Object.entries(v).every(([k, x]) => object(x) && check(k, x))
const validItemKey = (key: string, lv: unknown) => {
  try {
    const v = JSON.parse(key)
    return (
      Array.isArray(v) &&
      v.length === 3 &&
      v[0] === lv &&
      ['vocab', 'grammar', 'reading', 'listening'].includes(v[1]) &&
      text(v[2]) &&
      JSON.stringify(v) === key
    )
  } catch {
    return false
  }
}
export function validateV5(v: unknown): v is ProgressState {
  if (!object(v) || !keys(v, [...legacyKeys, ...newKeys]) || !legacy(v)) return false
  if (
    !Array.isArray(v.results) ||
    v.results.length > 2000 ||
    !v.results.every(
      (x) =>
        object(x) &&
        keys(x, ['attemptId', 'ref', 'mode', 'correct', 'at', 'date']) &&
        text(x.attemptId) &&
        validRef(x.ref) &&
        validMode(x.ref, x.mode) &&
        typeof x.correct === 'boolean' &&
        validTimestamp(x.at) &&
        validDate(x.date),
    ) ||
    new Set(v.results.map((x) => x.attemptId)).size !== v.results.length
  )
    return false
  if (
    !mapEvery(
      v.days,
      (k, x) =>
        keys(x, ['date', 'level', 'items', 'correctItems', 'articles', 'articleAttempts']) &&
        validDate(x.date) &&
        level(x.level) &&
        k === dayKey(x.date, x.level as StudyItemRef['level']) &&
        ids(x.items) &&
        x.items.every((i) => validItemKey(i, x.level)) &&
        ids(x.correctItems) &&
        x.correctItems.every((i) => (x.items as string[]).includes(i)) &&
        ids(x.articles) &&
        ids(x.articleAttempts),
    )
  )
    return false
  if (
    !mapEvery(
      v.mistakes,
      (k, x) =>
        keys(x, ['ref', 'wrongCount', 'lastWrongAt', 'lastResultAt', 'pending', 'lastWrongMode']) &&
        validRef(x.ref) &&
        k === itemKey(x.ref) &&
        integer(x.wrongCount) &&
        x.wrongCount > 0 &&
        validTimestamp(x.lastWrongAt) &&
        validTimestamp(x.lastResultAt) &&
        typeof x.pending === 'boolean' &&
        validMode(x.ref, x.lastWrongMode),
    )
  )
    return false
  if (
    !mapEvery(
      v.schedules,
      (k, x) =>
        keys(x, ['ref', 'stage', 'dueOn', 'lastScheduledOn', 'lastResult']) &&
        validRef(x.ref) &&
        x.ref.kind === 'vocab' &&
        k === itemKey(x.ref) &&
        integer(x.stage) &&
        x.stage <= 5 &&
        validDate(x.dueOn) &&
        date(x.lastScheduledOn) &&
        (x.lastResult === null
          ? x.stage === 0 && x.lastScheduledOn === ''
          : typeof x.lastResult === 'boolean' && validDate(x.lastScheduledOn)),
    )
  )
    return false
  if (
    !mapEvery(v.plans, (k, x) => {
      if (
        !keys(x, ['date', 'level', 'branch', 'started', 'groups']) ||
        !validDate(x.date) ||
        !level(x.level) ||
        k !== dayKey(x.date, x.level as StudyItemRef['level']) ||
        !['reading', 'listening'].includes(x.branch as string) ||
        typeof x.started !== 'boolean'
      )
        return false
      return mapEvery(
        x.groups,
        (kind, g) =>
          ['vocab', 'grammar', x.branch].includes(kind) &&
          keys(g, ['status', 'targets', 'note']) &&
          ['ready', 'empty'].includes(g.status as string) &&
          typeof g.note === 'string' &&
          Array.isArray(g.targets) &&
          g.targets.every(
            (r) =>
              validRef(r) &&
              r.level === x.level &&
              r.kind === kind &&
              (kind !== 'reading' || r.articleId === r.id),
          ) &&
          new Set(g.targets.map(itemKey)).size === g.targets.length &&
          g.targets.length <= (taskLimit[kind as StudyItemRef['kind']] ?? 0) &&
          (g.status === 'empty' ? g.targets.length === 0 : g.targets.length > 0),
      )
    })
  )
    return false
  for (const map of [v.days, v.plans]) {
    if (
      !object(map) ||
      new Set(Object.values(map).map((x) => (x as { date: string }).date)).size > 90 ||
      Object.keys(map).length > 450
    )
      return false
  }
  return true
}
