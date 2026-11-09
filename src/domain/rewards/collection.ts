import type { ItemKey } from './types';

// 收集冊只是掌握狀態的檢視：點亮條件直接用學習規則的既有掌握判定（決策 F5-6），不存第二份紀錄、不給 XP。
export const collectionBoard = (keys: ItemKey[], isMastered: (key: ItemKey) => boolean) => ({
  lit: keys.filter(isMastered),
  total: keys.length,
});
