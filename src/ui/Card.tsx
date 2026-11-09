// 卡片：surface 色階、6pt 角、無陰影無框（visual-system §4.3）；可點時按下變 surface2。
import { Pressable, View, type ViewProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

export function Card({
  onPress,
  tone = 'surface',
  style,
  children,
  ...rest
}: ViewProps & { onPress?: () => void; tone?: 'surface' | 'surface2' | 'wrongBg' | 'warnBg' | 'correctBg' }) {
  const t = useTheme()
  const base = { backgroundColor: t.colors[tone], borderRadius: t.radius.surface, padding: t.layout.cardPadding, gap: t.space[3] }
  if (!onPress)
    return (
      <View style={[base, style]} {...rest}>
        {children}
      </View>
    )
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [base, { minHeight: t.layout.listRowMinHeight }, pressed && { backgroundColor: t.colors.surface2 }, style]}
      {...rest}
    >
      {children}
    </Pressable>
  )
}
