// 分段選擇（等級 N5–N1、類別）：每段是 ≥44pt 的按鈕並帶 selected 狀態。沒有原生 segmented control 套件，
// shortcut: 自製外觀，若加入 @react-native-segmented-control 再換成系統元件。
import { Pressable, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { AppText } from './Text'

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string; a11y?: string }>
  value: T
  onChange: (v: T) => void
  label: string
}) {
  const t = useTheme()
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: t.colors.surface2, borderRadius: t.radius.chip, padding: 2 }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={o.a11y ?? o.label}
            accessibilityState={{ selected: on }}
            onPress={() => !on && onChange(o.value)}
            style={{
              flexGrow: 1,
              minWidth: t.layout.touchTargetMin,
              minHeight: t.layout.touchTargetMin,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: t.radius.chip,
              backgroundColor: on ? t.colors.surface : 'transparent',
              paddingHorizontal: t.space[2],
            }}
          >
            <AppText variant="headline" color={on ? 'primary' : 'ink2'}>
              {o.label}
            </AppText>
          </Pressable>
        )
      })}
    </View>
  )
}
