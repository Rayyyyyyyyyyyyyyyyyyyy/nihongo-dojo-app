// 真實服務的組裝（只由 src/app/_layout.tsx 匯入；測試用各服務的替身自行組裝）。
import Constants from 'expo-constants'
import { randomUUID } from 'expo-crypto'
import { bankManifest } from '../data/bank'
import { systemClock } from '../domain/learning/types'
import type { AppServices } from '../state/AppProvider'
import { PRODUCT_ID } from '../state/doc'
import { createAppStore } from '../state/store'
import { createBackup } from './backup'
import { iCloudPort } from './backupICloud'
import { createHaptics } from './haptics'
import { expoNotifier } from './notifications'
import { createPurchases } from './purchases'
import { storeKitGateway } from './purchasesStoreKit'
import { createSpeech } from './speech'
import { createAppStorage, expoFiles } from './storage'

export function createAppServices(): AppServices {
  const clock = systemClock
  const store = createAppStore({ storage: createAppStorage(expoFiles()), clock, newId: randomUUID })
  return {
    clock,
    store,
    purchases: createPurchases(storeKitGateway, {
      productId: PRODUCT_ID,
      setEntitlement: (owned, at) => store.getState().status === 'ready' && store.setEntitlement(owned, at),
      now: clock,
    }),
    backup: createBackup(iCloudPort, {
      appVersion: Constants.expoConfig?.version ?? '',
      contentVersion: bankManifest.contentVersion,
      now: clock,
    }),
    notifier: expoNotifier,
    speech: createSpeech(),
    haptics: createHaptics(() => store.getState().doc?.settings.haptics ?? false),
  }
}
