// S12–S15 畫面測試替身：假時鐘（time.now 可推進）、記憶體儲存、假 StoreKit、小題庫；用 expo-router 記憶體路由。
import { Stack } from 'expo-router'
import { renderRouter } from 'expo-router/testing-library'
import type { ComponentType } from 'react'
import { Text } from 'react-native'
import type { LevelBank } from '../data/bank'
import type { Level } from '../domain/progress/state'
import { createBackup, memoryCloud } from '../services/backup'
import { createHaptics } from '../services/haptics'
import { fakeNotifier } from '../services/notifications'
import { createPurchases, fakeStoreGateway } from '../services/purchases'
import { createSpeech } from '../services/speech'
import { createAppStorage, memoryFiles } from '../services/storage'
import { AppGate } from '../state/AppGate'
import { AppProvider, type AppServices } from '../state/AppProvider'
import { createDoc, PRODUCT_ID, type AppStateDoc } from '../state/doc'
import { createAppStore } from '../state/store'
import { ThemeProvider } from '../theme/ThemeProvider'
import { fixtureBank, fixtureManifest } from './fixtures'

export const NOW = new Date(2026, 10, 9, 12)
export const DAY2 = new Date(2026, 10, 10, 12) // 安裝後第二天

export function readyDoc(patch: (d: AppStateDoc) => AppStateDoc = (d) => d): AppStateDoc {
  const d = createDoc('install-1', () => NOW)
  return patch({ ...d, learning: { ...d.learning, level: 'n5' }, meta: { ...d.meta, onboarding: 'done' } })
}

export function makeServices(
  o: { doc?: AppStateDoc; now?: Date; gateway?: ReturnType<typeof fakeStoreGateway>; load?: (l: Level) => LevelBank | Promise<LevelBank> } = {},
) {
  const time = { now: new Date(o.now ?? NOW) }
  const clock = () => new Date(time.now)
  const files = memoryFiles({ 'app-state.json': JSON.stringify(o.doc ?? readyDoc()) })
  const store = createAppStore({ storage: createAppStorage(files), clock, newId: () => 'install-1' })
  const gateway = o.gateway ?? fakeStoreGateway()
  const services: AppServices = {
    clock,
    store,
    purchases: createPurchases(gateway, { productId: PRODUCT_ID, setEntitlement: (ow, at) => store.setEntitlement(ow, at), now: clock }),
    backup: createBackup(memoryCloud(), { appVersion: '1', contentVersion: 'c', now: clock }),
    notifier: fakeNotifier(),
    speech: createSpeech({ speak: () => {}, stop: async () => {}, getAvailableVoicesAsync: async () => [] }),
    haptics: createHaptics(() => false),
    sound: { play: () => {} },
    bank: { manifest: fixtureManifest, load: o.load ?? fixtureBank },
  }
  return { services, time, store, gateway }
}

const stub = (name: string) => () => <Text>占位 {name}</Text>

export function renderScreens(s: ReturnType<typeof makeServices>, screens: Record<string, ComponentType>, initialUrl: string) {
  const Root = () => (
    <ThemeProvider>
      <AppProvider services={s.services}>
        <AppGate>
          <Stack screenOptions={{ headerShown: false }} />
        </AppGate>
      </AppProvider>
    </ThemeProvider>
  )
  const others = ['index', 'practice', 'practice/vocab', 'session', 'paywall', 'restore', 'backup', 'import', 'reminders', 'settings', 'about', 'report', 'share']
  return renderRouter({ _layout: Root, ...Object.fromEntries(others.map((n) => [n, stub(n)])), ...screens } as never, { initialUrl })
}
