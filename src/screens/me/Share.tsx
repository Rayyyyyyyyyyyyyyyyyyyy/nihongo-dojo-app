// S21 分享段位卡：卡片只含段位、帶色、連勝與 App 名稱（不含付費訊息），交給系統分享面板；不上傳、不給 XP。
// shortcut: 分享的是文字，不是卡片圖片（尚未安裝擷取畫面成圖的套件）。
import { Stack } from 'expo-router'
import { useRef, useState } from 'react'
import { Share as RNShare, View } from 'react-native'
import { currentStreak } from '../../state/core'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, ErrorState, Screen } from '../../ui'
import { useDoc, useToday } from '../hooks'
import { rankProgress } from '../names'

export default function Share() {
  const t = useTheme()
  const doc = useDoc()
  const streak = currentStreak(doc, useToday())
  const { info } = rankProgress(doc.rewards.xpTotal)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const open = useRef(false) // 連點只開一個分享面板
  const message = `日本語道場｜${info.name}${streak > 0 ? `・連勝 ${streak} 天` : ''}`
  const share = async () => {
    if (open.current) return
    open.current = true
    setBusy(true)
    setFailed(false)
    try {
      await RNShare.share({ message }) // 使用者取消（dismissedAction）不顯示訊息
    } catch {
      setFailed(true)
    } finally {
      open.current = false
      setBusy(false)
    }
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '分享段位卡' }} />
      <Screen>
        <Card accessible accessibilityLabel={`段位卡：${info.name}${streak > 0 ? `，連勝 ${streak} 天` : ''}，日本語道場`}>
          <View style={{ height: 24, borderRadius: t.radius.chip, borderWidth: 1.5, borderColor: t.colors.outline, backgroundColor: t.belt[info.belt], flexDirection: 'row', justifyContent: 'flex-end', gap: 4, paddingHorizontal: t.space[3] }}>
            {Array.from({ length: info.stripes }, (_, i) => (
              <View key={i} style={{ width: 6, backgroundColor: t.belt.stripe }} />
            ))}
          </View>
          <AppText variant="title2">{info.name}</AppText>
          {streak > 0 && <AppText numeric>連勝 {streak} 天</AppText>}
          <AppText color="ink2">日本語道場</AppText>
        </Card>
        {failed && <ErrorState title="無法開啟分享面板" message="請再試一次。" onRetry={share} />}
        <Button label="分享" loading={busy} onPress={() => void share()} />
      </Screen>
    </>
  )
}
