import * as rewards from './index';
import { COSMETICS, FIRST_STAMP, initialRewardState, openChest, recordGoalCompleted } from './index';
import { addDays } from './dates';
import type { RewardState } from './types';

const ID = 'install-abc';
const D0 = '2026-11-01';
const doneOn = (s: RewardState, date: string) => recordGoalCompleted(s, date);
// 已開過第一個寶箱（初稽古印）之後的狀態
const afterFirst = (): RewardState => openChest(doneOn(initialRewardState(D0), D0), { installId: ID, date: D0 })!.state;

describe('每日寶箱（rewards §3）', () => {
  test('未完成當日目標不可開', () => {
    expect(openChest(initialRewardState(D0), { installId: ID, date: D0 })).toBeNull();
  });

  test('第一次開箱固定給「初稽古印」（不在隨機池）', () => {
    const r = openChest(doneOn(initialRewardState(D0), D0), { installId: ID, date: D0 })!;
    expect(r.result).toEqual({ type: 'firstStamp' });
    expect(r.state.chest.ownedCosmetics).toEqual([FIRST_STAMP]);
    expect(COSMETICS).not.toContain(FIRST_STAMP);
  });

  test('同一天加練後不給第二個', () => {
    const s = doneOn(afterFirst(), D0);
    expect(openChest(s, { installId: ID, date: D0 })).toBeNull();
  });

  test('同 installId＋日期重算結果相同', () => {
    const d = '2026-11-02';
    const s = doneOn(afterFirst(), d);
    expect(openChest(s, { installId: ID, date: d })).toEqual(openChest(s, { installId: ID, date: d }));
  });

  test('整輪不重複：24 個外觀收齊前不會重複，收齊後不再出外觀', () => {
    let s = afterFirst();
    const got: string[] = [];
    for (let i = 1; i <= 200; i++) {
      const d = addDays(D0, i);
      s = { ...s, protectionCards: 0 }; // 保持可抽外觀的分支
      const r = openChest(doneOn(s, d), { installId: ID, date: d })!;
      if (r.result.type === 'cosmetic') got.push(r.result.id);
      s = r.state;
    }
    expect(new Set(got).size).toBe(got.length);
    expect([...got].sort()).toEqual([...COSMETICS].sort());
  });

  test('持有 2 張保護卡時不出保護卡', () => {
    const base = { ...afterFirst(), protectionCards: 2 as const };
    for (let i = 1; i <= 60; i++) {
      const d = addDays(D0, i);
      expect(openChest(doneOn(base, d), { installId: ID, date: d })!.result.type).toBe('cosmetic');
    }
  });

  test('外觀收齊、持有 0–1 張 → 保護卡；持有 2 張 → 記念印', () => {
    const full: RewardState = { ...afterFirst(), chest: { ...afterFirst().chest, ownedCosmetics: [FIRST_STAMP, ...COSMETICS] } };
    const d = '2026-11-02';
    const one = openChest(doneOn({ ...full, protectionCards: 1 }, d), { installId: ID, date: d })!;
    expect(one.result).toEqual({ type: 'protectionCard' });
    expect(one.state.protectionCards).toBe(2);
    expect(openChest(doneOn({ ...full, protectionCards: 2 }, d), { installId: ID, date: d })!.result).toEqual({ type: 'commemorativeStamp' });
  });

  test('未收齊、持有 0–1 張時保護卡約 20%（公開機率表）', () => {
    const base = afterFirst();
    let cards = 0;
    const N = 2000;
    for (let i = 1; i <= N; i++) {
      const d = addDays(D0, i);
      if (openChest(doneOn(base, d), { installId: ID, date: d })!.result.type === 'protectionCard') cards++;
    }
    expect(cards / N).toBeGreaterThan(0.17);
    expect(cards / N).toBeLessThan(0.23);
  });

  test('結果先寫入 chest.log，log 只保留 90 天', () => {
    let s = afterFirst();
    for (let i = 1; i <= 100; i++) {
      const d = addDays(D0, i);
      s = openChest(doneOn(s, d), { installId: ID, date: d })!.state;
    }
    expect(s.chest.log).toHaveLength(90);
    expect(s.chest.lastOpenedDate).toBe(addDays(D0, 100));
  });

  test('不可購買：模組沒有任何購買、兌換入口', () => {
    expect(Object.keys(rewards).filter((k) => /buy|purchase|price|redeem|exchange/i.test(k))).toEqual([]);
  });
});
