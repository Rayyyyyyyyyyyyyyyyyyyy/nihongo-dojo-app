// AppStateDoc 的交易：每個函式回傳完整 next doc，由 store 一次寫入（handoff §2.2「單一擁有者」）。
import type { LevelBank } from '../data/bank'
import { accessibleBank } from '../domain/access'
import type { BankManifest } from '../domain/bank/manifest'
import { addDays, localDate } from '../domain/learning/calendar'
import { DAILY_LIMITS, planBranch, planKinds, requiredKinds } from '../domain/learning/daily'
import { generateGroup, inspectGroup, refsFor, repairGroup } from '../domain/learning/plans'
import { completeArticle, pruneDays, recordResult } from '../domain/learning/reducer'
import {
  dayKey,
  itemKey,
  type ArticleCompletion,
  type Clock,
  type LearningInput,
  type StudyKind,
} from '../domain/learning/types'
import { cloneState, LEVELS, type Level, type ProgressState } from '../domain/progress/state'
import { ignoredCountOnOpen, reminderTimes } from '../domain/reminder'
import {
  applyAnswer,
  applyProtection,
  celebrateRanks,
  isGapProtected,
  mergeImport,
  openChest as drawChest,
  recordGoalCompleted,
  type ChestResult,
  type ImportedItem,
  type LearningEvent,
  type LocalDate,
  type RewardState,
} from '../domain/rewards'
import type { AppStateDoc, PortableDoc } from './doc'

export interface AnswerOutcome {
  xp: 0 | 3 | 10 | 15
  ceremony: { rank: number; passed: number[] } | null // S6 升段儀式
  goalCompleted: boolean // 這次提交讓今日目標完成：S4 蓋印、寶箱可開
  protectedNow: LocalDate[] // 這次由保護卡守住的日子
}

// 今日任務完成：今天的 plan 每組都已建好，ready 的組全部有效完成（沿用 inspectGroup 的完成判定）。
export function isGoalComplete(learning: ProgressState, date: LocalDate, bank: LevelBank): boolean {
  const plan = learning.plans[dayKey(date, learning.level)]
  if (!plan) return false
  const groups = requiredKinds(plan).map((k) => [k, plan.groups[k]] as const)
  if (groups.some(([, g]) => !g)) return false
  const ready = groups.filter(([, g]) => g!.status === 'ready')
  return (
    ready.length > 0 &&
    ready.every(([k]) => inspectGroup(learning, plan, k, bank[k] as never[]).complete)
  )
}

// 上次學習日到今天有完整錯過的日子時，自動用保護卡（rewards §4.2；冪等）。
function protect(rewards: RewardState, lastDate: string, today: LocalDate) {
  return lastDate && lastDate < today ? applyProtection(rewards, { lastStudyDate: lastDate, today }) : { state: rewards, protectedNow: [] }
}

function finish(
  doc: AppStateDoc,
  learning: ProgressState,
  rewards: RewardState,
  today: LocalDate,
  bank: LevelBank | undefined,
) {
  const goalCompleted =
    !!bank && !rewards.goalCompletedDates.includes(today) && isGoalComplete(learning, today, bank)
  if (goalCompleted) rewards = recordGoalCompleted(rewards, today)
  const { state, ceremony } = celebrateRanks(rewards)
  return { doc: { ...doc, learning, rewards: state }, goalCompleted, ceremony }
}

// 一次有效作答：學習規則 recordResult → 由排程前後算出 isDue／stage → 獎賞 applyAnswer；
// 同一交易內處理保護卡、連勝、今日目標與升段。無效或重複的提交（學習規則不收）回傳 outcome null。
export function submitAnswer(
  doc: AppStateDoc,
  input: LearningInput,
  clock: Clock,
  bank?: LevelBank,
): { doc: AppStateDoc; outcome: AnswerOutcome | null } {
  const prev = doc.learning
  const after = recordResult(prev, input, clock)
  if (after === prev) return { doc, outcome: null }
  const today = localDate(clock()),
    key = itemKey(input.ref)

  const p = protect(doc.rewards, prev.lastDate, today)
  let learning = after
  // touchStreak 遇到空白會重設為 1；空白全被保護卡守住時連勝延續。
  if (prev.lastDate && addDays(prev.lastDate, 1) < today && isGapProtected(p.state, prev.lastDate, today))
    learning = { ...after, streak: prev.streak + 1 }

  const before = prev.schedules[key],
    vocab = input.ref.kind === 'vocab'
  const event: LearningEvent = {
    key,
    kind: input.ref.kind,
    correct: input.correct,
    date: today,
    isDue: vocab && !!before && before.dueOn <= today,
    stageBefore: vocab ? (before?.stage ?? null) : null,
    stageAfter: vocab ? learning.schedules[key].stage : null,
  }
  const { state: rewards, xp } = applyAnswer(p.state, event)
  const r = finish(doc, learning, rewards, today, bank)
  return { doc: r.doc, outcome: { xp, ceremony: r.ceremony, goalCompleted: r.goalCompleted, protectedNow: p.protectedNow } }
}

