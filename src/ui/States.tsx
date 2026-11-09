// 等待／空結果／錯誤三種狀態（app-design §6 共用規則）：本機操作 <300ms 不顯示載入，之後才顯示靜態骨架；
// 錯誤寫在卡片內並附下一步。
import { useEffect, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { Button } from './Button'
import { Card } from './Card'
import { AppText } from './Text'

export const SKELETON_DELAY_MS = 300

export function Skeleton({ rows = 3, label = '載入中' }: { rows?: number; label?: string }) {
  const t = useTheme()
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setShown(true), SKELETON_DELAY_MS)
    return () => clearTimeout(id)
  }, [])
  if (!shown) return null
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={{ gap: t.space[3] }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height: i === 0 ? 96 : 52, borderRadius: t.radius.surface, backgroundColor: t.colors.surface2 }} />
      ))}
    </View>
  )
}

export function EmptyState({ title, message, children }: { title: string; message?: string; children?: ReactNode }) {
  return (
    <Card>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      {message && <AppText color="ink2">{message}</AppText>}
      {children}
    </Card>
  )
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = '重試',
  children,
}: {
  title: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  children?: ReactNode
}) {
  return (
    <Card tone="wrongBg" accessibilityRole="alert">
      <AppText variant="headline">{title}</AppText>
      {message && <AppText>{message}</AppText>}
      {onRetry && <Button variant="secondary" label={retryLabel} onPress={onRetry} />}
      {children}
    </Card>
  )
}
