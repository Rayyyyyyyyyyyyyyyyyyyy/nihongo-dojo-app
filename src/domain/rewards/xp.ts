import { addDays, daysBetween } from './dates';
import type { LearningEvent, RewardState } from './types';

const KEEP_DAYS = 90;

// rewards.md §2.1 第 2 版；D15 數值 +10／+15／+3／同日 0 不可改。
// 呼叫前 awardedToday 必須已是當天（applyAnswer 負責跨日清空）。
export function xpFor(s: RewardState, a: LearningEvent): 0 | 3 | 10 | 15 {
  if (s.awardedToday.keys.includes(a.key)) return 0;
  if (!a.correct) return 3;
  if (!s.firstCorrectPaid.includes(a.key)) return 10;
  if (a.kind === 'vocab' && a.isDue && a.stageAfter !== null) {
    const reachesNewStage = a.stageAfter > (s.maxStage[a.key] ?? 0);
    const last = s.lastMaintenancePaid[a.key];
    // 審查 F9：重複匯入舊碼可把第 5 級的到期日拉回過去；距上次付 +15 未滿 30 天就不再付
    const finalMaintenance =
      a.stageBefore === 5 && a.stageAfter === 5 && (last === undefined || daysBetween(last, a.date) >= 30);
    if (reachesNewStage || finalMaintenance) return 15;
  }
  return 3;
}

export function applyAnswer(state: RewardState, event: LearningEvent): { state: RewardState; xp: 0 | 3 | 10 | 15 } {
  // 時鐘倒退不回退基線（rewards §1）：日期早於已入帳日時視為同一天，避免倒撥時鐘重領
  const date = event.date < state.awardedToday.date ? state.awardedToday.date : event.date;
  const a = { ...event, date };
  const today = state.awardedToday.date === date ? state.awardedToday : { date, keys: [] };
  const s = { ...state, awardedToday: today };
  const xp = xpFor(s, a);
  if (xp === 0) return { state: s, xp };

  const cutoff = addDays(date, -(KEEP_DAYS - 1));
  const xpByDay = Object.fromEntries(Object.entries(s.xpByDay).filter(([d]) => d >= cutoff));
  xpByDay[date] = (xpByDay[date] ?? 0) + xp;
  const next: RewardState = {
    ...s,
    xpTotal: s.xpTotal + xp,
    xpByDay,
    awardedToday: { date, keys: [...today.keys, a.key] },
    firstCorrectPaid: xp === 10 ? [...s.firstCorrectPaid, a.key] : s.firstCorrectPaid,
    lastMaintenancePaid: xp === 15 ? { ...s.lastMaintenancePaid, [a.key]: date } : s.lastMaintenancePaid,
  };
  if (a.kind === 'vocab' && a.stageAfter !== null && a.stageAfter > (s.maxStage[a.key] ?? 0)) {
    next.maxStage = { ...s.maxStage, [a.key]: a.stageAfter };
  }
  return { state: next, xp };
}
