import { applyProtection, initialRewardState, isGapProtected, mergeImport, practiceDays, recordGoalCompleted } from './index';
import type { RewardState } from './types';

const LAST = '2026-11-10'; // 上次學習日
const withCards = (protectionCards: 0 | 1 | 2): RewardState => ({ ...initialRewardState('2026-11-01'), protectionCards });
const todayAfterMissing = (n: number) => `2026-11-${String(11 + n).padStart(2, '0')}`; // 錯過 n 個完整日之後的今天

describe('連勝保護卡（rewards §4.2、handoff §4.1）', () => {
  test.each([
    // 錯過天數, 持有, 守住的日子, 剩餘卡數, 連勝是否接上
    [1, 0, [], 0, false],
    [1, 1, ['2026-11-11'], 0, true],
    [1, 2, ['2026-11-11'], 1, true],
    [2, 0, [], 0, false],
    [2, 1, [], 1, false],
    [2, 2, ['2026-11-11', '2026-11-12'], 0, true],
    [3, 0, [], 0, false],
    [3, 1, [], 1, false],
    [3, 2, [], 2, false],
  ] as const)('錯過 %i 天、持有 %i 張 → 守住 %j、剩 %i 張', (missed, cards, dates, left, continues) => {
    const today = todayAfterMissing(missed);
    const r = applyProtection(withCards(cards), { lastStudyDate: LAST, today });
    expect(r.protectedNow).toEqual(dates);
    expect(r.state.protectedDates).toEqual(dates);
    expect(r.state.protectionCards).toBe(left);
    expect(isGapProtected(r.state, LAST, today)).toBe(continues);
  });

  test('沒有錯過的日子（昨天或今天學過）不扣卡', () => {
    expect(applyProtection(withCards(2), { lastStudyDate: LAST, today: '2026-11-11' }).state.protectionCards).toBe(2);
    expect(applyProtection(withCards(2), { lastStudyDate: LAST, today: LAST }).state.protectionCards).toBe(2);
  });

  test('同日重複觸發（前景、提交）不重複扣卡', () => {
    const today = todayAfterMissing(1);
    const once = applyProtection(withCards(2), { lastStudyDate: LAST, today }).state;
    const twice = applyProtection(once, { lastStudyDate: LAST, today });
    expect(twice.protectedNow).toEqual([]);
    expect(twice.state.protectionCards).toBe(1);
    expect(twice.state.protectedDates).toEqual(['2026-11-11']);
  });

  test('保護日不算修行日數', () => {
    let s = recordGoalCompleted(withCards(1), '2026-11-10');
    s = applyProtection(s, { lastStudyDate: LAST, today: '2026-11-12' }).state;
    s = recordGoalCompleted(s, '2026-11-12');
    expect(s.protectedDates).toEqual(['2026-11-11']);
    expect(practiceDays(s, '2026-11')).toBe(2);
  });

  test('匯入不改卡數；匯入 lastDate 為 10 天前的 v5 碼後，隔天開 App 不扣卡，連勝依既有規則重設', () => {
    const lastDate = '2026-10-30';
    const imported = mergeImport(withCards(2), [], '2026-11-09');
    expect(imported.protectionCards).toBe(2);
    const r = applyProtection(imported, { lastStudyDate: lastDate, today: '2026-11-10' });
    expect(r.state.protectionCards).toBe(2);
    expect(r.protectedNow).toEqual([]);
    expect(isGapProtected(r.state, lastDate, '2026-11-10')).toBe(false); // 學習規則據此在下一次有效提交時把連勝重設為 1
  });

  test('只計 protectionBaselineDate 之後錯過的日子；空白跨過基線時救不回連勝，就不扣卡', () => {
    const today = '2026-11-13'; // 錯過 11-11、11-12
    const crossing = applyProtection({ ...withCards(2), protectionBaselineDate: '2026-11-11' }, { lastStudyDate: LAST, today });
    expect(crossing.protectedNow).toEqual([]);
    expect(crossing.state.protectionCards).toBe(2);
    const after = applyProtection({ ...withCards(2), protectionBaselineDate: LAST }, { lastStudyDate: LAST, today });
    expect(after.protectedNow).toEqual(['2026-11-11', '2026-11-12']);
  });
});
