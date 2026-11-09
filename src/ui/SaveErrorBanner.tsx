// 保存失敗橫條（app-design §6 共用規則）：練習在記憶體繼續；點擊進 S16 資料與備份。進入畫面時 VoiceOver 公告一次。
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { AccessibilityInfo, Pressable } from 'react-native'
import { useAppState } from '../state/AppProvider'
import { useTheme } from '../theme/ThemeProvider'
import { AppText } from './Text'

export const SAVE_ERROR_TEXT = '進度暫時沒有保存。請到「我的 → 資料與備份」匯出進度碼。'

export function SaveErrorBanner() {
  const failed = useAppState((s) => s.saveError)
  const router = useRouter()
  const t = useTheme()
  useEffect(() => {
    if (failed) AccessibilityInfo.announceForAccessibility(SAVE_ERROR_TEXT)
  }, [failed])
  if (!failed) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={SAVE_ERROR_TEXT}
      accessibilityHint="前往資料與備份"
      onPress={() => router.push('/backup')}
      style={{ backgroundColor: t.colors.warnBg, borderRadius: t.radius.surface, padding: t.space[3], minHeight: t.layout.touchTargetMin }}
    >
      <AppText variant="callout">{SAVE_ERROR_TEXT}</AppText>
    </Pressable>
  )
}
