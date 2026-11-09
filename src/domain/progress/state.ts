import type {
  LearningResult,
  DailySummary,
  DailyPlan,
  Mistake,
  VocabSchedule,
} from '../learning/types'
import { localDate, addDays } from '../learning/calendar'
import { validateV4, validateV5 } from './validation'
import { upgradeV4 } from './upgrade'
export const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'] as const
export type Level = (typeof LEVELS)[number]
export type LevelMap<T> = Record<Level, T>
export interface LegacyState {
  level: Level
  streak: number
  lastDate: string
  vKnown: LevelMap<Record<string, true>>
  vLearning: LevelMap<Record<string, true>>
  gDone: LevelMap<string[]>
  lDone: LevelMap<string[]>
  lCorrect: LevelMap<string[]>
  rDone: LevelMap<string[]>
}
export interface ProgressState extends LegacyState {
  results: LearningResult[]
  days: Record<string, DailySummary>
  plans: Record<string, DailyPlan>
  mistakes: Record<string, Mistake>
  schedules: Record<string, VocabSchedule>
}
export const mapLevels = <T>(make: (level: Level) => T): LevelMap<T> =>
  Object.fromEntries(LEVELS.map((lv) => [lv, make(lv)])) as LevelMap<T>
export function defaultState(): ProgressState {
  return {
    results: [],
    days: {},
    plans: {},
    mistakes: {},
    schedules: {},
    level: 'n5',
    streak: 0,
    lastDate: '',
    vKnown: mapLevels(() => ({})),
    vLearning: mapLevels(() => ({})),
    gDone: mapLevels(() => []),
    lDone: mapLevels(() => []),
    lCorrect: mapLevels(() => []),
    rDone: mapLevels(() => []),
  }
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const PROGRESS_KEYS = ['vKnown', 'vLearning', 'gDone', 'lDone', 'lCorrect', 'rDone'] as const
// Untrusted payloads must pass complete validation; normalization is only for trusted internals.
export const isProgressPayload = (v: unknown) => validateV4(v) || validateV5(v)
export function normalize(value: unknown): ProgressState {
  const s = defaultState(),
    p = object(value) ? value : {}
  if (LEVELS.includes(p.level as Level)) s.level = p.level as Level
  if (typeof p.streak === 'number' && Number.isFinite(p.streak) && p.streak >= 0)
    s.streak = Math.floor(p.streak)
  if (typeof p.lastDate === 'string') s.lastDate = p.lastDate
  for (const lv of LEVELS) {
    for (const key of ['vKnown', 'vLearning'] as const) {
      const levels = p[key],
        words = object(levels) ? levels[lv] : undefined
      if (object(words))
        s[key][lv] = Object.fromEntries(
          Object.entries(words)
            .filter(([, v]) => v === true)
            .map(([key]) => [key, true as const]),
        )
    }
    for (const key of ['gDone', 'lDone', 'lCorrect', 'rDone'] as const) {
      const levels = p[key],
        ids = object(levels) ? levels[lv] : undefined
      if (Array.isArray(ids)) s[key][lv] = ids.filter((id): id is string => typeof id === 'string')
    }
  }
  if (validateV5(value)) return JSON.parse(JSON.stringify(value))
  return s
}
export function encodeCode(state: ProgressState): string {
  return btoa(encodeURIComponent(JSON.stringify({ version: 5, state })))
}
export function decodeCode(code: string, today = localDate()): ProgressState {
  let p: unknown
  try {
    p = JSON.parse(decodeURIComponent(atob(code.trim())))
  } catch {
    throw Error('進度碼無法解碼，請確認內容完整。')
  }
  if (!object(p) || ![4, 5].includes(p.version as number))
    throw Error('不支援此版本的進度碼；僅支援 v4／v5。')
  if (Object.keys(p).length !== 2 || !('state' in p))
    throw Error('進度碼欄位不完整或包含未知欄位。')
  if (p.version === 4 && validateV4(p.state)) return upgradeV4(p.state, today)
  if (p.version === 5 && validateV5(p.state)) return JSON.parse(JSON.stringify(p.state))
  throw Error('這不是有效的道場進度碼：欄位、日期或進度一致性錯誤。')
}
export const todayString = localDate
export function touchStreak(s: ProgressState, today = localDate()): void {
  if (s.lastDate >= today) return
  s.streak = s.lastDate && addDays(s.lastDate, 1) === today ? s.streak + 1 : 1
  s.lastDate = today
}
export const cloneState = (s: ProgressState): ProgressState => JSON.parse(JSON.stringify(s))
