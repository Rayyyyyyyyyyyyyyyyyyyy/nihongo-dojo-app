import { applyAnswer, initialRewardState } from './index';
import type { LearningEvent, RewardState } from './types';

const K = JSON.stringify(['N3', 'vocab', '連なる']);
const G = JSON.stringify(['N3', 'grammar', 'g-101']);

function ev(p: Partial<LearningEvent>): LearningEvent {
  return { key: K, kind: 'vocab', correct: true, date: '2026-11-01', isDue: false, stageBefore: null, stageAfter: 1, ...p };
}
const fresh = (): RewardState => initialRewardState('2026-11-01');

describe('xp：rewards.md §2.2 範例表', () => {
  test('第一次見到「連なる」並答對 → +10', () => {
    expect(applyAnswer(fresh(), ev({})).xp).toBe(10);
  });

  test('第一次見到就答錯 → +3', () => {
    expect(applyAnswer(fresh(), ev({ correct: false, stageAfter: 0 })).xp).toBe(3);
  });

  test('之前答錯過、今天第一次答對 → +10（首次答對只付一次）', () => {
    const s1 = applyAnswer(fresh(), ev({ correct: false, stageAfter: 0 })).state;
    const r = applyAnswer(s1, ev({ date: '2026-11-02', isDue: true, stageBefore: 0, stageAfter: 1 }));
    expect(r.xp).toBe(10);
    expect(applyAnswer(r.state, ev({ date: '2026-11-03', isDue: true, stageBefore: 1, stageAfter: 1 })).xp).toBe(3);
  });

  test('同一天再做一次（不論對錯）→ 0', () => {
    const s1 = applyAnswer(fresh(), ev({})).state;
    expect(applyAnswer(s1, ev({ stageBefore: 1, stageAfter: 1 })).xp).toBe(0);
    expect(applyAnswer(s1, ev({ correct: false, stageBefore: 1, stageAfter: 0 })).xp).toBe(0);
    expect(applyAnswer(s1, ev({})).state.xpTotal).toBe(10);
  });

  test('隔天（未到期）再練答對 → +3', () => {
    const s1 = applyAnswer(fresh(), ev({})).state;
    expect(applyAnswer(s1, ev({ date: '2026-11-02', isDue: false, stageBefore: 1, stageAfter: 1 })).xp).toBe(3);
  });

  test('排程到期日當天答對，推進到新的 stage → +15', () => {
    const s1 = applyAnswer(fresh(), ev({})).state;
    expect(applyAnswer(s1, ev({ date: '2026-11-02', isDue: true, stageBefore: 1, stageAfter: 2 })).xp).toBe(15);
  });

  test('已在第 5 級（30 天），按時複習答對 → +15', () => {
    const s = { ...fresh(), firstCorrectPaid: [K], maxStage: { [K]: 5 } };
    expect(applyAnswer(s, ev({ isDue: true, stageBefore: 5, stageAfter: 5 })).xp).toBe(15);
  });

  test('排程到期日當天答錯 → +3', () => {
    const s = { ...fresh(), firstCorrectPaid: [K], maxStage: { [K]: 2 } };
    expect(applyAnswer(s, ev({ correct: false, isDue: true, stageBefore: 2, stageAfter: 0 })).xp).toBe(3);
  });

  test('答錯後重新爬升到曾經到過的 stage → +3', () => {
    const s = { ...fresh(), firstCorrectPaid: [K], maxStage: { [K]: 4 } };
    expect(applyAnswer(s, ev({ isDue: true, stageBefore: 1, stageAfter: 2 })).xp).toBe(3);
    expect(applyAnswer(s, ev({ isDue: true, stageBefore: 3, stageAfter: 4 })).xp).toBe(3);
  });

  test('錯題清單中的文法題，隔天答對（之前從未答對）→ +10', () => {
    const g = (p: Partial<LearningEvent>) => ev({ key: G, kind: 'grammar', stageAfter: null, ...p });
    const s1 = applyAnswer(fresh(), g({ correct: false })).state;
    expect(applyAnswer(s1, g({ date: '2026-11-02' })).xp).toBe(10);
  });

  test('錯題清單中的文法題，之前答對過，隔天答對 → +3', () => {
    const g = (p: Partial<LearningEvent>) => ev({ key: G, kind: 'grammar', stageAfter: null, ...p });
    let s = applyAnswer(fresh(), g({})).state;
    s = applyAnswer(s, g({ date: '2026-11-02', correct: false })).state;
    expect(applyAnswer(s, g({ date: '2026-11-03' })).xp).toBe(3);
  });
});

describe('xp：入帳規則', () => {
  test('跨日清空 awardedToday，隔天同 key 可再入帳', () => {
    const s1 = applyAnswer(fresh(), ev({})).state;
    const r = applyAnswer(s1, ev({ date: '2026-11-02', stageBefore: 1, stageAfter: 1 }));
    expect(r.state.awardedToday).toEqual({ date: '2026-11-02', keys: [K] });
    expect(r.state.xpByDay).toEqual({ '2026-11-01': 10, '2026-11-02': 3 });
    expect(r.state.xpTotal).toBe(13);
  });

  test('時鐘倒退一天不清空今天的入帳紀錄（不可倒撥重領）', () => {
    const s1 = applyAnswer(fresh(), ev({ date: '2026-11-05' })).state;
    expect(applyAnswer(s1, ev({ date: '2026-11-04', stageBefore: 1, stageAfter: 1 })).xp).toBe(0);
  });

  test('xpByDay 只保留 90 天，xpTotal 只增不減', () => {
    let s = applyAnswer(fresh(), ev({})).state;
    s = applyAnswer(s, ev({ date: '2027-02-01', stageBefore: 1, stageAfter: 1 })).state;
    expect(Object.keys(s.xpByDay)).toEqual(['2027-02-01']);
    expect(s.xpTotal).toBe(13);
  });

  test('第 5 級 +15 距上次付款未滿 30 天就只給 +3（審查 F9）', () => {
    const s = { ...fresh(), firstCorrectPaid: [K], maxStage: { [K]: 5 }, lastMaintenancePaid: { [K]: '2026-10-20' } };
    expect(applyAnswer(s, ev({ isDue: true, stageBefore: 5, stageAfter: 5 })).xp).toBe(3);
    expect(applyAnswer(s, ev({ date: '2026-11-19', isDue: true, stageBefore: 5, stageAfter: 5 })).xp).toBe(15);
  });
});
