// 一輪修行的題目（S3／S10／S11）：進入時固定，之後只依作答前進。純函式，畫面與測試共用。
import type { LevelBank } from '../../data/bank'
import type { BankManifest } from '../../domain/bank/manifest'
import type { Listening, Reading, Vocab } from '../../domain/bank/types'
import { DAILY_LIMITS, requiredKinds } from '../../domain/learning/daily'
import { inspectGroup, orderRefs, refsFor } from '../../domain/learning/plans'
import { dayKey, itemKey, type StudyItemRef, type StudyKind } from '../../domain/learning/types'
import type { Level, ProgressState } from '../../domain/progress/state'
import { choiceOptions, stableShuffle } from '../../domain/quiz'
import type { AppStateDoc } from '../../state/doc'

export type VocabMode = 'flashcard' | 'pronunciation'
interface Base {
  key: string
  refs: StudyItemRef[] // 讀解是每個子題一個 ref
}
export type QuizItem =
  | (Base & { type: 'flashcard'; vocab: Vocab })
  | (Base & {
      type: 'choice'
      mode: 'pronunciation' | 'grammar'
      prompt: string
      answer: string
      options: string[]
      explanation: string
      broken: boolean // 缺選項：顯示「這題資料有問題，已跳過」，不計分
    })
  | (Base & { type: 'listening'; item: Listening; options: string[]; broken: boolean })
  | (Base & { type: 'reading'; article: Reading; options: Record<string, string[]> })

const ORDER: StudyKind[] = ['vocab', 'grammar', 'reading', 'listening']
type Item = LevelBank[StudyKind][number]
const idOf = (kind: StudyKind, item: Item) => (kind === 'vocab' ? (item as Vocab).w : (item as { id: string }).id)

function toQuiz(kind: StudyKind, item: Item, level: Level, bank: LevelBank, vmode: VocabMode, seed: string): QuizItem {
  const ref: StudyItemRef = { level, kind, id: idOf(kind, item), ...(kind === 'reading' ? { articleId: idOf(kind, item) } : {}) }
  const key = itemKey(ref),
    s = `${seed}|${key}`
  if (kind === 'vocab') {
    const v = item as Vocab
    if (vmode === 'flashcard') return { type: 'flashcard', key, refs: [ref], vocab: v }
    const pool = stableShuffle([...new Set(bank.vocab.map((x) => x.r))].filter((r) => r !== v.r), s).slice(0, 3)
    const options = choiceOptions({ answer: v.r, distractors: pool }, s)
    return { type: 'choice', mode: 'pronunciation', key, refs: [ref], prompt: v.w, answer: v.r, options, explanation: `${v.w}（${v.r}）：${v.zh}`, broken: options.length < 2 }
  }
  if (kind === 'grammar') {
    const g = item as LevelBank['grammar'][number]
    const options = choiceOptions(g, s)
    return { type: 'choice', mode: 'grammar', key, refs: [ref], prompt: g.q, answer: g.answer, options, explanation: g.explanation, broken: options.length < 2 }
  }
  if (kind === 'listening') {
    const l = item as Listening
    const options = choiceOptions(l, s)
    return { type: 'listening', key, refs: [ref], item: l, options, broken: options.length < 2 }
  }
  const a = item as Reading
  return {
    type: 'reading',
    key,
    article: a,
    refs: a.questions.map((q) => ({ level, kind: 'reading', id: q.id, articleId: a.id })),
    options: Object.fromEntries(a.questions.map((q) => [q.id, choiceOptions(q, `${s}|${q.id}`)])),
  }
}

// 今日任務：今天的 plan 中尚未完成的目標；有失效目標的組列在 missing（先修復再開始）。
export function todayQueue(doc: AppStateDoc, bank: LevelBank, today: string) {
  const level = doc.learning.level,
    plan = doc.learning.plans[dayKey(today, level)]
  if (!plan) return { items: [] as QuizItem[], missing: [] as StudyKind[] }
  const kinds = ORDER.filter((k) => requiredKinds(plan).includes(k))
  const missing: StudyKind[] = [],
    items: QuizItem[] = []
  for (const kind of kinds) {
    const g = inspectGroup(doc.learning, plan, kind, bank[kind] as never[])
    if (g.missing.length) missing.push(kind)
    for (const it of g.selected as Item[]) items.push(toQuiz(kind, it, level, bank, 'flashcard', today))
  }
  return { items, missing }
}

