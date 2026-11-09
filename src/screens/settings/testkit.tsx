// S16–S22 測試替身：記憶體儲存、iCloud、通知、觸覺；固定時鐘。expo-router 由各測試檔 mock 成 routerMock。
import { render } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { createBackup, memoryCloud } from '../../services/backup'
import { createHaptics } from '../../services/haptics'
import { fakeNotifier } from '../../services/notifications'
import { createPurchases, fakeStoreGateway } from '../../services/purchases'
import { createSpeech } from '../../services/speech'
import { createAppStorage, memoryFiles } from '../../services/storage'
import { AppProvider, type AppServices } from '../../state/AppProvider'
import { PRODUCT_ID } from '../../state/doc'
import { createAppStore } from '../../state/store'
import { fixtureBank, fixtureManifest } from '../../test/fixtures'

export const NOW = new Date(2026, 10, 9, 12)

export async function setup(files = memoryFiles()) {
  const clock = () => NOW
  const store = createAppStore({ storage: createAppStorage(files), clock, newId: () => 'id' })
  const cloud = memoryCloud()
  const notifier = fakeNotifier('undetermined')
  const hapticCalls: string[] = []
  const sound = { play: jest.fn() }
  const services: AppServices = {
    clock,
    store,
    purchases: createPurchases(fakeStoreGateway(), { productId: PRODUCT_ID, setEntitlement: () => {}, now: clock }),
    backup: createBackup(cloud, { appVersion: '1.0.0', contentVersion: 'c-test', now: clock }),
    notifier,
    speech: createSpeech({ speak: () => {}, stop: async () => {}, getAvailableVoicesAsync: async () => [] }),
    haptics: createHaptics(() => store.getState().doc?.settings.haptics ?? false, {
      notificationAsync: async () => void hapticCalls.push('notification'),
      impactAsync: async () => void hapticCalls.push('impact'),
      selectionAsync: async () => void hapticCalls.push('selection'),
    }),
    sound,
    bank: { manifest: fixtureManifest, load: fixtureBank },
  }
  await store.load()
  // AppProvider 掛載時會再 load 一次；先載入讓畫面一開始就是 ready（或 corrupt）。
  const show = (el: ReactElement) => render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <AppProvider services={services}>{el}</AppProvider>
      </SafeAreaProvider>,
    )
  return { services, store, cloud, notifier, files, hapticCalls, sound, show }
}
