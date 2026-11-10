// 首次體驗 O1–O5（app-design §3）：步驟存在 store 的 meta.onboarding（notStarted→O1、level→O2、minutes→O3、placement→O4/O5），
// 中途關閉回到未完成的那一步；O4 作答不保留、不給 XP、不建立排程。第一天不出現價格。
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import type { LevelBank } from '../../data/bank'
import { LEVELS, type Level } from '../../domain/progress/state'
import { choiceOptions, stableShuffle, suggestLevel } from '../../domain/quiz'
import { useAppState, useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, ErrorState, Option, Screen, Skeleton } from '../../ui'
import { levelName } from '../names'

const LEVEL_TEXT: Record<Level, string> = {
  n5: '看得懂假名，剛開始學基本句子',
  n4: '會基本句型，能讀簡單的日常文章',
  n3: '能讀懂日常話題，想銜接中級',
  n2: '能讀報導與說明文，準備商務程度',
  n1: '能讀論述文章，挑戰最高級',
}
const MINUTES = [
  { value: 5, text: '單字 5・文法 3・聽力 1' },
  { value: 10, text: '單字 10・文法 5・讀解 1 篇或聽力 3' },
  { value: 20, text: '單字 20・文法 10・讀解 1 篇＋聽力 3' },
] as const
export const PLACEMENT_PER_LEVEL = 3

function Title({ children }: { children: string }) {
  const t = useTheme()
  return (
    <AppText variant="title1" accessibilityRole="header" style={{ fontFamily: t.font.display.family }}>
      {children}
    </AppText>
  )
}

export default function Onboarding() {
  const step = useAppState((s) => s.doc!.meta.onboarding)
  const { store } = useServices()
  const router = useRouter()
  // 連點只前進一步：只在目前步驟相符時才前進。
  const advance = (from: typeof step, fn: () => void) => () => {
    if (store.getState().doc!.meta.onboarding === from) fn()
  }
  // 題庫載入失敗後略過：用 O2 等級進 S2（S2 顯示同樣的錯誤狀態），不直接進 S3。
  const finish = (level?: Level, toDojo = false) => {
    if (level) store.setLevel(level)
    store.setOnboarding('done')
    router.replace(toDojo ? '/' : { pathname: '/session', params: { src: 'today' } })
  }
  if (step === 'notStarted') return <Welcome onStart={advance('notStarted', () => store.setOnboarding('level'))} />
  if (step === 'level') return <PickLevel onPick={(l) => advance('level', () => (store.setLevel(l), store.setOnboarding('minutes')))()} />
  if (step === 'minutes') return <PickMinutes onNext={(m) => advance('minutes', () => (store.updateSettings({ dailyMinutes: m }), store.setOnboarding('placement')))()} />
  return <Placement onDone={finish} />
}

function Welcome({ onStart }: { onStart: () => void }) {
  const t = useTheme()
  const router = useRouter()
  return (
    <Screen modal>
      <View style={{ gap: t.space[3], paddingTop: t.space[16] }}>
        <AppText variant="wordHero" accessibilityRole="header">
          日本語道場
        </AppText>
        <AppText variant="title2">每天幾分鐘，從 N5 練到 N1</AppText>
      </View>
      <Button label="開始" onPress={onStart} />
      <Button variant="text" label="我用過網頁版，匯入進度" onPress={() => router.push('/import')} />
    </Screen>
  )
}

function PickLevel({ onPick }: { onPick: (l: Level) => void }) {
  const t = useTheme()
  const current = useAppState((s) => s.doc!.learning.level)
  return (
    <Screen modal>
      <Title>目標等級</Title>
      <View style={{ gap: t.space[2] }}>
        {LEVELS.map((l) => (
          <Option
            key={l}
            label={`${levelName(l)}　${LEVEL_TEXT[l]}${LEVELS.indexOf(l) >= 2 ? `（${levelName(l)} 第一課可免費試用）` : ''}`}
            state={l === current ? 'selected' : 'idle'}
            onPress={() => onPick(l)}
          />
        ))}
      </View>
    </Screen>
  )
}

function PickMinutes({ onNext }: { onNext: (m: 5 | 10 | 20) => void }) {
  const t = useTheme()
  const [m, setM] = useState<5 | 10 | 20>(useAppState((s) => s.doc!.settings.dailyMinutes))
  return (
    <Screen modal>
      <Title>每天修行幾分鐘？</Title>
      <View style={{ gap: t.space[2] }}>
        {MINUTES.map((x) => (
          <Option key={x.value} label={`${x.value} 分鐘　${x.text}`} state={m === x.value ? 'selected' : 'idle'} onPress={() => setM(x.value)} />
        ))}
      </View>
      <AppText variant="footnote" color="ink2">
        之後可以在設定裡改。
      </AppText>
      <Button label="下一步" onPress={() => onNext(m)} />
    </Screen>
  )
}

