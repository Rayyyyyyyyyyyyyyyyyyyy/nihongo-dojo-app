// 設定開關列：標題＋系統 Switch（≥52pt）；旁註（例如「通知權限已關閉」）寫在標題下方。
import { Switch, View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText } from '../../ui'

export function SwitchRow({ title, value, onChange, note }: { title: string; value: boolean; onChange: (v: boolean) => void; note?: string }) {
  const t = useTheme()
  return (
    <View style={{ minHeight: t.layout.listRowMinHeight, flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
      <View style={{ flex: 1 }}>
        <AppText>{title}</AppText>
        {note && <AppText variant="footnote" color="ink2">{note}</AppText>}
      </View>
      <Switch accessibilityLabel={title} accessibilityHint={note} value={value} onValueChange={onChange} trackColor={{ true: t.colors.primary }} />
    </View>
  )
}
