// 段位與外觀的顯示名稱（rewards §3.2、§6.1）。
import { RANK_THRESHOLDS, type ChestResult } from '../domain/rewards'
import type { Level } from '../domain/progress/state'

export const RANKS = [
  { name: '白帶', belt: 'white', stripes: 0 },
  { name: '黃帶', belt: 'yellow', stripes: 0 },
  { name: '橙帶', belt: 'orange', stripes: 0 },
  { name: '綠帶', belt: 'green', stripes: 0 },
  { name: '藍帶', belt: 'blue', stripes: 0 },
  { name: '紫帶', belt: 'purple', stripes: 0 },
  { name: '茶帶', belt: 'brown', stripes: 0 },
  { name: '黑帶初段', belt: 'black', stripes: 1 },
  { name: '二段', belt: 'black', stripes: 2 },
  { name: '三段', belt: 'black', stripes: 3 },
] as const

// 目前段位（1–10）與往下一段的進度。
export function rankProgress(xp: number) {
  const rank = RANK_THRESHOLDS.filter((t) => xp >= t).length
  const floor = RANK_THRESHOLDS[rank - 1],
    next = RANK_THRESHOLDS[rank] as number | undefined
  return { rank, info: RANKS[rank - 1], floor, next, toNext: next === undefined ? 0 : next - xp, nextName: next === undefined ? null : RANKS[rank].name }
}

const COSMETIC_NAMES: Record<string, string> = {
  'stamp-hatsugeiko': '初稽古印',
  ...Object.fromEntries(
    ['sakura:桜', 'fuji:富士', 'torii:鳥居', 'take:竹', 'tsuru:鶴', 'tsuki:月', 'kumo:雲', 'nami:波', 'kaede:楓', 'ume:梅', 'ougi:扇', 'suzu:鈴'].map((s) => {
      const [id, n] = s.split(':')
      return [`stamp-${id}`, `${n}印`]
    }),
  ),
  ...Object.fromEntries(
    ['hinoki:檜', 'sugi:杉', 'shikkoku:漆黒', 'aizome:藍染', 'shunuri:朱塗', 'washi:和紙', 'kintsugi:金継ぎ', 'suminagashi:墨流し'].map((s) => {
      const [id, n] = s.split(':')
      return [`frame-${id}`, `${n}札框`]
    }),
  ),
  'theme-spring': '春的道場', 'theme-summer': '夏的道場', 'theme-autumn': '秋的道場', 'theme-winter': '冬的道場',
}

export function chestText(r: ChestResult): { name: string; detail: string } {
  if (r.type === 'firstStamp') return { name: '初稽古印', detail: '第一次修行的記念。收在收集冊的「印章」。' }
  if (r.type === 'protectionCard') return { name: '連勝保護卡', detail: '錯過一天時自動守住連勝。' }
  if (r.type === 'commemorativeStamp') return { name: '記念印', detail: '在修行帳的今天蓋上帶日期的特別印。' }
  const kind = r.id.startsWith('stamp-') ? '印章' : r.id.startsWith('frame-') ? '卡片框' : '道場主題'
  return { name: COSMETIC_NAMES[r.id] ?? r.id, detail: `收在收集冊的「${kind}」。` }
}

export const LEVEL_OPTIONS: ReadonlyArray<{ value: Level; label: string }> = [
  { value: 'n5', label: 'N5' },
  { value: 'n4', label: 'N4' },
  { value: 'n3', label: 'N3' },
  { value: 'n2', label: 'N2' },
  { value: 'n1', label: 'N1' },
]
export const levelName = (l: Level) => l.toUpperCase()
export const KIND_NAMES = { vocab: '單字', grammar: '文法', reading: '讀解', listening: '聽力' } as const
