// UI 測試替身：假時鐘、記憶體儲存、假 StoreKit、假語音與觸覺、小題庫；用真實路由元件組成 expo-router 的記憶體路由。
import { renderRouter } from 'expo-router/testing-library'
import type { ComponentType } from 'react'
import type { LevelBank } from '../data/bank'
import type { Level } from '../domain/progress/state'
import { RootNavigator } from '../screens/RootNavigator'
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

// 已完成首次體驗、N5 的文件（可再覆寫）。
export function readyDoc(patch: (d: AppStateDoc) => AppStateDoc = (d) => d, at = NOW): AppStateDoc {
  const d = createDoc('install-1', () => at)
  return patch({ ...d, learning: { ...d.learning, level: 'n5' }, meta: { ...d.meta, onboarding: 'done' } })
}

export function makeServices(o: { doc?: AppStateDoc; voices?: string[]; load?: (l: Level) => LevelBank | Promise<LevelBank>; now?: Date } = {}) {
  const time = { now: new Date(o.now ?? NOW) }
  const clock = () => new Date(time.now)
  const files = memoryFiles(o.doc ? { 'app-state.json': JSON.stringify(o.doc) } : {})
  const store = createAppStore({ storage: createAppStorage(files), clock, newId: () => 'install-1' })
  const spoken: string[] = []
  const speechEngine = {
    speak: jest.fn((text: string, opts: { onStart?: () => void }) => {
      spoken.push(text)
      opts.onStart?.()
    }),
    stop: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    resume: jest.fn(async () => {}),
    getAvailableVoicesAsync: async () => (o.voices ?? ['ja-JP']).map((language, i) => ({ identifier: `v${i}`, language })),
  }
  const hapticsEngine = { notificationAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), selectionAsync: jest.fn(async () => {}) }
  const sound = { play: jest.fn() }
  const services: AppServices = {
    clock,
    store,
    purchases: createPurchases(fakeStoreGateway(), { productId: PRODUCT_ID, setEntitlement: (ow, at) => store.setEntitlement(ow, at), now: clock }),
    backup: createBackup(memoryCloud(), { appVersion: '1', contentVersion: 'c', now: clock }),
    notifier: fakeNotifier(),
    speech: createSpeech(speechEngine),
    haptics: createHaptics(() => store.getState().doc?.settings.haptics ?? false, hapticsEngine),
    sound,
    bank: { manifest: fixtureManifest, load: o.load ?? fixtureBank },
  }
  return { services, time, files, store, spoken, speechEngine, hapticsEngine, sound }
}

import Tabs from '../app/(tabs)/_layout'
import TabStack from '../app/(tabs)/(dojo)/_layout'
import DojoRoute from '../app/(tabs)/(dojo)/index'
import ReviewRoute from '../app/(tabs)/(dojo)/review'
import PracticeRoute from '../app/(tabs)/practice/index'
import VocabRoute from '../app/(tabs)/practice/vocab'
import Session from '../screens/session/Session'
import Chest from '../screens/rewards/Chest'
import Ceremony from '../screens/rewards/Ceremony'
import Onboarding from '../screens/onboarding/Onboarding'
import { Text } from 'react-native'

const stub = (name: string) => () => <Text>占位 {name}</Text>

// 原生分頁在 jest 中會同時掛載所有分頁；tab 指定哪個分頁用真實畫面，另一個以占位代替，避免查詢重複。
export async function renderApp(s: ReturnType<typeof makeServices>, initialUrl = '/', tab: 'dojo' | 'practice' = 'dojo') {
  const Root = () => (
    <ThemeProvider>
      <AppProvider services={s.services}>
        <AppGate>
          <RootNavigator />
        </AppGate>
      </AppProvider>
    </ThemeProvider>
  )
  const routes: Record<string, ComponentType> = {
    _layout: Root,
    '(tabs)/_layout': Tabs,
    '(tabs)/(dojo)/_layout': TabStack,
    '(tabs)/(dojo)/index': tab === 'dojo' ? DojoRoute : stub('道場'),
    '(tabs)/(dojo)/review': ReviewRoute,
    '(tabs)/practice/_layout': TabStack,
    '(tabs)/practice/index': tab === 'practice' ? PracticeRoute : stub('修行'),
    '(tabs)/practice/vocab': VocabRoute,
    '(tabs)/collection': stub('收集冊'),
    '(tabs)/me': stub('我的'),
    onboarding: Onboarding,
    session: Session,
    chest: Chest,
    ceremony: Ceremony,
    ...Object.fromEntries(['paywall', 'paywall-explain', 'restore', 'backup', 'import', 'reminders', 'about', 'report', 'share', 'settings'].map((n) => [n, stub(n)])),
  }
  return renderRouter(routes as never, { initialUrl })
}
