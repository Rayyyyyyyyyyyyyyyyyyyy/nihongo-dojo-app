// 鎖定判定（handoff §2.3、app-design §5.1）：N5/N4 全開；N3–N1 第 1 課免費；第一天點鎖定課只開說明（S14a）。
import type { LevelManifest } from './bank/manifest'
import type { BankKind, Banks } from './bank/types'
import type { StudyItemRef } from './learning/types'

export type LessonAccess = 'open' | 'explainOnly' | 'paywall'

const isOpen = (free: LevelManifest['free'], lessonNo: number, owned: boolean) => free === 'all' || lessonNo <= 1 || owned

export function lessonAccess(a: {
  free: LevelManifest['free']
  lessonNo: number
  owned: boolean
  today: string
  firstOpenDate: string
}): LessonAccess {
  if (isOpen(a.free, a.lessonNo, a.owned)) return 'open'
  return a.today === a.firstOpenDate ? 'explainOnly' : 'paywall'
}

// 今日任務與加練可用的題目：只留開放課的 itemIds（未購 N3–N1 只剩第 1 課）；全開時原樣回傳。
export function accessibleBank<B extends { [K in BankKind]: Banks[K][] }>(bank: B, m: LevelManifest, owned: boolean): B {
  if (m.lessons.vocab.concat(m.lessons.grammar, m.lessons.reading, m.lessons.listening).every((l) => isOpen(m.free, l.lessonNo, owned)))
    return bank
  const ids = (kind: BankKind) =>
    new Set(m.lessons[kind].filter((l) => isOpen(m.free, l.lessonNo, owned)).flatMap((l) => l.itemIds))
  const vocab = ids('vocab'),
    grammar = ids('grammar'),
    reading = ids('reading'),
    listening = ids('listening')
  return {
    ...bank,
    vocab: bank.vocab.filter((x) => vocab.has(x.w)),
    grammar: bank.grammar.filter((x) => grammar.has(x.id)),
    reading: bank.reading.filter((x) => reading.has(x.id)),
    listening: bank.listening.filter((x) => listening.has(x.id)),
  }
}

// 單一紀錄是否在開放課內（複習計數、徽章用；與 accessibleBank 同一規則）。讀解以文章 ID 判定。
export function refAccessible(ref: StudyItemRef, m: LevelManifest, owned: boolean): boolean {
  const id = ref.kind === 'reading' ? ref.articleId : ref.id
  const lesson = m.lessons[ref.kind].find((l) => l.itemIds.includes(id as string))
  // 不在課表裡的 ID（退役、題庫更新）不算鎖定，交給「不可用」處理。
  return !lesson || isOpen(m.free, lesson.lessonNo, owned)
}