// 加練（app-design §4.1）：同份量的下一組，優先到期→錯題→未學（移植的排序規則），排除今天做過的。
export function extraQueue(doc: AppStateDoc, bank: LevelBank, today: string): { items: QuizItem[] } {
  const level = doc.learning.level,
    plan = doc.learning.plans[dayKey(today, level)],
    day = doc.learning.days[dayKey(today, level)],
    limits = DAILY_LIMITS[doc.settings.dailyMinutes]
  if (!plan) return { items: [] }
  const items: QuizItem[] = []
  for (const kind of ORDER.filter((k) => requiredKinds(plan).includes(k))) {
    const list = bank[kind] as Item[]
    const fresh = orderRefs(doc.learning, refsFor(kind, level, list as never[]), today).filter((r) =>
      kind === 'reading' ? !day?.articles.includes(r.id) : !day?.items.includes(itemKey(r)),
    )
    for (const r of fresh.slice(0, limits[kind])) items.push(toQuiz(kind, list.find((x) => idOf(kind, x) === r.id)!, level, bank, 'flashcard', `${today}|extra`))
  }
  return { items }
}

// S9 複習：本等級到期單字＋待複習錯題；題庫裡找不到的 ID 列為不可用（保留紀錄，不刪除）。
export function reviewQueue(doc: AppStateDoc, bank: LevelBank, today: string) {
  const level = doc.learning.level,
    s = doc.learning
  const refs = new Map<string, StudyItemRef>()
  for (const sc of Object.values(s.schedules)) if (sc.ref.level === level && sc.dueOn <= today) refs.set(itemKey(sc.ref), sc.ref)
  for (const m of Object.values(s.mistakes)) if (m.ref.level === level && m.pending) refs.set(itemKey(m.ref), m.ref)
  const items: QuizItem[] = [],
    unavailable: StudyItemRef[] = []
  for (const ref of orderRefs(s, [...refs.values()], today)) {
    if (ref.kind === 'reading') {
      const article = bank.reading.find((a) => a.id === ref.articleId),
        q = article?.questions.find((x) => x.id === ref.id)
      if (!article || !q) unavailable.push(ref)
      // 讀解錯題只重做該子題，文章一併顯示。
      else items.push({ ...(toQuiz('reading', { ...article, questions: [q] }, level, bank, 'flashcard', today) as QuizItem), key: itemKey(ref) })
      continue
    }
    const it = (bank[ref.kind] as Item[]).find((x) => idOf(ref.kind, x) === ref.id)
    if (!it) unavailable.push(ref)
    else items.push(toQuiz(ref.kind, it, level, bank, ref.kind === 'vocab' && s.schedules[itemKey(ref)] ? 'pronunciation' : 'flashcard', today))
  }
  return { items, unavailable }
}

// S7／S8 的課：依 manifest 的課表取題（只取題庫裡存在的）。
export function lessonQueue(
  bank: LevelBank,
  manifest: BankManifest,
  level: Level,
  kind: StudyKind,
  lessonNo: number,
  vmode: VocabMode,
  today: string,
): QuizItem[] {
  const ids = manifest.levels[level].lessons[kind].find((l) => l.lessonNo === lessonNo)?.itemIds ?? []
  const list = bank[kind] as Item[]
  return ids.flatMap((id) => {
    const it = list.find((x) => idOf(kind, x) === id)
    return it ? [toQuiz(kind, it, level, bank, vmode, `${today}|lesson`)] : []
  })
}

// 讀解續做（app-design S11）：今天這篇已有子題提交、但整篇還沒完成的 attempt。
export function readingResume(s: ProgressState, level: Level, articleId: string, today: string) {
  const done = s.days[dayKey(today, level)]?.articleAttempts ?? []
  let attemptId: string | null = null
  const answered: string[] = []
  for (const r of s.results) {
    if (r.date !== today || r.mode !== 'reading' || r.ref.articleId !== articleId || !r.attemptId.startsWith('[')) continue
    const [id] = JSON.parse(r.attemptId) as [string, string]
    if (done.includes(id)) continue
    if (attemptId !== id) answered.length = 0
    attemptId = id
    answered.push(r.ref.id)
  }
  return attemptId ? { attemptId, answered } : null
}
