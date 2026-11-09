import { addDays } from './dates';
import { applyAnswer, initialRewardState } from './index';
import type { Kind, RewardState } from './types';

// 測試用的單字排程模型：既有 1／3／7／14／30 天排程、同日最多推進一次、答錯重設 stage 0 當天到期、
// 同日先錯後對不推進（與 design/tools/xp_strategy_check.py 相同的假設）。實際排程由學習規則移植提供。
const INTERVALS = [1, 3, 7, 14, 30];
export const START = '2026-11-01';
export const KEY = JSON.stringify(['N3', 'vocab', 'x']);

export interface Sched { stage: number; due: number | null; everCorrect: boolean }
export const freshSched = (): Sched => ({ stage: 0, due: null, everCorrect: false });

// 一天的作答序列，例如 'CW' = 先答對再答錯。回傳 [新 RewardState, 新排程, 當天入帳 XP]。
export function playDay(rs: RewardState, sc: Sched, answers: string, day: number, kind: Kind): [RewardState, Sched, number] {
  let { stage, due, everCorrect } = sc;
  let advanced = false;
  let failed = false;
  let xp = 0;
  const date = addDays(START, day);
  for (const ans of answers) {
    const correct = ans === 'C';
    if (kind !== 'vocab') {
      const r = applyAnswer(rs, { key: KEY, kind, correct, date, isDue: false, stageBefore: null, stageAfter: null });
      rs = r.state;
      xp += r.xp;
      continue;
    }
    const isDue = due !== null && due <= day;
    let newStage = stage;
    if (correct && !failed && !advanced) {
      if (due === null) newStage = 1;
      else if (isDue) newStage = Math.min(stage + 1, 5);
    }
    const r = applyAnswer(rs, {
      key: KEY, kind, correct, date, isDue,
      stageBefore: due === null ? null : stage,
      stageAfter: correct ? newStage : 0,
    });
    rs = r.state;
    xp += r.xp;
    if (correct) {
      everCorrect = true;
      if (newStage !== stage || due === null) {
        stage = newStage;
        due = day + INTERVALS[stage - 1];
        advanced = true;
      } else if (isDue && stage === 5 && !failed && !advanced) {
        due = day + 30;
        advanced = true;
      }
    } else {
      stage = 0;
      due = day;
      failed = true;
    }
  }
  return [rs, { stage, due, everCorrect }, xp];
}

export function playPlan(plan: string[], kind: Kind): number[] {
  let rs = initialRewardState(START);
  let sc = freshSched();
  return plan.map((answers, day) => {
    let xp: number;
    [rs, sc, xp] = playDay(rs, sc, answers, day, kind);
    return xp;
  });
}
