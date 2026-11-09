import type { LocalDate, RewardState } from './types';

// 安裝當天的初始狀態；保護卡基線設為安裝日（handoff §2.2）。
export const initialRewardState = (today: LocalDate): RewardState => ({
  xpTotal: 0,
  xpByDay: {},
  awardedToday: { date: today, keys: [] },
  firstCorrectPaid: [],
  maxStage: {},
  lastMaintenancePaid: {},
  protectionBaselineDate: today,
  celebratedRanks: [],
  goalCompletedDates: [],
  protectedDates: [],
  protectionCards: 0,
  chest: {
    lastOpenedDate: null,
    log: [],
    ownedCosmetics: [],
    equipped: { stamp: 'default', frame: 'default', theme: 'default' },
  },
  nameTag: '我',
});

// 今日目標完成（由學習規則的今日任務判定）時記錄；修行帳實心印與寶箱開啟條件都讀這裡。
export const recordGoalCompleted = (state: RewardState, date: LocalDate): RewardState =>
  state.goalCompletedDates.includes(date) ? state : { ...state, goalCompletedDates: [...state.goalCompletedDates, date] };
