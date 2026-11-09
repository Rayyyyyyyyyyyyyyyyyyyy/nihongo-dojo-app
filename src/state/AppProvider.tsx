// 把單一 store 與服務交給畫面：useAppState(selector) 訂閱文件，useServices() 取動作與原生服務。
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { AppState } from 'react-native'
import type { createBackup } from '../services/backup'
import type { createHaptics } from '../services/haptics'
import { syncReminders, type Notifier } from '../services/notifications'
import type { createPurchases } from '../services/purchases'
import type { SpeechService } from '../services/speech'
import type { Clock } from '../domain/learning/types'
import type { AppStore, AppStoreState } from './store'

export interface AppServices {
  clock: Clock
  store: AppStore
  purchases: ReturnType<typeof createPurchases>
  backup: ReturnType<typeof createBackup>
  notifier: Notifier
  speech: SpeechService
  haptics: ReturnType<typeof createHaptics>
}

const Ctx = createContext<AppServices | null>(null)

export function AppProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  useEffect(() => {
    let stop: (() => void) | undefined,
      alive = true
    const { store, purchases, notifier, clock } = services
    const onActive = () => {
      if (store.getState().status !== 'ready') return
      store.refreshDay()
      void purchases.refresh()
      void syncReminders(notifier, store.getState().doc!, clock)
    }
    void store.load().then(async () => {
      if (!alive || store.getState().status !== 'ready') return
      void syncReminders(notifier, store.getState().doc!, clock)
      // StoreKit 連線失敗不影響學習；購買畫面會自己重試載入商品。
      stop = await purchases.start().catch(() => undefined)
    })
    const sub = AppState.addEventListener('change', (s) => s === 'active' && onActive())
    return () => {
      alive = false
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
