// 畫面容器：iOS 自動避開導覽列與分頁列（contentInsetAdjustmentBehavior），外側留白 16pt、內容最大寬 560pt。
import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeProvider'
import { SaveErrorBanner } from './SaveErrorBanner'

export function Screen({ children, modal = false, tone = 'bg' }: { children: ReactNode; modal?: boolean; tone?: 'bg' | 'surfaceCeremony' }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: t.colors[tone] }}
      contentContainerStyle={{
        padding: t.layout.gutter,
        paddingTop: modal ? insets.top + t.space[2] : t.layout.gutter,
        paddingBottom: (modal ? insets.bottom : 0) + t.space[8],
        gap: t.space[4],
        width: '100%',
        maxWidth: t.layout.contentMaxWidth,
        alignSelf: 'center',
      }}
    >
      <SaveErrorBanner />
      <View style={{ gap: t.space[4] }}>{children}</View>
    </ScrollView>
  )
}
