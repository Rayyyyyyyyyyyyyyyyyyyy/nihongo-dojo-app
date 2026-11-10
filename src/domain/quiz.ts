// 題目呈現規則（純函式）：選項穩定打亂、聽力朗讀文字、程度測驗建議等級。
import type { Question } from './bank/types'
import { LEVELS, type Level } from './progress/state'

// FNV-1a 雜湊 + mulberry32：同 seed 得到同一串亂數（畫面重繪、續做時選項順序不變）。
function rng(seed: string): () => number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items],
    rand = rng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const choiceOptions = (q: Pick<Question, 'answer' | 'distractors'>, seed: string): string[] =>
  stableShuffle([...new Set([q.answer, ...q.distractors])], seed)

// 朗讀前移除句首或句號後的說話者標籤（「男：」「店員：」，只含漢字／片假名）；畫面上的文字稿保留原文。
const SPEAKER = /(^|[。！？\s」])[\u4E00-\u9FFF\u30A0-\u30FF]{1,6}[：:]/g
export const speechText = (script: string): string => script.replace(SPEAKER, '$1')

// O5：每級出 3 題（N5→N1），建議第一個答對少於 2 題的等級；中途略過時，作答過的等級都達標就建議下一個沒測到的等級；全部達標建議 N1。全部略過回傳 null。
export function suggestLevel(answers: Array<{ level: Level; correct: boolean }>): Level | null {
  if (!answers.length) return null
  for (const level of LEVELS) {
    const mine = answers.filter((a) => a.level === level)
    if (!mine.length || mine.filter((a) => a.correct).length < 2) return level
  }
  return 'n1'
}
