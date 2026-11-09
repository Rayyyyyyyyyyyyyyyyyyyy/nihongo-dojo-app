import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { createBackup, memoryCloud } from '../services/backup'
import { createHaptics } from '../services/haptics'
import { fakeNotifier } from '../services/notifications'
import { createPurchases, fakeStoreGateway } from '../services/purchases'
import { silentSound } from '../services/sound'
import { createSpeech } from '../services/speech'
import { fixtureBank, fixtureManifest } from '../test/fixtures'
import { createAppStorage, memoryFiles } from '../services/storage'
import { AppGate } from './AppGate'
import { AppProvider, useAppState, type AppServices } from './AppProvider'
import { PRODUCT_ID } from './doc'
import { createAppStore } from './store'

const clock = () => new Date(2026, 10, 9, 12)
function services(files = memoryFiles(), gateway = fakeStoreGateway()): AppServices {
  const store = createAppStore({ storage: createAppStorage(files), clock, newId: () => 'id' })
  return {
    clock,
    store,
    purchases: createPurchases(gateway, { productId: PRODUCT_ID, setEntitlement: (o, at) => store.setEntitlement(o, at), now: clock }),
    backup: createBackup(memoryCloud(), { appVersion: '1', contentVersion: 'c', now: clock }),
    notifier: fakeNotifier(),
    speech: createSpeech({ speak: () => {}, stop: async () => {}, getAvailableVoicesAsync: async () => [] }),
    haptics: createHaptics(() => false),
    sound: silentSound,
    bank: { manifest: fixtureManifest, load: fixtureBank },
  }
}
function Xp() {
  const xp = useAppState((s) => s.doc?.rewards.xpTotal)
  return <Text>XP {xp}</Text>
}

test('載入完成後顯示內容並可讀取 store；StoreKit 已擁有時寫入 entitlement 快取', async () => {
  const s = services(memoryFiles(), fakeStoreGateway({ owned: [PRODUCT_ID] }))
  await render(
    <AppProvider services={s}>
      <AppGate>
        <Xp />
      </AppGate>
    </AppProvider>,
  )
  expect(await screen.findByText('XP 0')).toBeTruthy()
  await s.store.flush()
  expect(s.store.getState().doc?.entitlement.owned).toBe(true)
})

test('進度文件損毀：顯示已保留原始資料，不渲染內容', async () => {
  const s = services(memoryFiles({ 'app-state.json': 'garbage' }))
  await render(
    <AppProvider services={s}>
      <AppGate>
        <Xp />
      </AppGate>
    </AppProvider>,
  )
  expect(await screen.findByText('進度資料無法讀取，已保留原始資料。')).toBeTruthy()
  expect(screen.queryByText(/XP/)).toBeNull()
})
