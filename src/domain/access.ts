// 鎖定判定（handoff §2.3、app-design §5.1）：N5/N4 全開；N3–N1 第 1 課免費；第一天點鎖定課只開說明（S14a）。
import type { LevelManifest } from './bank/manifest'
import type { BankKind, Banks } from './bank/types'

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
