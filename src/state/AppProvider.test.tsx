import { act, render, screen, waitFor } from '@testing-library/react-native'
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
import { createDoc, PRODUCT_ID } from './doc'
import { createAppStore } from './store'

const clock = () => new Date(2026, 10, 9, 12)
function services(files = memoryFiles(), gateway = fakeStoreGateway(), notifier = fakeNotifier()): AppServices {
  const store = createAppStore({ storage: createAppStorage(files), clock, newId: () => 'id' })
  return {
    clock,
    store,
    purchases: createPurchases(gateway, { productId: PRODUCT_ID, setEntitlement: (o, at) => store.setEntitlement(o, at), now: clock }),
    backup: createBackup(memoryCloud(), { appVersion: '1', contentVersion: 'c', now: clock }),
    notifier,
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

test('F3：損毀資料在 S16 從頭開始後，啟動 StoreKit（不必重開 App）', async () => {
  const gateway = fakeStoreGateway({ owned: [PRODUCT_ID] })
  const connect = jest.spyOn(gateway, 'connect')
  const s = services(memoryFiles({ 'app-state.json': 'garbage' }), gateway)
  await render(
    <AppProvider services={s}>
      <AppGate>
        <Xp />
      </AppGate>
    </AppProvider>,
  )
  await screen.findByText('進度資料無法讀取，已保留原始資料。')
  expect(connect).not.toHaveBeenCalled()
  await act(() => s.store.startFresh())
  expect(await screen.findByText('XP 0')).toBeTruthy()
  await waitFor(() => expect(s.store.getState().doc?.entitlement.owned).toBe(true))
  expect(connect).toHaveBeenCalledTimes(1)
})

test('F2：作答讓今天算已練習後重排提醒，今天的提醒取消；之後的作答不再呼叫 notifier', async () => {
  const d = createDoc('id', clock)
  const doc = {
    ...d,
    learning: { ...d.learning, lastDate: '2026-11-08', streak: 3 },
    settings: { ...d.settings, reminder: { ...d.settings.reminder, enabled: true, time: '20:00' } },
  }
  const notifier = fakeNotifier()
  const replaceAll = jest.spyOn(notifier, 'replaceAll')
  const s = services(memoryFiles({ 'app-state.json': JSON.stringify(doc) }), fakeStoreGateway(), notifier)
  await render(
    <AppProvider services={s}>
      <AppGate>
        <Xp />
      </AppGate>
    </AppProvider>,
  )
  await screen.findByText(/XP/)
  const todayAt8 = new Date(2026, 10, 9, 20).getTime()
  await waitFor(() => expect(notifier.scheduled.map((x) => x.t.getTime())).toContain(todayAt8))
  const ref = { level: 'n5', kind: 'vocab', id: '水' } as const
  await act(async () => void s.store.submitAnswer({ attemptId: 'a1', ref, mode: 'flashcard', correct: true }))
  await waitFor(() => expect(notifier.scheduled.map((x) => x.t.getTime())).not.toContain(todayAt8))
  expect(notifier.scheduled.length).toBeGreaterThan(0) // 之後幾天照常
  const calls = replaceAll.mock.calls.length
  await act(async () => void s.store.submitAnswer({ attemptId: 'a2', ref: { ...ref, id: '山' }, mode: 'flashcard', correct: true }))
  await s.store.flush()
  expect(replaceAll).toHaveBeenCalledTimes(calls)
})
