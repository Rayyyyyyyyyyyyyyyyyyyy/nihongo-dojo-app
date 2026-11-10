// S5 開寶箱（桐箱）：結果先寫入文件再播 0.8 秒動畫（減少動態時直接顯示內容）；同一天再進來只顯示今天拿到的內容。
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, View } from 'react-native'
import type { ChestResult } from '../../domain/rewards'
import { useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, EmptyState, Screen } from '../../ui'
import { useDoc, useToday, goBack } from '../hooks'
import { chestText } from '../names'

export const CHEST_MS = 800

function Box({ open, result }: { open: boolean; result: ChestResult | null }) {
  const t = useTheme()
  const lid = useRef(new Animated.Value(0)).current
  const content = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!open) return
    if (t.motion.reduceMotion) content.setValue(1)
    else
      Animated.parallel([
        Animated.timing(lid, { toValue: 1, duration: CHEST_MS / 2, useNativeDriver: true }),
        Animated.timing(content, { toValue: 1, duration: CHEST_MS, useNativeDriver: true }),
      ]).start()
  }, [open, lid, content, t.motion])
  const rotate = lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-12deg'] })
  const rise = content.interpolate({ inputRange: [0, 1], outputRange: [t.motion.reduceMotion ? 0 : 16, 0] })
  const text = result && chestText(result)
  return (
    <View style={{ alignItems: 'center', gap: t.space[4], paddingVertical: t.space[6] }}>
      {/* shortcut: 桐箱插圖（SVG）尚未繪製（handoff §3），先用色塊示意，素材到位後替換。 */}
      <View accessible accessibilityRole="image" accessibilityLabel={open ? '打開的桐箱' : '桐箱'} style={{ width: 160, alignItems: 'center' }}>
        <Animated.View style={{ width: 168, height: 28, borderRadius: t.radius.chip, backgroundColor: t.colors.outline, transform: [{ rotate }], transformOrigin: 'left bottom' }} />
        <View style={{ width: 160, height: 88, borderRadius: t.radius.chip, backgroundColor: t.colors.surface2, borderWidth: 2, borderColor: t.colors.outline }} />
      </View>
      {text && (
        <Animated.View style={{ opacity: content, transform: [{ translateY: rise }], alignItems: 'center', gap: t.space[2] }}>
          <AppText variant="title1" style={{ fontFamily: t.font.display.family }} accessibilityRole="header">
            {text.name}
          </AppText>
          <AppText color="ink2" style={{ textAlign: 'center' }}>
            {text.detail}
          </AppText>
        </Animated.View>
      )}
    </View>
  )
}

export default function Chest() {
  const t = useTheme()
  const doc = useDoc()
  const today = useToday()
  const { store } = useServices()
  const router = useRouter()
  const params = useLocalSearchParams<{ rank?: string; passed?: string }>()
  const [result, setResult] = useState<ChestResult | null>(() =>
    doc.rewards.chest.lastOpenedDate === today ? (doc.rewards.chest.log.find((e) => e.date === today)?.result ?? null) : null,
  )
  const [already] = useState(result !== null)
  const leaving = useRef(false)
  const goal = doc.rewards.goalCompletedDates.includes(today)

  const open = () => {
    const r = store.openChest() // 先提交，重開 App 不會換內容
    if (!r) return
    setResult(r)
    const text = chestText(r)
    AccessibilityInfo.announceForAccessibility(`拿到${text.name}。${text.detail}`)
  }
  const accept = () => {
    if (leaving.current) return
    leaving.current = true
    if (params.rank) router.replace({ pathname: '/ceremony', params: { rank: params.rank, passed: params.passed ?? params.rank } })
    else goBack(router)
  }

  if (!goal && !result)
    return (
      <Screen modal>
        <EmptyState title="完成今日目標就能開" message="桐箱每天一個，是完成今日修行的回饋。">
          <Button label="回道場" onPress={() => goBack(router)} />
        </EmptyState>
      </Screen>
    )
  return (
    <Screen modal>
      <AppText variant="title1" accessibilityRole="header" style={{ fontFamily: t.font.display.family, textAlign: 'center' }}>
        {already ? '今天已開，明天再來' : '今日的桐箱'}
      </AppText>
      {result?.type === 'firstStamp' && <AppText style={{ textAlign: 'center' }}>第一次修行的記念</AppText>}
      <Box open={!!result} result={result} />
      {result?.type === 'protectionCard' && (
        <Card>
          <AppText numeric style={{ textAlign: 'center' }}>
            持有 {doc.rewards.protectionCards}／2
          </AppText>
        </Card>
      )}
      {result ? <Button label="收下" onPress={accept} /> : <Button label="打開桐箱" onPress={open} />}
    </Screen>
  )
}
