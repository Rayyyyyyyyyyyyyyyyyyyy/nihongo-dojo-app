// handoff §4.1「策略不可刷」在接線後重驗：與 src/domain/rewards/property.test.ts 同一個窮舉思路，
// 但每一次作答都走 submitAnswer（實際移植的 recordResult／scheduleResult 算出 isDue 與 stage），
// 匯入路徑走 encodeCode → importWebV5Code → applyImport（mergeImport）。
import { addDays, localDate } from '../domain/learning/calendar'
import { itemKey, type LearningInput } from '../domain/learning/types'
import { importWebV5Code } from '../domain/progress/importCode'
import { encodeCode } from '../domain/progress/state'
import { daysBetween } from '../domain/rewards/dates'
import { applyImport, importedItems, submitAnswer } from './core'
import { createDoc, type AppStateDoc } from './doc'

// 誠實最佳（每天只能「不練」或「答對」），由參考模型 design/tools/xp_strategy_check.py（v2）算出；
// 與 src/domain/rewards/property.test.ts 的常數相同，作為獨立對照。
const HONEST_VOCAB = [10, 25, 28, 31, 46, 49, 52, 55, 58, 61, 64, 79, 82, 85, 88, 91, 94, 97, 100, 103, 106, 109, 112,
  115, 118, 133, 136, 139, 142, 145, 148, 151, 154, 157, 160, 163, 166, 169, 172, 175, 178, 181, 184, 187, 190, 193, 196,
  199, 202, 205, 208, 211, 214, 217, 220, 235, 238, 241, 244, 247]
const HONEST_NON_VOCAB = Array.from({ length: 60 }, (_, i) => 10 + 3 * i)
const HORIZON = 60
const START = '2026-11-01'
const ANSWERS = ['', 'C', 'W', 'CW', 'WC']
// F／f：翻卡自評記得／還不熟（只影響排程、0 XP）。已知缺口：加入 'fC'（先翻卡還不熟、同日再讀音答對）最佳 XP 會高出誠實最佳（例：第 28 天 40 對 28），尚未處理，故不列入。
const WITH_FLASH = [...ANSWERS, 'F', 'f', 'FC', 'CF', 'Cf']

type Kind = 'vocab' | 'grammar'
// snap：某天作答後匯出的 v5 碼，解碼一次後保留（之後每天都可以重新匯入這份舊碼）
interface Snap { learning: AppStateDoc['learning']; canon: unknown }
interface Node { doc: AppStateDoc; snap: Snap | null; acc: number }

const clockOn = (day: string) => () => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

const sched = (s: AppStateDoc['learning'], key: string, date: string) => {
  const sc = s.schedules[key]
  return sc ? [sc.stage, Math.max(0, daysBetween(date, sc.dueOn))] : null
}

function canon(n: Node, key: string, date: string): string {
  const rs = n.doc.rewards
  const max = rs.maxStage[key] ?? 0,
    last = rs.lastMaintenancePaid[key]
  return JSON.stringify([
    rs.firstCorrectPaid.includes(key),
    max,
    last === undefined || max < 5 ? -1 : Math.min(30, daysBetween(last, date)),
    sched(n.doc.learning, key, date),
    n.snap && [sched(n.snap.learning, key, date), n.snap.canon],
  ])
}

function bestByHorizon(kind: Kind, answers: string[], withImport: boolean): number[] {
  const ref = { level: 'n3', kind, id: 'x' } as const,
    key = itemKey(ref)
  let seq = 0
  let frontier = new Map<string, Node>([['start', { doc: createDoc('i', clockOn(START)), snap: null, acc: 0 }]])
  const best: number[] = []
  for (let day = 0; day < HORIZON; day++) {
    const date = addDays(START, day),
      clock = clockOn(date),
      next = new Map<string, Node>()
    expect(localDate(clock())).toBe(date)
    for (const n of frontier.values()) {
      const starts: Node[] = [n]
      if (withImport && n.snap) starts.push({ ...n, doc: applyImport(n.doc, n.snap.learning, date) })
      for (const s of starts) {
        for (const a of answers) {
          let doc = s.doc,
            xp = 0
          for (const c of a) {
            const input: LearningInput = { attemptId: `t${++seq}`, ref, mode: c === 'F' || c === 'f' ? 'flashcard' : kind === 'vocab' ? 'pronunciation' : 'grammar', correct: c === 'C' || c === 'F' }
            const r = submitAnswer(doc, input, clock)
            doc = r.doc
            xp += r.outcome!.xp
          }
          // 只保留影響之後計分的資料，避免每步複製 60 天的紀錄；連勝與保護卡不進入 XP 計算
          // （applyAnswer 不讀它們），清掉 lastDate 免得每次提交都逐日掃描很長的空白。
          doc = {
            ...doc,
            rewards: { ...doc.rewards, xpByDay: {} },
            learning: { ...doc.learning, results: doc.learning.results.slice(-4), days: {}, lastDate: '', streak: 0 },
          }
          const outs: Node[] = [{ doc, snap: s.snap, acc: s.acc + xp }]
          if (withImport && !s.snap) {
            const learning = importWebV5Code(encodeCode(doc.learning))
            outs.push({ doc, snap: { learning, canon: importedItems(learning).some((i) => i.key === key) }, acc: s.acc + xp })
          }
          for (const o of outs) {
            const k = canon(o, key, addDays(date, 1))
            const prev = next.get(k)
            if (!prev || prev.acc < o.acc) next.set(k, o)
          }
        }
      }
    }
    frontier = next
    best.push(Math.max(...[...frontier.values()].map((n) => n.acc)))
  }
  return best
}

describe('性質（接線後）：單一項目 ≤60 天，任何作答策略經 submitAnswer 的累積 XP 都不超過誠實最佳', () => {
  test.each([
    ['vocab', HONEST_VOCAB],
    ['grammar', HONEST_NON_VOCAB],
  ] as const)('%s：移植排程下的誠實最佳與參考模型一致', (kind, honest) => {
    expect(bestByHorizon(kind, ['', 'C'], false)).toEqual(honest)
  })

  test.each([
    ['vocab', HONEST_VOCAB],
    ['grammar', HONEST_NON_VOCAB],
  ] as const)('%s：{不練、答對、答錯、先對後錯、先錯後對} 窮舉的最佳 = 誠實最佳', (kind, honest) => {
    expect(bestByHorizon(kind, ANSWERS, false)).toEqual(honest)
  })

  test('vocab：穿插翻卡自評不能提高最佳 XP', () => {
    expect(bestByHorizon('vocab', WITH_FLASH, false)).toEqual(HONEST_VOCAB)
  })

  test.each([
    ['vocab', HONEST_VOCAB],
    ['grammar', HONEST_NON_VOCAB],
  ] as const)('%s：加上每天可重複匯入同一份舊 v5 碼，最佳仍不超過誠實最佳', (kind, honest) => {
    const best = bestByHorizon(kind, ANSWERS, true)
    best.forEach((b, i) => expect(b).toBeLessThanOrEqual(honest[i]))
  }, 120_000)
})
