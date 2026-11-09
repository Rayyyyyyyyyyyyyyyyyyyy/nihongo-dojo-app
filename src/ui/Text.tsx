// 文字：一律用 tokens 的字級與顏色，可隨動態字級縮放（fontScaling）；日文內容標 ja-JP 讓 VoiceOver 用日語讀。
import type { ComponentRef, Ref } from 'react'
import { Text, type TextProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import type { ColorToken, TypeVariant } from '../theme/tokens'

export function AppText({
  variant = 'body',
  color = 'ink',
  ja,
  numeric,
  style,
  ...rest
}: TextProps & { ref?: Ref<ComponentRef<typeof Text>>; variant?: TypeVariant; color?: ColorToken; ja?: boolean; numeric?: boolean }) {
  const t = useTheme()
  return (
    <Text
      {...t.fontScaling(variant)}
      accessibilityLanguage={ja ? 'ja-JP' : undefined}
      style={[t.typeStyle(variant), { color: t.colors[color] }, numeric && { fontVariant: ['tabular-nums'] }, style]}
      {...rest}
    />
  )
}
