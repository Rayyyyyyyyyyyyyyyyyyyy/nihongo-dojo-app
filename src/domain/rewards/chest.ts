import { addDays } from './dates';
import type { ChestResult, LocalDate, RewardState } from './types';

// rewards §3.2 首版外觀池（24 個）；日後新增外觀加在最後即進入「還沒拿到」池
export const COSMETICS = [
  ...['sakura', 'fuji', 'torii', 'take', 'tsuru', 'tsuki', 'kumo', 'nami', 'kaede', 'ume', 'ougi', 'suzu'].map((n) => `stamp-${n}`),
  ...['hinoki', 'sugi', 'shikkoku', 'aizome', 'shunuri', 'washi', 'kintsugi', 'suminagashi'].map((n) => `frame-${n}`),
  ...['spring', 'summer', 'autumn', 'winter'].map((n) => `theme-${n}`),
];
export const FIRST_STAMP = 'stamp-hatsugeiko'; // 初稽古印，第一次開箱固定給，不在隨機池
const CARD_RATE = 0.2;

// FNV-1a + mulberry32：同 installId＋日期＋openIndex 得到同一串亂數
function rng(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 完成當日目標後開 1 個；未完成或今天已開過回傳 null。結果先寫進 state（chest.log）再交給畫面播動畫。
export function openChest(
  state: RewardState,
  { installId, date }: { installId: string; date: LocalDate },
): { state: RewardState; result: ChestResult } | null {
  const { chest } = state;
  if (!state.goalCompletedDates.includes(date) || chest.lastOpenedDate === date) return null;

  const missing = COSMETICS.filter((id) => !chest.ownedCosmetics.includes(id));
  const cards = state.protectionCards;
  const rand = rng(`${installId}|${date}|0`); // 每天最多 1 個，openIndex 固定 0
  let result: ChestResult;
  if (chest.lastOpenedDate === null) result = { type: 'firstStamp' };
  else if (missing.length > 0 && (cards === 2 || rand() >= CARD_RATE)) {
    result = { type: 'cosmetic', id: missing[Math.floor(rand() * missing.length)] };
  } else if (cards < 2) result = { type: 'protectionCard' };
  else result = { type: 'commemorativeStamp' };

  const cutoff = addDays(date, -89);
  const owned =
    result.type === 'firstStamp' ? FIRST_STAMP : result.type === 'cosmetic' ? result.id : null;
  return {
    result,
    state: {
      ...state,
      protectionCards: result.type === 'protectionCard' ? ((cards + 1) as 1 | 2) : cards,
      chest: {
        ...chest,
        lastOpenedDate: date,
        log: [...chest.log.filter((e) => e.date >= cutoff), { date, result }],
        ownedCosmetics: owned ? [...chest.ownedCosmetics, owned] : chest.ownedCosmetics,
      },
    },
  };
}
