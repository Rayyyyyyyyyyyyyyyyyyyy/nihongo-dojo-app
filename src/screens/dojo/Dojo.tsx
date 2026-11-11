// S2 道場（今日）：等級切換、連勝、今日任務、到期複習、寶箱、段位（visual-system §4.2）。
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { useServices } from '../../state/AppProvider'
import { currentStreak, studyBank } from '../../state/core'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Belt, Button, Card, ChestIcon, EmptyState, ErrorState, ListRow, ProgressBar, Screen, Seal, Segmented, Skeleton } from '../../ui'
import { useDoc, useLevelBank, useNavLock, useToday } from '../hooks'
import { chestText, LEVEL_OPTIONS, rankProgress } from '../names'
import { reviewCounts, todayProgress, yesterday } from './selectors'
import { LEVELS } from '../../domain/progress/state'

export default function Dojo() {
  const t = useTheme()
  const doc = useDoc()
  const today = useToday()
  const { store, bank: banks } = useServices()
  const router = useRouter()
  useEffect(() => {
    const c = store.celebratePending()
    if (c) router.push({ pathname: '/ceremony', params: { rank: String(c.rank), passed: c.passed.join(',') } })
  }, [store, router])
  const go = useNavLock()
  const level = doc.learning.level
  const bank = useLevelBank(level)
  const progress = bank.status === 'ready' ? todayProgress(doc, studyBank(doc, bank.bank, banks.manifest), today) : null
  const branch = progress?.plan.branch ?? 'listening'

  const loaded = bank.status === 'ready' ? bank.bank : null
  useEffect(() => {
    if (loaded) store.ensurePlan(branch, loaded, banks.manifest)
  }, [loaded, branch, level, today, store, banks])

  const streak = currentStreak(doc, today)
  const guarded = doc.rewards.protectedDates.includes(yesterday(today))
  const { due, mistakes } = reviewCounts(doc, today, banks.manifest)
  const goalDone = doc.rewards.goalCompletedDates.includes(today)
  const opened = doc.rewards.chest.lastOpenedDate === today
  const todays = doc.rewards.chest.log.find((e) => e.date === today)?.result
  const remaining = progress ? progress.total - progress.done : undefined
  const rank = rankProgress(doc.rewards.xpTotal)
  const minutes = doc.settings.dailyMinutes

  return (
    <Screen>
      <View style={{ gap: t.space[3] }}>
        <Segmented label="目標等級" options={LEVEL_OPTIONS} value={level} onChange={(l) => store.setLevel(l)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
          <Seal text={String(streak)} label={`連勝 ${streak} 天`} />
          <AppText color="ink2" style={{ flex: 1 }}>
            {streak ? `連勝 ${streak} 天${guarded ? '（昨天由保護卡守住）' : ''}` : '新的連勝從今天開始'}
          </AppText>
          <AppText color="ink2" numeric accessibilityLabel={`保護卡 ${doc.rewards.protectionCards} 張`}>
            護 {doc.rewards.protectionCards}
          </AppText>
        </View>
      </View>

      {bank.status === 'loading' || (bank.status === 'ready' && !progress) ? (
        <Skeleton rows={2} />
      ) : bank.status === 'error' ? (
        <ErrorState title="題庫載入失敗" message="連勝與段位不受影響。" onRetry={bank.retry} />
      ) : (
        <Card accessibilityLabel="今日任務">
          <AppText variant="footnote" color="ink2">
            今日修行・{minutes} 分鐘
          </AppText>
          {goalDone ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
                <Seal text="稽古" label="今天的修行印" />
                <AppText variant="title2" accessibilityRole="header">
                  今日修行完成
                </AppText>
              </View>
              <Button label="加練" variant="secondary" onPress={() => go(() => router.push({ pathname: '/session', params: { src: 'extra' } }))} />
            </>
          ) : progress!.allKnown && due === 0 ? (
            <>
              <AppText>這個等級都學過了，今天可以複習錯題或換等級</AppText>
              <Button label="複習錯題" variant="secondary" onPress={() => go(() => router.push('/review'))} />
              <Button
                label="換等級"
                variant="text"
                onPress={() => store.setLevel(LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length])}
              />
            </>
          ) : (
            <>
              {progress!.firstWord && (
                <View>
                  <AppText variant="wordHero" ja>
                    {progress!.firstWord.w}
                  </AppText>
                  <AppText variant="bodyJa" color="ink2" ja>
                    {progress!.firstWord.r}
                  </AppText>
                </View>
              )}
              <ProgressBar label="今日進度" value={progress!.done} max={progress!.total} />
              <Button
                label={progress!.started ? `續做（已完成 ${progress!.done}／${progress!.total}）` : '開始'}
                onPress={() => go(() => router.push({ pathname: '/session', params: { src: 'today' } }))}
              />
              {minutes === 10 && !progress!.plan.started && (
                <Button
                  variant="text"
                  label={branch === 'listening' ? '深入練習改做讀解 1 篇' : '深入練習改做聽力 3 題'}
                  onPress={() => bank.status === 'ready' && store.ensurePlan(branch === 'listening' ? 'reading' : 'listening', bank.bank, banks.manifest)}
                />
              )}
            </>
          )}
        </Card>
      )}

      {due + mistakes === 0 ? (
        <EmptyState title="今天沒有到期項目" />
      ) : (
        <View style={{ borderRadius: t.radius.surface, overflow: 'hidden', gap: 1, backgroundColor: t.colors.separator }}>
          <ListRow title="到期複習" value={`${due}`} onPress={() => go(() => router.push('/review'))} />
          <ListRow title="錯題" value={`${mistakes}`} onPress={() => go(() => router.push('/review'))} />
        </View>
      )}

      <Card accessibilityLabel="寶箱">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
          <ChestIcon decorative width={64} locked={!goalDone && !opened} open={opened} remaining={remaining} />
          <View style={{ flex: 1, gap: t.space[1] }}>
            <AppText variant="headline">桐箱</AppText>
            {opened && todays ? (
              <AppText color="ink2">今天已開，明天再來。今天拿到：{chestText(todays).name}</AppText>
            ) : goalDone ? (
              <AppText color="ink2">可以開了</AppText>
            ) : (
              <AppText color="ink2" numeric>{remaining ? `再 ${remaining} 題就能開` : '完成今日目標就能開'}</AppText>
            )}
          </View>
        </View>
        {goalDone && !opened && <Button label="開寶箱" onPress={() => go(() => router.push('/chest'))} />}
      </Card>

      <Card onPress={() => router.navigate('/me')} accessibilityLabel={`段位 ${rank.info.name}，累積 ${doc.rewards.xpTotal} XP`} accessibilityHint="到我的分頁看段位">
        <AppText variant="headline">段位　{rank.info.name}</AppText>
        <Belt rank={rank.rank} />
        {rank.next !== undefined ? (
          <>
            <ProgressBar label="段位進度" value={doc.rewards.xpTotal - rank.floor} max={rank.next - rank.floor} text={`再 ${rank.toNext} XP 升${rank.nextName}`} />
            <AppText variant="footnote" color="ink2" numeric>
              再 {rank.toNext} XP 升{rank.nextName}
            </AppText>
          </>
        ) : (
          <AppText variant="footnote" color="ink2">已是最高段位</AppText>
        )}
      </Card>
    </Screen>
  )
}
