import { addDays, daysBetween } from './dates';
import { initialRewardState, mergeImport } from './index';
import { freshSched, KEY, playDay, START, type Sched } from './sim.testutil';
import type { Kind, RewardState } from './types';

// 誠實最佳（每天只能「不練」或「答對」）：由參考模型 design/tools/xp_strategy_check.py（v2）算出，作為獨立對照。
const HONEST_VOCAB = [10, 25, 28, 31, 46, 49, 52, 55, 58, 61, 64, 79, 82, 85, 88, 91, 94, 97, 100, 103, 106, 109, 112,
  115, 118, 133, 136, 139, 142, 145, 148, 151, 154, 157, 160, 163, 166, 169, 172, 175, 178, 181, 184, 187, 190, 193, 196,
  199, 202, 205, 208, 211, 214, 217, 220, 235, 238, 241, 244, 247];
const HONEST_NON_VOCAB = Array.from({ length: 60 }, (_, i) => 10 + 3 * i);
const HORIZON = 60;
const ANSWERS = ['', 'C', 'W', 'CW', 'WC'];

interface Node { rs: RewardState; sc: Sched; snap: Sched | null; acc: number }

const rel = (due: number | null, day: number) => (due === null ? 'n' : Math.max(0, due - day));
function canon(n: Node, day: number): string {
  const last = n.rs.lastMaintenancePaid[KEY];
  const max = n.rs.maxStage[KEY] ?? 0;
  return JSON.stringify([
    n.rs.firstCorrectPaid.includes(KEY), max,
    // 上次 +15 的日期只在已到第 5 級時影響計分（升到第 5 級那次本身就會重寫它）
    last === undefined || max < 5 ? -1 : Math.min(30, daysBetween(last, addDays(START, day))),
    n.sc.stage, rel(n.sc.due, day), n.sc.everCorrect,
    n.snap && [n.snap.stage, rel(n.snap.due, day), n.snap.everCorrect],
  ]);
}

// 前向動態規劃：以實作（applyAnswer／mergeImport）逐日展開所有策略；同一規範狀態只保留累積 XP 最大者（未來只取決於狀態，所以精確）。
// withImport：任一天作答後可匯出一份 v5 碼並保留，之後每天都可先重新匯入這份舊碼（審查 F9 的重複匯入路徑）。
function bestByHorizon(kind: Kind, answers: string[], withImport: boolean): number[] {
  let frontier = new Map<string, Node>([['start', { rs: initialRewardState(START), sc: freshSched(), snap: null, acc: 0 }]]);
  const best: number[] = [];
  for (let day = 0; day < HORIZON; day++) {
    const next = new Map<string, Node>();
    const date = addDays(START, day);
    for (const n of frontier.values()) {
      const starts: Node[] = [n];
      if (withImport && n.snap) {
        const item = { key: KEY, hasCorrect: n.snap.everCorrect, stage: n.snap.due === null ? null : n.snap.stage };
        starts.push({ ...n, rs: mergeImport(n.rs, [item], date), sc: { ...n.snap } });
      }
      for (const s of starts) {
        for (const a of answers) {
          const [rs, sc, xp] = playDay(s.rs, s.sc, a, day, kind);
          // xpByDay 只是顯示用、不影響之後的計分；清掉以免每步複製 60 天的紀錄
          const r = { ...rs, xpByDay: {} };
          const outs: Node[] = [{ rs: r, sc, snap: s.snap, acc: s.acc + xp }];
          if (withImport && !s.snap) outs.push({ rs: r, sc, snap: { ...sc }, acc: s.acc + xp });
          for (const o of outs) {
            const k = canon(o, day + 1);
            const prev = next.get(k);
            if (!prev || prev.acc < o.acc) next.set(k, o);
          }
        }
      }
    }
    frontier = next;
    best.push(Math.max(...[...frontier.values()].map((n) => n.acc)));
  }
  return best;
}

describe('性質：單一項目 ≤60 天，任何作答策略的實作累積 XP 都不超過誠實最佳', () => {
  test.each([
    ['vocab', HONEST_VOCAB],
    ['grammar', HONEST_NON_VOCAB],
  ] as const)('%s：實作的誠實最佳與參考模型一致', (kind, honest) => {
    expect(bestByHorizon(kind, ['', 'C'], false)).toEqual(honest);
  });

  test.each([
    ['vocab', HONEST_VOCAB],
    ['grammar', HONEST_NON_VOCAB],
  ] as const)('%s：{不練、答對、答錯、先對後錯、先錯後對} 窮舉的最佳 = 誠實最佳', (kind, honest) => {
    expect(bestByHorizon(kind, ANSWERS, false)).toEqual(honest);
  });

  test.each([
    ['vocab', HONEST_VOCAB],
    ['grammar', HONEST_NON_VOCAB],
  ] as const)('%s：加上每天可重複匯入舊 v5 碼，最佳仍不超過誠實最佳', (kind, honest) => {
    const best = bestByHorizon(kind, ANSWERS, true);
    best.forEach((b, i) => expect(b).toBeLessThanOrEqual(honest[i]));
  });
});
