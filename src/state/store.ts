// 單一 store：擁有 AppStateDoc，所有變更經 core.ts 的交易產生完整 next doc 再一次寫入。
// 一般操作先套用記憶體再保存（失敗只亮 saveError 橫條）；匯入／還原／撤銷先存快照與文件，失敗就不套用。
import type { LevelBank } from '../data/bank'
import { localDate } from '../domain/learning/calendar'
import type { ArticleCompletion, Clock, LearningInput } from '../domain/learning/types'
import { importWebV5Code } from '../domain/progress/importCode'
import type { Level } from '../domain/progress/state'
import { MAX_SNAPSHOTS, type AppStorage, type Snapshot } from '../services/storage'
import * as core from './core'
import { createDoc, portable, validPortable, type AppStateDoc, type Onboarding, type PortableDoc, type Settings } from './doc'

export interface AppStoreState {
  status: 'loading' | 'ready' | 'corrupt' // corrupt：原檔保留、不自動覆寫，走 S16 恢復
  doc: AppStateDoc | null // status 為 ready 時一定有值
  snapshots: Snapshot[]
  saveError: boolean // 最近一次保存失敗；記憶體狀態照常有效
}

export type AppStore = ReturnType<typeof createAppStore>

export function createAppStore({ storage, clock, newId }: { storage: AppStorage; clock: Clock; newId: () => string }) {
  let state: AppStoreState = { status: 'loading', doc: null, snapshots: [], saveError: false }
  const listeners = new Set<() => void>()
  const set = (patch: Partial<AppStoreState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }

  // 保存佇列：一次只寫一個，寫的是執行當下最新的文件。
  let saving = Promise.resolve(),
    dirty = false
  const scheduleSave = () => {
    dirty = true
    saving = saving.then(async () => {
      if (!dirty || state.status !== 'ready' || !state.doc) return
      dirty = false
      try {
        await storage.saveDoc(state.doc)
        if (state.saveError) set({ saveError: false })
      } catch {
        set({ saveError: true })
      }
    })
  }
  const commit = (next: AppStateDoc) => {
    if (next === state.doc) return
    set({ doc: next })
    scheduleSave()
  }
  const doc = () => {
    if (state.status !== 'ready' || !state.doc) throw Error('進度尚未載入')
    return state.doc
  }

  async function replace(next: AppStateDoc, reason: Snapshot['reason']) {
    await saving
    const snapshots = state.doc
      ? [...state.snapshots, { at: clock().toISOString(), reason, doc: portable(state.doc) }].slice(-MAX_SNAPSHOTS)
      : state.snapshots
    try {
      if (state.doc) await storage.saveSnapshots(snapshots)
    } catch {
      throw Error('無法建立恢復點，操作已取消，你的進度沒有變動。')
    }
    set({ snapshots })
    try {
      if (state.status === 'corrupt') await storage.preserveCorrupt(clock().toISOString().replace(/[:.]/g, '-'))
      await storage.saveDoc(next)
    } catch {
      throw Error('無法保存，這次操作沒有套用，你的進度沒有變動。')
    }
    set({ status: 'ready', doc: next, saveError: false })
  }
  const today = () => localDate(clock())
  const base = () => state.doc ?? createDoc(newId(), clock)

  return {
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    flush: () => saving,

    async load() {
      const r = await storage.load()
      if (r.status === 'corrupt') return set({ status: 'corrupt', doc: null, snapshots: r.snapshots })
      const loaded = r.status === 'ok' ? r.doc : createDoc(newId(), clock)
      set({ status: 'ready', doc: core.refreshDay(loaded, clock).doc, snapshots: r.snapshots })
      if (r.status === 'empty' || state.doc !== loaded) scheduleSave()
      await saving
    },
    retrySave: () => {
      scheduleSave()
      return saving
    },

    // 學習與獎賞
    submitAnswer(input: LearningInput, bank?: LevelBank) {
      const r = core.submitAnswer(doc(), input, clock, bank)
      commit(r.doc)
      return r.outcome
    },
    completeReading(input: ArticleCompletion, bank: LevelBank) {
      const r = core.completeReading(doc(), input, clock, bank)
      commit(r.doc)
      return r.goalCompleted
    },
    ensurePlan: (branch: 'reading' | 'listening', bank: LevelBank) => commit(core.ensurePlan(doc(), branch, clock, bank)),
    startPlan: () => commit(core.startPlan(doc(), clock)),
    openChest() {
      const r = core.openChest(doc(), clock)
      if (r) commit(r.doc)
      return r?.result ?? null
    },
    // App 啟動與回到前景時呼叫：用保護卡、結算提醒回應。
    refreshDay() {
      if (state.status !== 'ready') return []
      const r = core.refreshDay(doc(), clock)
      commit(r.doc)
      return r.protectedNow
    },

    // 設定與中繼資料
    updateSettings: (patch: Partial<Settings>) => commit({ ...doc(), settings: { ...doc().settings, ...patch } }),
    setLevel: (level: Level) => commit({ ...doc(), learning: { ...doc().learning, level } }),
    setOnboarding: (onboarding: Onboarding) => commit({ ...doc(), meta: { ...doc().meta, onboarding } }),
    // 只由 purchases 服務在 StoreKit 驗證後呼叫。
    setEntitlement(owned: boolean, verifiedAt: string) {
      const d = doc()
      if (d.entitlement.owned === owned && d.entitlement.verifiedAt === verifiedAt) return
      commit({ ...d, entitlement: { ...d.entitlement, owned, verifiedAt } })
    },

    // 覆寫類操作（先快照；失敗丟出使用者可讀的錯誤，狀態不變）
    async importV5(code: string) {
      const learning = importWebV5Code(code) // 無效碼在這裡丟錯，不動任何東西
      await replace(core.applyImport(base(), learning, today()), 'beforeImport')
    },
    async undo(index = state.snapshots.length - 1) {
      const snap = state.snapshots[index]
      if (!snap) throw Error('沒有可用的恢復點。')
      await replace(core.applyRestore(base(), snap.doc, today()), 'beforeUndo')
    },
    async restoreBackup(restored: PortableDoc) {
      if (!validPortable(restored)) throw Error('備份檔無法使用。')
      await replace(core.applyRestore(base(), restored, today()), 'beforeRestore')
    },
    // S16：損毀時從頭開始（原檔另存一份）；購買快取沿用。
    async startFresh() {
      const fresh = createDoc(newId(), clock)
      await replace(state.doc ? { ...fresh, entitlement: state.doc.entitlement } : fresh, 'beforeReset')
    },
  }
}
