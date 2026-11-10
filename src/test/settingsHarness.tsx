// S16／S17 測試替身：沿用 harness 的 makeServices，換上可操作的記憶體 iCloud，路由只放這兩個畫面與首次體驗。
import { Stack } from 'expo-router'
import { renderRouter } from 'expo-router/testing-library'
import { Text } from 'react-native'
import Onboarding from '../screens/onboarding/Onboarding'
import Backup from '../screens/settings/Backup'
import Import from '../screens/settings/Import'
import { createBackup, memoryCloud } from '../services/backup'
import { AppGate } from '../state/AppGate'
import { AppProvider } from '../state/AppProvider'
import { ThemeProvider } from '../theme/ThemeProvider'
import { makeServices } from './harness'

export function settingsServices(o: Parameters<typeof makeServices>[0] = {}) {
  const s = makeServices(o)
  const cloud = memoryCloud()
  s.services.backup = createBackup(cloud, { appVersion: '1', contentVersion: 'c', now: s.services.clock })
  return { ...s, cloud }
}

export function renderSettings(s: ReturnType<typeof settingsServices>, initialUrl: string) {
  const Root = () => (
    <ThemeProvider>
      <AppProvider services={s.services}>
        <AppGate>
          <Stack screenOptions={{ headerShown: false }} />
        </AppGate>
      </AppProvider>
    </ThemeProvider>
  )
  return renderRouter({ _layout: Root, index: () => <Text>占位 首頁</Text>, backup: Backup, import: Import, onboarding: Onboarding } as never, { initialUrl })
}
