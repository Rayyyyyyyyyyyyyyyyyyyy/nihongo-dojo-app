// S4 修行結果：本次 XP（分項）、段位條、今日目標進度、答對率與錯題。
// 今日目標剛完成時在這裡蓋當日印（rewards §5；按住約 0.3 秒，VoiceOver 下是一般按鈕），再開寶箱（S5）。
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Animated, Pressable, View } from 'react-native'
import type { LevelBank } from '../../data/bank'
import { addDays } from '../../domain/learning/calendar'
import { useAppState, useServices } from '../../state/AppProvider'
import { shouldOfferReminder, studyBank } from '../../state/core'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, ProgressBar, Screen, Seal } from '../../ui'
import { todayProgress } from '../dojo/selectors'
import { useDoc } from '../hooks'
import { rankProgress } from '../names'

export interface SessionLog {
  answers: Array<{ key: string; correct: boolean; xp: 0 | 3 | 10 | 15 }>
  goalCompleted: boolean
  ceremony: { rank: number; passed: number[] } | null
}

export const STAMP_HOLD_MS = 300

function StampButton({ onStamp }: { onStamp: () => void }) {
  const t = useTheme()
  const y = useRef(new Animated.Value(t.motion.reduceMotion ? 0 : -24)).current
  const o = useRef(new Animated.Value(0)).current
  const [stamped, setStamped] = useState(false)
  const stamp = () => {
    if (stamped) return
    setStamped(true)
    onStamp()
    if (t.motion.reduceMotion) Animated.timing(o, { toValue: 1, duration: t.motion.alternative.maxDuration, useNativeDriver: true }).start()
    else {
      o.setValue(1)
      Animated.spring(y, { toValue: 0, ...t.motion.ease.settle, useNativeDriver: true } as never).start()
    }
  }
  if (stamped)
    return (
      <Animated.View style={{ opacity: o, transform: [{ translateY: y }], alignSelf: 'center' }}>
        <Seal text="稽古" size={72} label="今天的修行印已蓋下" />
      </Animated.View>
    )
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="蓋下今天的印"
      accessibilityHint="按住約 0.3 秒"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={stamp}
      delayLongPress={STAMP_HOLD_MS}
      onLongPress={stamp}
      style={({ pressed }) => ({
        alignSelf: 'center',
        minWidth: 120,
        minHeight: t.layout.buttonHeight,
        borderRadius: t.radius.surface,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: t.colors.seal,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.space[3],
        backgroundColor: pressed ? t.colors.surface2 : 'transparent',
      })}
    >
      <AppText variant="headline" color="seal">
        按住蓋印
      </AppText>
    </Pressable>
  )
}

export function Result({ log, bank, today, src }: { log: SessionLog; bank: LevelBank; today: string; src: string }) {
  const t = useTheme()
  const doc = useDoc()
  const saveError = useAppState((s) => s.saveError)
  const { store, haptics, sound, bank: banks } = useServices()
  const router = useRouter()
  const [stamped, setStamped] = useState(false)
  const [reminderDismissed, setReminderDismissed] = useState(false)
  const leaving = useRef(false)
  const total = log.answers.reduce((n, a) => n + a.xp, 0)
  const count = (xp: number) => log.answers.filter((a) => a.xp === xp).length
  const correct = log.answers.filter((a) => a.correct).length
  const wrong = log.answers.length - correct
  const rank = rankProgress(doc.rewards.xpTotal)
  const progress = todayProgress(doc, studyBank(doc, bank, banks.manifest), today)
  const ceremony = log.ceremony && { rank: String(log.ceremony.rank), passed: log.ceremony.passed.join(',') }

  const leave = (to: () => void) => {
    if (leaving.current) return // 「繼續」只觸發一次
    leaving.current = true
    to()
  }
  const toChest = () => leave(() => router.replace({ pathname: '/chest', params: ceremony ?? {} }))
  const onContinue = () =>
    leave(() => (ceremony ? router.replace({ pathname: '/ceremony', params: ceremony }) : router.back()))

  return (
    <Screen modal>
      <AppText variant="title1" accessibilityRole="header" style={{ fontFamily: t.font.display.family }}>
        修行結果
      </AppText>
      <Card>
        <AppText variant="largeTitle" numeric accessibilityLabel={`本次 ${total} XP${saveError ? '，尚未保存' : ''}`}>
          +{total} XP
        </AppText>
        {saveError && (
          <AppText variant="footnote" color="warn">
            尚未保存
          </AppText>
        )}
        <AppText color="ink2" numeric>
          首次答對 {count(10)}・到期複習 {count(15)}・練習 {count(3)}
          {count(0) ? `・今天已計分 ${count(0)}` : ''}
        </AppText>
        <AppText numeric>
          答對 {correct}／{log.answers.length}（{Math.round((correct / log.answers.length) * 100)}%）
        </AppText>
      </Card>
      <Card>
        <AppText variant="headline">段位　{rank.info.name}</AppText>
        {rank.next !== undefined && (
          <ProgressBar label="段位進度" value={doc.rewards.xpTotal - rank.floor} max={rank.next - rank.floor} text={`再 ${rank.toNext} XP 升${rank.nextName}`} />
        )}
        {progress && src !== 'review' && (
          <>
            <AppText variant="footnote" color="ink2">
              今日目標
            </AppText>
            <ProgressBar label="今日目標進度" value={progress.done} max={progress.total} />
          </>
        )}
      </Card>
      {wrong > 0 && (
        <Card>
          <AppText>錯題 {wrong} 題</AppText>
          <Button variant="secondary" label="現在複習" onPress={() => leave(() => router.replace('/review'))} />
        </Card>
      )}
      {log.goalCompleted ? (
        <Card style={{ alignItems: 'stretch' }}>
          <AppText variant="title2" accessibilityRole="header" style={{ textAlign: 'center' }}>
            今日修行完成
          </AppText>
          <StampButton
            onStamp={() => {
              setStamped(true)
              void haptics.play('stamp')
              sound.play('stamp')
            }}
          />
          {stamped && <Button label="開寶箱" onPress={toChest} />}
          {shouldOfferReminder(doc, today) && !reminderDismissed && (
            <Card tone="surface2">
              <AppText>要不要每天提醒你修行？你選時段，每天最多 1 則</AppText>
              <View style={{ flexDirection: 'row', gap: t.space[2] }}>
                <Button label="設定提醒" variant="secondary" onPress={() => router.push('/reminders')} />
                <Button
                  label="之後再說"
                  variant="text"
                  onPress={() => {
                    setReminderDismissed(true)
                    store.updateSettings({ reminder: { ...doc.settings.reminder, askAfter: addDays(today, 3) } })
                  }}
                />
              </View>
            </Card>
          )}
        </Card>
      ) : (
        <Button label="繼續" onPress={onContinue} />
      )}
    </Screen>
  )
}
