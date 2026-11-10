// 把單一 store 與服務交給畫面：useAppState(selector) 訂閱文件，useServices() 取動作與原生服務。
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { AppState } from 'react-native'
import type { LevelBank } from '../data/bank'
import type { BankManifest } from '../domain/bank/manifest'
import type { Level } from '../domain/progress/state'
import type { createBackup } from '../services/backup'
import type { createHaptics } from '../services/haptics'
import { syncReminders, type Notifier } from '../services/notifications'
import type { createPurchases } from '../services/purchases'
import type { SoundService } from '../services/sound'
import type { SpeechService } from '../services/speech'
import type { Clock } from '../domain/learning/types'
import { reminderBody } from '../domain/reminder'
import { plannedReminders } from './core'
import type { AppStore, AppStoreState } from './store'

export interface AppServices {
  clock: Clock
  store: AppStore
  purchases: ReturnType<typeof createPurchases>
  backup: ReturnType<typeof createBackup>
  notifier: Notifier
  speech: SpeechService
  haptics: ReturnType<typeof createHaptics>
  sound: SoundService
  // 內建題庫：真實實作同步載入（失敗丟錯，畫面顯示「題庫載入失敗」＋重試）；測試用替身題庫。
  bank: { manifest: BankManifest; load(level: Level): LevelBank | Promise<LevelBank> }
}

const Ctx = createContext<AppServices | null>(null)

export function AppProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  useEffect(() => {
    let stop: (() => void) | undefined,
      alive = true,
      started = false,
      lastKey = ''
    const { store, purchases, notifier, clock } = services
    // 只在提醒的排程或文案會改變時重排（作答、完成今日目標、改設定），不是每次 store 變更都呼叫 notifier。
    const sync = (force: boolean) => {
      const doc = store.getState().doc!
      const key = JSON.stringify([plannedReminders(doc, clock), reminderBody(doc.settings.dailyMinutes)])
      if (!force && key === lastKey) return
      lastKey = key
      void syncReminders(notifier, doc, clock)
    }
    // 第一次 ready（正常載入，或損毀後經 S16 還原／從頭開始）才啟動 StoreKit 監聽。
    const onStore = () => {
      if (!alive || store.getState().status !== 'ready') return
      if (started) return sync(false)
      started = true
      sync(true)
      // StoreKit 連線失敗不影響學習；購買畫面會自己重試載入商品。
      void purchases.start().then(
        (off) => (alive ? (stop = off) : off()),
        () => undefined,
      )
    }
    const unsub = store.subscribe(onStore)
    const onActive = () => {
      if (store.getState().status !== 'ready') return
      store.refreshDay()
      void purchases.refresh()
      sync(true)
    }
    void store.load().then(onStore)
    const sub = AppState.addEventListener('change', (s) => s === 'active' && onActive())
    return () => {
      alive = false
      unsub()
      sub.remove()
      stop?.()
    }
  }, [services])
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>
}

export function useServices(): AppServices {
  const s = useContext(Ctx)
  if (!s) throw Error('useServices 必須在 AppProvider 之內')
  return s
}

export function useAppState<T>(select: (s: AppStoreState) => T): T {
  const { store } = useServices()
  return useSyncExternalStore(store.subscribe, () => select(store.getState()))
}

export function usePurchaseFlow() {
  const { purchases } = useServices()
  return useSyncExternalStore(purchases.subscribe, purchases.getFlow)
}

export function usePurchaseCheck() {
  const { purchases } = useServices()
  return useSyncExternalStore(purchases.subscribe, purchases.getCheck)
}
