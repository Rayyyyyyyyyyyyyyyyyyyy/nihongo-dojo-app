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
