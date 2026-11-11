// S3 修行（全螢幕模態）→ S4 結果。題目在進入時固定；中止要確認，已提交的作答保留。
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Alert, View } from 'react-native'
import type { LevelBank } from '../../data/bank'
import { lessonAccess } from '../../domain/access'
import { dayKey, type StudyKind } from '../../domain/learning/types'
import { useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, EmptyState, ErrorState, Screen, Skeleton } from '../../ui'
import { useDoc, useLevelBank, useToday, goBack } from '../hooks'
import { extraQueue, lessonQueue, reviewQueue, todayQueue, type QuizItem, type VocabMode } from './queue'
import { Choice, Flashcard, ListeningQuestion, ReadingArticle, type Submit } from './questions'
import { Result, type SessionLog } from './Result'

type Params = { src?: string; kind?: StudyKind; lesson?: string; vmode?: VocabMode }

export default function Session() {
  const level = useDoc().learning.level
  const bank = useLevelBank(level)
  const router = useRouter()
  if (bank.status === 'ready') return <Run bank={bank.bank} />
  return (
    <Screen modal>
      <Button variant="text" label="中止" onPress={() => goBack(router)} />
      {bank.status === 'loading' ? <Skeleton label="題目載入中" /> : <ErrorState title="題庫載入失敗" onRetry={bank.retry} />}
    </Screen>
  )
}

function build(src: string, p: Params, bank: LevelBank, deps: ReturnType<typeof useServices>, today: string) {
  const { store } = deps,
    m = deps.bank.manifest
  const doc = () => store.getState().doc!
  if (src === 'today') {
    store.ensurePlan(doc().learning.plans[dayKey(today, doc().learning.level)]?.branch ?? 'listening', bank, m)
    let q = todayQueue(doc(), bank, today, m)
    const repaired = q.missing.length > 0
    // 題庫更新後的失效目標：只修復失效部分（網頁版 repairPlan），再重新取題。
    for (const kind of q.missing) store.repairPlan(kind, bank, m)
    if (repaired) q = todayQueue(doc(), bank, today, m)
    store.startPlan()
    return { items: q.items, repaired }
  }
  if (src === 'extra') return { items: extraQueue(doc(), bank, today, m).items, repaired: false }
  if (src === 'review') return { items: reviewQueue(doc(), bank, today, m).items, repaired: false }
  const level = doc().learning.level,
    lessonNo = Number(p.lesson ?? 1)
  // 課表以外的入口（例如深連結）也要套用購買限制：未開放的課不出題。
  const { entitlement, meta } = doc()
  const access = lessonAccess({ free: m.levels[level].free, lessonNo, owned: entitlement.owned, today, firstOpenDate: meta.firstOpenDate })
  if (access !== 'open') return { items: [], repaired: false }
  return { items: lessonQueue(bank, m, level, p.kind ?? 'grammar', lessonNo, p.vmode ?? 'flashcard', today, doc().learning), repaired: false }
}

