import type { Level } from '../progress/state'
export type StudyKind = 'vocab' | 'grammar' | 'reading' | 'listening'
export const taskLimit = { vocab: 10, grammar: 5, reading: 1, listening: 3 }
export type StudyMode = 'flashcard' | 'pronunciation' | 'grammar' | 'reading' | 'listening'
export interface StudyItemRef {
  level: Level
  kind: StudyKind
  id: string
  articleId?: string
}
export interface LearningInput {
  attemptId: string
  ref: StudyItemRef
  mode: StudyMode
  correct: boolean
}
export interface LearningResult extends LearningInput {
  at: string
  date: string
}
export interface ArticleCompletion {
  attemptId: string
  level: Level
  articleId: string
  questionIds: string[]
  resultIds: string[]
}
export interface DailySummary {
  date: string
  level: Level
  items: string[]
  correctItems: string[]
  articles: string[]
  articleAttempts: string[]
}
export interface Mistake {
  ref: StudyItemRef
  wrongCount: number
  lastWrongAt: string
  lastResultAt: string
  pending: boolean
  lastWrongMode: StudyMode
}
export interface VocabSchedule {
  ref: StudyItemRef
  stage: number
  dueOn: string
  lastScheduledOn: string
  lastResult: boolean | null
}
export type TaskGroup = StudyKind
export interface DailyGroup {
  status: 'ready' | 'empty'
  targets: StudyItemRef[]
  note: string
}
export interface DailyPlan {
  date: string
  level: Level
  branch: 'reading' | 'listening'
  started: boolean
  groups: Partial<Record<TaskGroup, DailyGroup>>
}
export type Clock = () => Date
export const systemClock: Clock = () => new Date()
export const itemKey = (ref: StudyItemRef) => JSON.stringify([ref.level, ref.kind, ref.id])
export const dayKey = (date: string, level: Level) => JSON.stringify([date, level])
let sequence = 0
export function newAttemptId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}-${++sequence}`
}
