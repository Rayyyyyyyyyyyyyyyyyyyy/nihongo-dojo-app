import type { RewardState } from './types';

// rewards §6.1 累積 XP 門檻 [假設，需校準]；index + 1 = 段位（1 白帶 … 10 三段）
export const RANK_THRESHOLDS = [0, 200, 600, 1200, 2000, 3500, 5500, 8000, 12000, 18000] as const;

export const rankFor = (xpTotal: number): number => RANK_THRESHOLDS.filter((t) => xpTotal >= t).length;

// 回傳要播的升段儀式（只播最高段，passed 列出這次經過的段位），並把它們記進 celebratedRanks。
export function celebrateRanks(state: RewardState): {
  state: RewardState;
  ceremony: { rank: number; passed: number[] } | null;
} {
  const passed: number[] = [];
  for (let r = 2; r <= rankFor(state.xpTotal); r++) if (!state.celebratedRanks.includes(r)) passed.push(r);
  if (passed.length === 0) return { state, ceremony: null };
  return {
    state: { ...state, celebratedRanks: [...state.celebratedRanks, ...passed] },
    ceremony: { rank: passed[passed.length - 1], passed },
  };
}
