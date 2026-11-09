import { addDays } from './dates';
import type { LocalDate, RewardState } from './types';

const missedDays = (lastStudyDate: LocalDate, today: LocalDate): LocalDate[] => {
  const days: LocalDate[] = [];
  for (let d = addDays(lastStudyDate, 1); d < today; d = addDays(d, 1)) days.push(d);
  return days;
};

// rewards §4.2：新的一天第一次進前景或第一次有效提交時呼叫（重複呼叫冪等）。每個完整錯過的日子用 1 張；
// 卡不夠、或空白含 protectionBaselineDate 當天及之前的日子（救不回連勝）時一張都不扣。
export function applyProtection(
  state: RewardState,
  { lastStudyDate, today }: { lastStudyDate: LocalDate; today: LocalDate },
): { state: RewardState; protectedNow: LocalDate[] } {
  const need = missedDays(lastStudyDate, today).filter((d) => !state.protectedDates.includes(d));
  if (need.length === 0 || need.length > state.protectionCards || need.some((d) => d <= state.protectionBaselineDate)) {
    return { state, protectedNow: [] };
  }
  return {
    state: {
      ...state,
      protectionCards: (state.protectionCards - need.length) as 0 | 1 | 2,
      protectedDates: [...state.protectedDates, ...need],
    },
    protectedNow: need,
  };
}

// 連勝規則用：上次學習日到今天之間每個錯過的日子都被保護卡守住時，連勝視為未中斷。
export const isGapProtected = (state: RewardState, lastStudyDate: LocalDate, today: LocalDate): boolean =>
  missedDays(lastStudyDate, today).every((d) => state.protectedDates.includes(d));

// 修行帳「本月修行 N 天」：只算完成目標的日子，保護日不算。yearMonth = 'YYYY-MM'
export const practiceDays = (state: RewardState, yearMonth: string): number =>
  state.goalCompletedDates.filter((d) => d.startsWith(yearMonth)).length;
