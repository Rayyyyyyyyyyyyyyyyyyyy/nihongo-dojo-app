import { playPlan } from './sim.testutil';

describe('rewards.md §2.3 策略比較表（每列一個測試）', () => {
  test('文法 誠實（每天答對）→ 22', () => {
    expect(playPlan(['C', 'C', 'C', 'C', 'C'], 'grammar')).toEqual([10, 3, 3, 3, 3]);
  });
  test('文法 第 1 天故意答錯，之後答對 → 22', () => {
    expect(playPlan(['W', 'C', 'C', 'C', 'C'], 'grammar')).toEqual([3, 10, 3, 3, 3]);
  });
  test('文法 第 1 天答對後同日故意答錯，隔天答對 → 22', () => {
    expect(playPlan(['CW', 'C', 'C', 'C', 'C'], 'grammar')).toEqual([10, 3, 3, 3, 3]);
  });
  test('單字 誠實（每天答對；第 2、5 天到期）→ 46', () => {
    expect(playPlan(['C', 'C', 'C', 'C', 'C'], 'vocab')).toEqual([10, 15, 3, 3, 15]);
  });
  test('單字 第 1 天故意答錯，之後每天答對 → 34', () => {
    expect(playPlan(['W', 'C', 'C', 'C', 'C'], 'vocab')).toEqual([3, 10, 15, 3, 3]);
  });
  test('單字 第 2 天到期時答對後同日故意答錯，第 3 天起答對 → 34', () => {
    expect(playPlan(['C', 'CW', 'C', 'C', 'C'], 'vocab')).toEqual([10, 15, 3, 3, 3]);
  });
});
