// 根堆疊（app-design §2、§4.2）：修行、寶箱、升段用全螢幕模態蓋住分頁列；修行模態停用右滑返回，改用「中止」確認。
// 減少動態時模態改淡入。S12–S22 的路由先以占位畫面保留（由下一個工作實作）。
import { Stack } from 'expo-router'
import { useAppState } from '../state/AppProvider'
import { ThemeProvider, useTheme } from '../theme/ThemeProvider'

// S22 外觀設定：在文件載入後（AppGate 之內）依設定覆寫深淺色。
export function RootNavigator() {
  const appearance = useAppState((s) => s.doc!.settings.appearance)
  return (
    <ThemeProvider appearance={appearance}>
      <RootStack />
    </ThemeProvider>
  )
}

function RootStack() {
  const t = useTheme()
  const modal = { presentation: 'fullScreenModal', animation: t.motion.reduceMotion ? 'fade' : 'slide_from_bottom' } as const
  const fade = { presentation: 'fullScreenModal', animation: 'fade' } as const
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="session" options={{ ...modal, gestureEnabled: false }} />
      <Stack.Screen name="chest" options={{ ...fade, gestureEnabled: false }} />
      <Stack.Screen name="ceremony" options={{ ...fade, gestureEnabled: false }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      <Stack.Screen name="paywall-explain" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
