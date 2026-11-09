import type { ImportedItem, LocalDate, RewardState } from './types';

// v5 匯入只覆寫 learning；rewards 保留，只合併防重領資料並重設保護卡基線（handoff §2.4、rewards §4.2）。
export function mergeImport(state: RewardState, items: ImportedItem[], today: LocalDate): RewardState {
  const paid = new Set(state.firstCorrectPaid);
  const maxStage = { ...state.maxStage };
  for (const it of items) {
    if (!it.hasCorrect) continue;
    paid.add(it.key);
    if (it.stage !== null) maxStage[it.key] = Math.max(maxStage[it.key] ?? 0, it.stage);
  }
  return { ...state, firstCorrectPaid: [...paid], maxStage, protectionBaselineDate: today };
}
