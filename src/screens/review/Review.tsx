// S9 複習：到期與錯題的入口；題庫找不到的 ID 列在「不可用」並保留紀錄（不刪除）。
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { View } from 'react-native'
import { useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, EmptyState, ErrorState, Screen, Skeleton } from '../../ui'
import { reviewCounts } from '../dojo/selectors'
import { useDoc, useLevelBank, useNavLock, useToday } from '../hooks'
import { reviewQueue } from '../session/queue'

export default function Review() {
  const t = useTheme()
  const doc = useDoc()
  const today = useToday()
  const router = useRouter()
  const go = useNavLock()
  const { bank: banks } = useServices()
  const bank = useLevelBank(doc.learning.level)
  const q = useMemo(
    () => (bank.status === 'ready' ? reviewQueue(doc, bank.bank, today, banks.manifest) : null),
    [bank, doc, today, banks.manifest],
  )
  const { due, mistakes } = reviewCounts(doc, today)
  const cleared = Object.values(doc.learning.mistakes)
    .filter((m) => !m.pending && m.ref.level === doc.learning.level)
    .map((m) => m.lastResultAt.slice(0, 10))
    .sort()
    .pop()

  if (bank.status === 'loading' || !q)
    return <Screen>{bank.status === 'error' ? <ErrorState title="題庫載入失敗" onRetry={bank.retry} /> : <Skeleton />}</Screen>
  return (
    <Screen>
      {q.items.length === 0 ? (
        <EmptyState title="沒有待複習的題目" message={cleared ? `上次清空：${cleared}` : undefined} />
      ) : (
        <Card>
          <AppText numeric>
            到期 {due}・錯題 {mistakes}
          </AppText>
          <AppText variant="footnote" color="ink2">
            答對後解除待複習；同一天已計分的題目再做不加 XP。
          </AppText>
          <Button label={`開始複習（${q.items.length} 題）`} onPress={() => go(() => router.push({ pathname: '/session', params: { src: 'review' } }))} />
        </Card>
      )}
      {q.locked.length > 0 && (
        <Card tone="surface2" accessibilityLabel={`完整版內容 ${q.locked.length} 項，紀錄保留，開通完整版後可複習`}>
          <AppText variant="headline">完整版內容 {q.locked.length} 項</AppText>
          <AppText variant="footnote" color="ink2">
            紀錄會保留，開通 N3–N1 完整版後可以複習。
          </AppText>
        </Card>
      )}
      {q.unavailable.length > 0 && (
        <Card tone="surface2" accessibilityLabel={`不可用 ${q.unavailable.length} 項`}>
          <AppText variant="headline">不可用 {q.unavailable.length} 項</AppText>
          <AppText variant="footnote" color="ink2">
            題目已更新或退役，紀錄會保留。
          </AppText>
          <View style={{ gap: t.space[1] }}>
            {q.unavailable.map((r) => (
              <AppText key={`${r.kind}:${r.id}`} variant="footnote" color="ink2">
                {r.id}
              </AppText>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  )
}
