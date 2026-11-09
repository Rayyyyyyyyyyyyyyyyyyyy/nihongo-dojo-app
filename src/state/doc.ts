// AppStateDoc（handoff §2.2）：一個 store 擁有、單一 JSON 文件保存。
import { localDate } from '../domain/learning/calendar'
import type { Clock } from '../domain/learning/types'
import { defaultState, type ProgressState } from '../domain/progress/state'
import { object, validateV5 } from '../domain/progress/validation'
import { initialRewardState, type LocalDate, type RewardState } from '../domain/rewards'

// 實際商品 ID 由使用者在 App Store Connect 建立（R4）；這裡用 handoff §2.3 的命名建議。
export const PRODUCT_ID = 'com.example.nihongodojo.full_n3_n1'

export interface Entitlement {
  productId: string
  owned: boolean
  verifiedAt: string // 最後一次由 StoreKit 驗證的時間；'' = 從未驗證
  source: 'storekit'
}

// 等級不在這裡：沿用移植的 learning.level 作唯一來源（今日任務以它為 key），避免兩份等級。
export interface Settings {
  dailyMinutes: 5 | 10 | 20
  sound: boolean
  haptics: boolean
  appearance: 'system' | 'light' | 'dark'
  speechRate: 0.8 | 1.0
  reminder: {
    enabled: boolean
    time: string // 'HH:mm'
    ignoredCount: number
    lastAppOpen: LocalDate
    askAfter: LocalDate | null // S18「之後再說」：這天之前不再顯示提醒說明卡
  }
  reportMode: 'copyCode' | 'mailto'
}

export type Onboarding = 'notStarted' | 'level' | 'minutes' | 'placement' | 'done'

export interface AppStateDoc {
  schema: 'dojo-app/1'
  learning: ProgressState
  rewards: RewardState
  settings: Settings
  meta: { installId: string; createdAt: string; firstOpenDate: LocalDate; onboarding: Onboarding }
  entitlement: Entitlement // 離線快取；不進匯出碼、iCloud 備份、快照（handoff §2.3）
}

// 快照與備份用：去掉 entitlement，套回時沿用當前的購買狀態。
export type PortableDoc = Omit<AppStateDoc, 'entitlement'>

export function createDoc(installId: string, clock: Clock): AppStateDoc {
  const now = clock(),
    today = localDate(now)
  return {
    schema: 'dojo-app/1',
    learning: defaultState(),
    rewards: initialRewardState(today),
    settings: {
      dailyMinutes: 10,
      sound: true,
      haptics: true,
      appearance: 'system',
      speechRate: 1.0,
      reminder: { enabled: false, time: '20:00', ignoredCount: 0, lastAppOpen: today, askAfter: null },
      reportMode: 'copyCode',
    },
    meta: { installId, createdAt: now.toISOString(), firstOpenDate: today, onboarding: 'notStarted' },
    entitlement: { productId: PRODUCT_ID, owned: false, verifiedAt: '', source: 'storekit' },
  }
}

export const portable = ({ entitlement: _, ...rest }: AppStateDoc): PortableDoc => rest

const str = (v: unknown) => typeof v === 'string'
const bool = (v: unknown) => typeof v === 'boolean'
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const strs = (v: unknown) => Array.isArray(v) && v.every(str)

function validRewards(r: unknown): boolean {
  if (!object(r)) return false
  const c = r.chest,
    a = r.awardedToday
  return (
    num(r.xpTotal) &&
    object(r.xpByDay) &&
    object(a) &&
    str(a.date) &&
    strs(a.keys) &&
    strs(r.firstCorrectPaid) &&
    object(r.maxStage) &&
    object(r.lastMaintenancePaid) &&
    str(r.protectionBaselineDate) &&
    Array.isArray(r.celebratedRanks) &&
    strs(r.goalCompletedDates) &&
    strs(r.protectedDates) &&
    [0, 1, 2].includes(r.protectionCards as number) &&
    object(c) &&
    (c.lastOpenedDate === null || str(c.lastOpenedDate)) &&
    Array.isArray(c.log) &&
    strs(c.ownedCosmetics) &&
    object(c.equipped) &&
    str(r.nameTag)
  )
}

function validSettings(s: unknown): boolean {
  if (!object(s) || !object(s.reminder)) return false
  const r = s.reminder
  return (
    [5, 10, 20].includes(s.dailyMinutes as number) &&
    bool(s.sound) &&
    bool(s.haptics) &&
    ['system', 'light', 'dark'].includes(s.appearance as string) &&
    [0.8, 1.0].includes(s.speechRate as number) &&
    bool(r.enabled) &&
    str(r.time) &&
    num(r.ignoredCount) &&
    str(r.lastAppOpen) &&
    (r.askAfter === null || str(r.askAfter)) &&
    ['copyCode', 'mailto'].includes(s.reportMode as string)
  )
}

// 讀檔、還原備份時的信任邊界：結構不符就當作損毀，不嘗試修補。
export function validPortable(v: unknown): v is PortableDoc {
  if (!object(v) || v.schema !== 'dojo-app/1' || !object(v.meta)) return false
  const m = v.meta
  return (
    validateV5(v.learning) &&
    validRewards(v.rewards) &&
    validSettings(v.settings) &&
    str(m.installId) &&
    str(m.createdAt) &&
    str(m.firstOpenDate) &&
    ['notStarted', 'level', 'minutes', 'placement', 'done'].includes(m.onboarding as string)
  )
}

export function validDoc(v: unknown): v is AppStateDoc {
  if (!object(v) || !validPortable(v)) return false
  const e = (v as Record<string, unknown>).entitlement
  return object(e) && str(e.productId) && bool(e.owned) && str(e.verifiedAt) && e.source === 'storekit'
}
