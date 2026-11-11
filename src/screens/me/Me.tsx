// S13 我的（app-design §2、§6 S13）：段位與連勝摘要＋S14–S22 的導覽入口與隱私政策連結；只顯示推導值，沒有自己的暫態；購買狀態查詢中／失敗的提示來自 purchases 服務。
import { useRouter } from 'expo-router'
import { Linking, View } from 'react-native'
import { currentStreak } from '../../state/core'
import { usePurchaseCheck } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Belt, Card, ListRow, Screen } from '../../ui'
import { useDoc, useNavLock, useToday } from '../hooks'
import { rankProgress } from '../names'
import { PRIVACY_URL } from '../paywall/Paywall'

export default function Me() {
  const t = useTheme()
  const doc = useDoc()
  const today = useToday()
  const router = useRouter()
  const go = useNavLock()
  const check = usePurchaseCheck()
  const rank = rankProgress(doc.rewards.xpTotal)
  const firstDay = today === doc.meta.firstOpenDate
  const monthStamps = doc.rewards.goalCompletedDates.filter((d) => d.slice(0, 7) === today.slice(0, 7)).length
  const rows: Array<[string, string, string?]> = [
    ['N3–N1 完整版', firstDay ? '/paywall-explain' : '/paywall', doc.entitlement.owned ? '已擁有' : firstDay ? '明天起可查看' : '未購'],
    ['還原購買', '/restore'],
    ['每日目標與提醒', '/reminders', `${doc.settings.dailyMinutes} 分鐘`],
    ['聲音、觸覺、外觀', '/settings'],
    ['資料與備份', '/backup'],
    ['分享段位卡', '/share'],
    ['回報題目說明', '/report'],
    ['隱私政策', PRIVACY_URL],
    ['關於與資料來源', '/about'],
  ]
  return (
    <Screen>
      <Card accessibilityLabel={`段位 ${rank.info.name}，累積 ${doc.rewards.xpTotal} XP，連勝 ${currentStreak(doc, today)} 天，保護卡 ${doc.rewards.protectionCards} 張，本月修行印 ${monthStamps} 個`}>
        <AppText variant="title2">{rank.info.name}</AppText>
        <Belt rank={rank.rank} />
        <AppText color="ink2" numeric>
          累積 {doc.rewards.xpTotal} XP・連勝 {currentStreak(doc, today)} 天・保護卡 {doc.rewards.protectionCards}・本月修行印 {monthStamps}
        </AppText>
        {doc.rewards.xpTotal === 0 && <AppText color="ink2">第一次修行後就會開始累積</AppText>}
      </Card>
      <View style={{ borderRadius: t.radius.surface, overflow: 'hidden', gap: 1, backgroundColor: t.colors.separator }}>
        {rows.map(([title, href, value]) => (
          <ListRow
            key={title}
            title={title}
            value={value}
            hint={href === PRIVACY_URL ? '在瀏覽器開啟' : undefined}
            onPress={() => (href === PRIVACY_URL ? void Linking.openURL(href) : go(() => router.push(href as never)))}
          />
        ))}
      </View>
      {check === 'checking' && <AppText color="ink2">完整版購買狀態確認中</AppText>}
      {check === 'failed' && <AppText color="ink2">目前無法連線 App Store，顯示上次結果</AppText>}
    </Screen>
  )
}