// 讀解整篇完成（子題已各自經 submitAnswer 提交）；可能讓今日目標完成。
export function completeReading(doc: AppStateDoc, input: ArticleCompletion, clock: Clock, bank: LevelBank) {
  const learning = completeArticle(doc.learning, input, clock)
  if (learning === doc.learning) return { doc, goalCompleted: false }
  const r = finish(doc, learning, doc.rewards, localDate(clock()), bank)
  return { doc: r.doc, goalCompleted: r.goalCompleted }
}

// 今日任務、修復與加練只從可用的課取題（未購 N3–N1 只有第 1 課，D16）。
export const studyBank = (doc: AppStateDoc, bank: LevelBank, manifest: BankManifest) =>
  accessibleBank(bank, manifest.levels[doc.learning.level], doc.entitlement.owned)

// 建立或補齊今天的任務（移植網頁版 buildPlan，題庫同步載入）；份量依每日分鐘數（handoff §2.5）。
// 已開始的深入練習不換分支；已排好的任務當天不因改分鐘數而變動。
export function ensurePlan(
  doc: AppStateDoc,
  branch: 'reading' | 'listening',
  clock: Clock,
  bank: LevelBank,
  manifest: BankManifest,
): AppStateDoc {
  const date = localDate(clock()),
    level = doc.learning.level,
    key = dayKey(date, level),
    old = doc.learning.plans[key],
    minutes = doc.settings.dailyMinutes
  const want = old?.started ? old.branch : planBranch(minutes, branch)
  if (old && old.branch === want && requiredKinds(old).every((k) => old.groups[k])) return doc
  const next = cloneState(doc.learning),
    pool = studyBank(doc, bank, manifest)
  pruneDays(next, date)
  const plan = (next.plans[key] ??= { date, level, branch: want, started: false, groups: {} })
  if (plan.branch !== want) {
    delete plan.groups[plan.branch]
    plan.branch = want
  }
  for (const kind of planKinds(minutes, want))
    plan.groups[kind] ??= generateGroup(next, refsFor(kind, level, pool[kind] as never[]), kind, date, DAILY_LIMITS[minutes][kind])
  return { ...doc, learning: next }
}

// 今日任務的失效目標修復（移植網頁版 repairPlan）：只換掉題庫裡已不存在（或已不可用）的目標，原有效目標與完成量保留。
export function repairPlan(doc: AppStateDoc, kind: StudyKind, clock: Clock, bank: LevelBank, manifest: BankManifest): AppStateDoc {
  const key = dayKey(localDate(clock()), doc.learning.level),
    plan = doc.learning.plans[key]
  if (!plan?.groups[kind]) return doc
  const next = cloneState(doc.learning)
  next.plans[key].groups[kind] = repairGroup(next, next.plans[key], kind, studyBank(doc, bank, manifest)[kind] as never[])
  return { ...doc, learning: next }
}

// S8 手動標記已掌握／取消（移植網頁版 markVocab）：不是有效作答，不給 XP、不算連勝。
export function markVocab(doc: AppStateDoc, level: Level, word: string, known: boolean): AppStateDoc {
  const next = cloneState(doc.learning)
  delete next[known ? 'vLearning' : 'vKnown'][level][word]
  Object.defineProperty(next[known ? 'vKnown' : 'vLearning'][level], word, { value: true, enumerable: true, configurable: true, writable: true })
  return { ...doc, learning: next }
}

// 開始深入練習後鎖定今天的分支（網頁版 startPlan）。
export function startPlan(doc: AppStateDoc, clock: Clock): AppStateDoc {
  const key = dayKey(localDate(clock()), doc.learning.level),
    plan = doc.learning.plans[key]
  if (!plan || plan.started) return doc
  const next = cloneState(doc.learning)
  next.plans[key].started = true
  return { ...doc, learning: next }
}

