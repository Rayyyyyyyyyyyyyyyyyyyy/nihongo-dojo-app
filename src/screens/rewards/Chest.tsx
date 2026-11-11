// S5 開寶箱（桐箱）：結果先寫入文件再播 0.8 秒動畫（減少動態時直接顯示內容）；同一天再進來只顯示今天拿到的內容。
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, View } from 'react-native'
import type { ChestResult } from '../../domain/rewards'
import { useServices } from '../../state/AppProvider'
import { studyBank } from '../../state/core'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, ChestIcon, EmptyState, Screen } from '../../ui'
import { todayProgress } from '../dojo/selectors'
import { useDoc, useLevelBank, useToday, goBack } from '../hooks'
import { chestText } from '../names'

export const CHEST_MS = 800

function Box({ open, result }: { open: boolean; result: ChestResult | null }) {
  const t = useTheme()
  const content = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!open) return
    if (t.motion.reduceMotion) content.setValue(1)
    else Animated.timing(content, { toValue: 1, duration: CHEST_MS, useNativeDriver: true }).start()
  }, [open, content, t.motion])
  const rise = content.interpolate({ inputRange: [0, 1], outputRange: [t.motion.reduceMotion ? 0 : 16, 0] })
  const text = result && chestText(result)
  return (
    <View style={{ alignItems: 'center', gap: t.space[4], paddingVertical: t.space[6] }}>
      <ChestIcon open={open} />
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
  const { store, bank: banks } = useServices()
  const bank = useLevelBank(doc.learning.level)
  const router = useRouter()
  const params = useLocalSearchParams<{ rank?: string; passed?: string }>()
  const [result, setResult] = useState<ChestResult | null>(() =>
    doc.rewards.chest.lastOpenedDate === today ? (doc.rewards.chest.log.find((e) => e.date === today)?.result ?? null) : null,
  )
  const [already] = useState(result !== null)
  const leaving = useRef(false)
  const goal = doc.rewards.goalCompletedDates.includes(today)
  const progress = bank.status === 'ready' ? todayProgress(doc, studyBank(doc, bank.bank, banks.manifest), today) : null
  const remaining = progress ? progress.total - progress.done : undefined

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
        <EmptyState title="完成今日目標就能開" message={remaining ? `再 ${remaining} 題` : undefined}>
          <View style={{ alignItems: 'center' }}>
            <ChestIcon locked remaining={remaining} />
          </View>
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
