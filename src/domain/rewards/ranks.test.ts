import { celebrateRanks, initialRewardState, rankFor } from './index';
import type { RewardState } from './types';

const withXp = (xpTotal: number, celebratedRanks: number[] = []): RewardState =>
  ({ ...initialRewardState('2026-11-01'), xpTotal, celebratedRanks });

describe('段位（rewards §6.1、§6.3）', () => {
  test('門檻邊界：199 白帶、200 黃帶', () => {
    expect(rankFor(199)).toBe(1);
    expect(rankFor(200)).toBe(2);
  });

  test('各階門檻 0／200／600／1,200／2,000／3,500／5,500／8,000／12,000／18,000', () => {
    expect([0, 200, 600, 1200, 2000, 3500, 5500, 8000, 12000, 18000].map(rankFor)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect([599, 17999, 999999].map(rankFor)).toEqual([2, 9, 10]);
  });

  test('跨過 200 播黃帶儀式', () => {
    const r = celebrateRanks(withXp(205));
    expect(r.ceremony).toEqual({ rank: 2, passed: [2] });
    expect(r.state.celebratedRanks).toEqual([2]);
  });

  test('一次跨兩段只播最高段，卡上列出經過的段位', () => {
    const r = celebrateRanks(withXp(610));
    expect(r.ceremony).toEqual({ rank: 3, passed: [2, 3] });
    expect(r.state.celebratedRanks).toEqual([2, 3]);
  });

  test('celebratedRanks 冪等：同一段位只播一次', () => {
    const once = celebrateRanks(withXp(610)).state;
    const again = celebrateRanks(once);
    expect(again.ceremony).toBeNull();
    expect(again.state.celebratedRanks).toEqual([2, 3]);
  });

  test('未跨門檻或白帶不播', () => {
    expect(celebrateRanks(withXp(150)).ceremony).toBeNull();
  });
});