export function openChest(doc: AppStateDoc, clock: Clock): { doc: AppStateDoc; result: ChestResult } | null {
  const r = drawChest(doc.rewards, { installId: doc.meta.installId, date: localDate(clock()) })
  return r && { doc: { ...doc, rewards: r.state }, result: r.result }
}

// 畫面顯示用的連勝：上次學習日之後的空白沒被保護卡守住就是 0（下一次提交時學習規則重設為 1）。
export function currentStreak(doc: Pick<AppStateDoc, 'learning' | 'rewards'>, today: LocalDate): number {
  const { lastDate, streak } = doc.learning
  if (!lastDate) return 0
  return lastDate >= today || isGapProtected(doc.rewards, lastDate, today) ? streak : 0
}

// 新的一天第一次進前景（或啟動）：先用上次開啟時的狀態結算提醒回應，再用保護卡、記錄開啟日。
export function refreshDay(doc: AppStateDoc, clock: Clock): { doc: AppStateDoc; protectedNow: LocalDate[] } {
  const now = clock(),
    today = localDate(now),
    r = doc.settings.reminder
  const ignoredCount = ignoredCountOnOpen(
    { ...r, streak: currentStreak(doc, r.lastAppOpen), lastAppOpen: r.lastAppOpen },
    today,
    now,
  )
  const p = protect(doc.rewards, doc.learning.lastDate, today)
  if (!p.protectedNow.length && ignoredCount === r.ignoredCount && r.lastAppOpen === today) return { doc, protectedNow: [] }
  return {
    doc: {
      ...doc,
      rewards: p.state,
      settings: { ...doc.settings, reminder: { ...r, ignoredCount, lastAppOpen: today > r.lastAppOpen ? today : r.lastAppOpen } },
    },
    protectedNow: p.protectedNow,
  }
}

// 現在應排的本機提醒（交給 notifications 服務重排）。
export function plannedReminders(doc: AppStateDoc, clock: Clock): Date[] {
  const now = clock(),
    today = localDate(now)
  return reminderTimes({
    ...doc.settings.reminder,
    streak: currentStreak(doc, today),
    practicedToday: doc.learning.lastDate === today,
    today,
    now,
  })
}

// S18：第一次完成今日任務後才提供提醒說明卡（之後才請求系統權限）；「之後再說」三天內不再出現。
export const shouldOfferReminder = (doc: AppStateDoc, today: LocalDate) =>
  doc.rewards.goalCompletedDates.length > 0 &&
  !doc.settings.reminder.enabled &&
  (doc.settings.reminder.askAfter === null || today >= doc.settings.reminder.askAfter)

// v5 匯入時每個有答對紀錄的 key（handoff §2.4）：已掌握、排程 stage ≥1、或結果中有答對。
// 讀解的 rDone 是文章 ID、不是子題 key；子題的答對只從 results 取得（results 最多 2000 筆）。
export function importedItems(s: ProgressState): ImportedItem[] {
  const correct = new Set<string>()
  for (const r of s.results) if (r.correct) correct.add(itemKey(r.ref))
  for (const level of LEVELS) {
    for (const id of Object.keys(s.vKnown[level])) correct.add(itemKey({ level, kind: 'vocab', id }))
    for (const id of s.gDone[level]) correct.add(itemKey({ level, kind: 'grammar', id }))
    for (const id of s.lCorrect[level]) correct.add(itemKey({ level, kind: 'listening', id }))
  }
  for (const [key, sc] of Object.entries(s.schedules)) if (sc.stage >= 1) correct.add(key)
  return [...correct].map((key) => ({ key, hasCorrect: true, stage: s.schedules[key]?.stage ?? null }))
}

// v5 匯入：只覆寫 learning；rewards 合併防重領並設保護卡基線；settings、meta、entitlement 不動。
export function applyImport(doc: AppStateDoc, learning: ProgressState, today: LocalDate): AppStateDoc {
  return { ...doc, learning, rewards: mergeImport(doc.rewards, importedItems(learning), today) }
}

// 恢復快照或 iCloud 還原：套回完整文件（購買狀態沿用當前），保護卡基線設為當天（rewards §4.2）。
export function applyRestore(doc: AppStateDoc, restored: PortableDoc, today: LocalDate): AppStateDoc {
  return {
    ...restored,
    rewards: { ...restored.rewards, protectionBaselineDate: today },
    entitlement: doc.entitlement,
  }
}