function Run({ bank }: { bank: LevelBank }) {
  const t = useTheme()
  const services = useServices()
  const { store, haptics, sound } = services
  const params = useLocalSearchParams<Params>()
  const src = params.src ?? 'today'
  const today = useToday()
  const router = useRouter()
  const [built, setBuilt] = useState<ReturnType<typeof build> | null>(null)
  // 建立今日計畫會寫入 store；在 render 期間做會讓其他訂閱元件於 render 中更新，所以放到 effect。
  useEffect(() => {
    setBuilt(build(src, params, bank, services, today))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 一次修行只取一次題
  }, [])
  const { items, repaired } = built ?? { items: [], repaired: false }
  const [confirmed, setConfirmed] = useState(false)
  const started = !repaired || confirmed
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'question' | 'result'>('question')
  const log = useRef<SessionLog>({ answers: [], goalCompleted: false, ceremony: null }).current
  const combo = useRef(0)

  const submit: Submit = (ref, mode, correct, attemptId) => {
    const fresh = mode === 'flashcard' && !store.getState().doc!.learning.schedules[JSON.stringify([ref.level, ref.kind, ref.id])]
    const outcome = store.submitAnswer({ attemptId, ref, mode, correct }, bank)
    if (!outcome) return null
    log.answers.push({ key: JSON.stringify([ref.level, ref.kind, ref.id]), correct, xp: outcome.xp, flash: mode === 'flashcard', learned: fresh && correct })
    if (outcome.goalCompleted) log.goalCompleted = true
    if (outcome.ceremony)
      log.ceremony = { rank: outcome.ceremony.rank, passed: [...(log.ceremony?.passed ?? []), ...outcome.ceremony.passed] }
    if (mode === 'flashcard') {
      // 翻卡自評不是對錯：不震動、不出音效、不算連擊。
      AccessibilityInfo.announceForAccessibility(correct ? '記下了' : fresh ? '沒關係，之後還會再見到' : '沒關係，複習時再試試')
      return { xp: 0, combo: 0 }
    }
    combo.current = correct ? combo.current + 1 : 0
    void haptics.play(correct ? 'correct' : 'wrong')
    if (combo.current >= 3) void haptics.play('combo')
    sound.play(correct ? 'correct' : 'wrong')
    AccessibilityInfo.announceForAccessibility(`${correct ? '答對' : '答錯'}，${outcome.xp ? `加 ${outcome.xp} XP` : '今天已計分'}`)
    return { xp: outcome.xp, combo: combo.current }
  }
  const completeReading = (articleId: string) => (attemptId: string, resultIds: string[]) => {
    const article = bank.reading.find((a) => a.id === articleId)!
    if (store.completeReading({ attemptId, level: items[0].refs[0].level, articleId, questionIds: article.questions.map((q) => q.id), resultIds }, bank))
      log.goalCompleted = true
  }
  const advanced = useRef(-1)
  const next = () => {
    if (advanced.current === index) return // 「下一題」連點只前進一題
    advanced.current = index
    if (index < items.length - 1) setIndex(index + 1)
    else if (log.answers.length) setPhase('result')
    else goBack(router) // 本次 0 題（全部跳過）：不顯示結果畫面
  }
  const abort = () =>
    Alert.alert('中止修行？', '已提交的作答會保留，下次從未作答的題目續做。', [
      { text: '繼續修行', style: 'cancel' },
      { text: '中止', style: 'destructive', onPress: () => goBack(router) },
    ])

  if (phase === 'result') return <Result log={log} bank={bank} today={today} src={src} />

  if (!built)
    return (
      <Screen modal>
        <Skeleton label="題目載入中" />
      </Screen>
    )

  if (!items.length)
    return (
      <Screen modal>
        <EmptyState
          title={src === 'review' ? '沒有待複習的題目' : '沒有可以練習的題目'}
          message={src === 'today' && repaired ? '這個等級都學過了，今天可以複習錯題或換等級' : undefined}
        >
          <Button label="回道場" onPress={() => goBack(router)} />
        </EmptyState>
      </Screen>
    )

  if (!started)
    return (
      <Screen modal>
        <EmptyState title="這組題目已更新，已幫你換成新的題目" message="原本做過的進度都保留。">
          <Button label="開始" onPress={() => setConfirmed(true)} />
        </EmptyState>
      </Screen>
    )

  const item: QuizItem = items[index]
  const last = index === items.length - 1
  const firstListening = items.findIndex((i) => i.type === 'listening')
  const common = { submit, onNext: next, last }
  return (
    <Screen modal>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button variant="text" label="中止" onPress={abort} />
        <AppText color="ink2" numeric accessibilityLabel={`第 ${index + 1} 題，共 ${items.length} 題`}>
          {index + 1}／{items.length}
        </AppText>
      </View>
      <View key={`${item.key}#${index}`} style={{ gap: t.space[4] }}>
        {item.type === 'flashcard' ? (
          <Flashcard item={item} {...common} />
        ) : item.type === 'choice' ? (
          <Choice item={item} {...common} />
        ) : item.type === 'listening' ? (
          <ListeningQuestion item={item} {...common} showHint={index === firstListening} />
        ) : (
          <ReadingArticle item={item} {...common} complete={src === 'review' ? null : completeReading(item.article.id)} />
        )}
      </View>
    </Screen>
  )
}
