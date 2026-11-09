// 按鈕（visual-system §4.3）：主／次為 50pt 膠囊，文字按鈕觸控區 ≥44pt；進行中保留原文字並顯示系統指示器。
import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { AppText } from './Text'

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive'

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  ...rest
}: Omit<PressableProps, 'children' | 'style'> & { label: string; variant?: ButtonVariant; loading?: boolean }) {
  const t = useTheme()
  const off = disabled || loading
  const bg = off && variant !== 'text' ? 'surface2' : variant === 'primary' ? 'primary' : variant === 'text' ? undefined : 'surface2'
  const fg = off ? 'inkDisabled' : variant === 'primary' ? 'onPrimary' : variant === 'destructive' ? 'wrong' : 'primary'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      hitSlop={variant === 'text' ? 4 : undefined}
      style={({ pressed }) => [
        {
          minHeight: variant === 'text' ? t.layout.touchTargetMin : t.layout.buttonHeight,
          minWidth: t.layout.touchTargetMin,
          borderRadius: t.radius.button,
          paddingHorizontal: variant === 'text' ? t.space[2] : t.space[5],
          paddingVertical: t.space[2],
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg && t.colors[pressed && variant === 'primary' ? 'primaryPressed' : bg],
        },
        pressed && variant === 'text' && { opacity: 0.6 },
        pressed && variant !== 'text' && !t.motion.reduceMotion && { transform: [{ scale: 0.98 }] },
      ]}
      {...rest}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
        {loading && <ActivityIndicator color={t.colors.inkDisabled} />}
        <AppText variant="headline" color={fg} style={{ textAlign: 'center' }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  )
}
