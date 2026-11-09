import { applyAnswer, initialRewardState, mergeImport } from './index';
import type { LearningEvent, RewardState } from './types';

const V = JSON.stringify(['N3', 'vocab', '連なる']);
const G = JSON.stringify(['N3', 'grammar', 'g-1']);
const ev = (p: Partial<LearningEvent>): LearningEvent =>
  ({ key: V, kind: 'vocab', correct: true, date: '2026-11-10', isDue: true, stageBefore: 3, stageAfter: 4, ...p });

describe('匯入 v5 碼的獎賞合併（handoff §2.4）', () => {
  const base: RewardState = { ...initialRewardState('2026-11-01'), xpTotal: 500, protectionCards: 1 };

  test('有答對紀錄的 key 合併進 firstCorrectPaid，單字 maxStage 取 max；之後不重領 +10／+15', () => {
    const s = mergeImport(base, [{ key: V, hasCorrect: true, stage: 4 }, { key: G, hasCorrect: true, stage: null }], '2026-11-09');
    expect(s.firstCorrectPaid).toEqual(expect.arrayContaining([V, G]));
    expect(s.maxStage[V]).toBe(4);
    expect(applyAnswer(s, ev({})).xp).toBe(3);
    expect(applyAnswer(s, ev({ key: G, kind: 'grammar', isDue: false, stageBefore: null, stageAfter: null })).xp).toBe(3);
  });

  test('maxStage 不會被較低的 v5 stage 降低', () => {
    const s = mergeImport({ ...base, maxStage: { [V]: 5 } }, [{ key: V, hasCorrect: true, stage: 2 }], '2026-11-09');
    expect(s.maxStage[V]).toBe(5);
  });

  test('只在錯題清單、沒有答對紀錄的 key 不加入；之後第一次答對仍得 +10', () => {
    const s = mergeImport(base, [{ key: G, hasCorrect: false, stage: null }], '2026-11-09');
    expect(s.firstCorrectPaid).not.toContain(G);
    expect(applyAnswer(s, ev({ key: G, kind: 'grammar', isDue: false, stageBefore: null, stageAfter: null })).xp).toBe(10);
  });

  test('匯入不給 XP、不改保護卡數，protectionBaselineDate 設為匯入日', () => {
    const s = mergeImport(base, [{ key: V, hasCorrect: true, stage: 3 }], '2026-11-09');
    expect(s.xpTotal).toBe(500);
    expect(s.protectionCards).toBe(1);
    expect(s.protectionBaselineDate).toBe('2026-11-09');
  });

  test('重複匯入同一份舊碼不增加 +15（審查 F9）', () => {
    // 第 5 級在 11-01 付過 +15；舊碼讓排程停在「第 5 級、已到期」。每天重新匯入再答對。
    let s: RewardState = { ...base, firstCorrectPaid: [V], maxStage: { [V]: 5 }, lastMaintenancePaid: { [V]: '2026-11-01' } };
    const paid: number[] = [];
    for (let d = 2; d <= 9; d++) {
      const date = `2026-11-0${d}`;
      s = mergeImport(s, [{ key: V, hasCorrect: true, stage: 5 }], date);
      const r = applyAnswer(s, ev({ date, stageBefore: 5, stageAfter: 5 }));
      paid.push(r.xp);
      s = r.state;
    }
    expect(paid).toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
  });
});