interface PQ {
  level: Level
  word: string
  answer: string
  options: string[]
}
function buildPlacement(banks: LevelBank[], seed: string): PQ[] {
  return LEVELS.flatMap((level, i) => {
    const vocab = banks[i].vocab
    return stableShuffle(vocab, `${seed}|${level}`)
      .slice(0, PLACEMENT_PER_LEVEL)
      .map((v) => {
        const distractors = stableShuffle(vocab.filter((x) => x.zh !== v.zh), `${seed}|${v.w}`).slice(0, 3).map((x) => x.zh)
        return { level, word: v.w, answer: v.zh, options: choiceOptions({ answer: v.zh, distractors }, `${seed}|${v.w}`) }
      })
  })
}

// O4 程度測驗（約 15 題，各級單字的中文意思）→ O5 建議等級。可略過；載入失敗可重試或略過。
function Placement({ onDone }: { onDone: (level?: Level, toDojo?: boolean) => void }) {
  const t = useTheme()
  const { bank } = useServices()
  const doc = useAppState((s) => s.doc!)
  const [attempt, setAttempt] = useState(0)
  // 題庫載入可能是非同步（AppServices.bank.load）；undefined＝載入中，null＝失敗。
  const [questions, setQuestions] = useState<PQ[] | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    setQuestions(undefined)
    Promise.all(LEVELS.map((l) => Promise.resolve().then(() => bank.load(l))))
      .then((banks) => buildPlacement(banks, doc.meta.installId))
      .then(
        (q) => alive && setQuestions(q),
        () => alive && setQuestions(null),
      )
    return () => {
      alive = false
    }
  }, [bank, doc.meta.installId, attempt])
  const [answers, setAnswers] = useState<Array<{ level: Level; correct: boolean }>>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(false)

  if (questions === undefined)
    return (
      <Screen modal>
        <Skeleton label="準備程度測驗" />
      </Screen>
    )
  if (!questions)
    return (
      <Screen modal>
        <ErrorState title="題庫載入失敗" onRetry={() => setAttempt((a) => a + 1)}>
          <Button variant="text" label="略過測驗" onPress={() => onDone(undefined, true)} />
        </ErrorState>
      </Screen>
    )
  const finished = answers.length === questions.length || skipped
  if (finished) {
    const suggestion = suggestLevel(answers)
    if (!suggestion)
      return (
        <Screen modal>
          <Button label="開始第一次修行" onPress={() => onDone()} />
        </Screen>
      )
    const rate = answers.length ? Math.round((answers.filter((a) => a.correct).length / answers.length) * 100) : 0
    const mine = answers.filter((a) => a.level === suggestion)
    const reason = !mine.length
      ? `作答過的等級都答對 2／3 以上，${levelName(suggestion)} 還沒測到。`
      : mine.filter((a) => a.correct).length < 2
        ? `${levelName(suggestion)} 是你答對少於 2／3 的第一個等級。`
        : '每個等級都答對 2／3 以上。'
    return (
      <Screen modal>
        <Title>{`建議從 ${levelName(suggestion)} 開始`}</Title>
        <AppText>
          測驗答對 {rate}%。{reason}
        </AppText>
        <Button label="用建議等級" onPress={() => onDone(suggestion)} />
        <Button variant="secondary" label={`維持我選的（${levelName(doc.learning.level)}）`} onPress={() => onDone()} />
      </Screen>
    )
  }
  const q = questions[answers.length]
  return (
    <Screen modal>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText color="ink2" numeric>
          程度測驗 {answers.length + 1}／{questions.length}
        </AppText>
        <Button variant="text" label="略過" onPress={() => (answers.length ? setSkipped(true) : onDone())} />
      </View>
      <AppText variant="footnote" color="ink2">
        選出意思（不計分、不影響進度）
      </AppText>
      <AppText variant="wordHero" ja accessibilityRole="header">
        {q.word}
      </AppText>
      <View key={`${answers.length}`} style={{ gap: t.space[2] }}>
        {q.options.map((o) => (
          <Option
            key={o}
            label={o}
            state={picked === null ? 'idle' : o === picked ? (o === q.answer ? 'correct' : 'wrong') : o === q.answer ? 'answer' : 'locked'}
            onPress={() => {
              if (picked !== null) return
              setPicked(o)
              setTimeout(() => {
                setPicked(null)
                setAnswers((a) => (a.length === answers.length ? [...a, { level: q.level, correct: o === q.answer }] : a))
              }, 400)
            }}
          />
        ))}
      </View>
    </Screen>
  )
}
