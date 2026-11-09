// 獎賞引擎的資料契約（handoff §2.2）。純 TS，不依賴 React／Expo。
export type LocalDate = string; // 'YYYY-MM-DD'，呼叫端以本機曆日提供（時鐘由呼叫端注入）
export type Kind = 'vocab' | 'grammar' | 'reading' | 'listening';
export type ItemKey = string; // JSON.stringify([level, kind, id])

// 一次有效作答（翻卡自評、選擇題、讀解子題、聽力題提交）。由學習規則產生後交給獎賞引擎。
export interface LearningEvent {
  key: ItemKey;
  kind: Kind;
  correct: boolean;
  date: LocalDate;
  // 以下只對單字有意義；非單字傳 isDue: false、stage 皆 null。
  isDue: boolean; // 提交前排程到期日 ≤ 今天
  stageBefore: number | null; // 0–5；未排程為 null
  stageAfter: number | null;
}

export type ChestResult =
  | { type: 'cosmetic'; id: string }
  | { type: 'protectionCard' }
  | { type: 'commemorativeStamp' }
  | { type: 'firstStamp' };

export interface RewardState {
  xpTotal: number;
  xpByDay: Record<LocalDate, number>; // ≤90 天
  awardedToday: { date: LocalDate; keys: ItemKey[] };
  firstCorrectPaid: ItemKey[];
  maxStage: Record<ItemKey, number>;
  lastMaintenancePaid: Record<ItemKey, LocalDate>; // 單字上次付 +15 的日期（審查 F9）；匯入時保留
  protectionBaselineDate: LocalDate;
  celebratedRanks: number[];
  goalCompletedDates: LocalDate[];
  protectedDates: LocalDate[];
  protectionCards: 0 | 1 | 2;
  chest: {
    lastOpenedDate: LocalDate | null;
    log: Array<{ date: LocalDate; result: ChestResult }>; // ≤90 天
    ownedCosmetics: string[];
    equipped: { stamp: string; frame: string; theme: string };
  };
  nameTag: string;
}

// 匯入 v5 碼時，學習規則從 v5 state 摘出的每個 key（handoff §2.4）。
export interface ImportedItem {
  key: ItemKey;
  hasCorrect: boolean; // 已掌握、排程 stage ≥1、或結果中有答對
  stage: number | null; // 單字排程 stage；非單字 null
}
