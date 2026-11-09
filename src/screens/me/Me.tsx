// S13 我的：段位與連勝摘要＋S14–S22 的導覽入口（內容由下一個工作實作）。
import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { currentStreak } from '../../state/core'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Card, ListRow, Screen } from '../../ui'
import { useDoc, useNavLock, useToday } from '../hooks'
import { rankProgress } from '../names'

export default function Me() {
  const t = useTheme()
  const doc = useDoc()
  const today = useToday()
  const router = useRouter()
  const go = useNavLock()
  const rank = rankProgress(doc.rewards.xpTotal)
  const firstDay = today === doc.meta.firstOpenDate
  const rows: Array<[string, string, string?]> = [
    ['N3–N1 完整版', firstDay ? '/paywall-explain' : '/paywall', doc.entitlement.owned ? '已擁有' : firstDay ? '明天起可查看' : '未購'],
    ['還原購買', '/restore'],
    ['每日目標與提醒', '/reminders', `${doc.settings.dailyMinutes} 分鐘`],
    ['聲音、觸覺、外觀', '/settings'],
    ['資料與備份', '/backup'],
    ['分享段位卡', '/share'],
    ['回報題目說明', '/report'],
    ['關於與資料來源', '/about'],
  ]
  return (
    <Screen>
      <Card accessibilityLabel={`段位 ${rank.info.name}，累積 ${doc.rewards.xpTotal} XP，連勝 ${currentStreak(doc, today)} 天`}>
        <AppText variant="title2">{rank.info.name}</AppText>
        <AppText color="ink2" numeric>
          累積 {doc.rewards.xpTotal} XP・連勝 {currentStreak(doc, today)} 天・保護卡 {doc.rewards.protectionCards}
        </AppText>
        {doc.rewards.xpTotal === 0 && <AppText color="ink2">第一次修行後就會開始累積</AppText>}
      </Card>
      <View style={{ borderRadius: t.radius.surface, overflow: 'hidden', gap: 1, backgroundColor: t.colors.separator }}>
        {rows.map(([title, href, value]) => (
          <ListRow key={title} title={title} value={value} onPress={() => go(() => router.push(href as never))} />
        ))}
      </View>
    </Screen>
  )
}
