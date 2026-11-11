// S3 作答元件：單字翻卡、選擇題（讀音測驗、文法填空）、S10 聽力、S11 讀解。
// 選項一點即提交；提交後鎖定，再點無效（app-design S3 重複操作）。
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { AccessibilityInfo, Animated, AppState, findNodeHandle, Text, View } from 'react-native'
import type { Listening } from '../../domain/bank/types'
import { newAttemptId, type StudyItemRef, type StudyMode } from '../../domain/learning/types'
import { speechText } from '../../domain/quiz'
import { useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, EmptyState, ErrorState, Option, type OptionState } from '../../ui'
import { useDoc, useToday } from '../hooks'
import { readingResume, type QuizItem } from './queue'

export interface Answered {
  xp: 0 | 3 | 10 | 15
  combo: number
}
// 提交一次作答；重複或無效提交（學習規則不收）回傳 null。
export type Submit = (ref: StudyItemRef, mode: StudyMode, correct: boolean, attemptId: string) => Answered | null

// 題目出現時把 VoiceOver 焦點移到題目（visual-system §6）。
function useFocusOnMount() {
  const ref = useRef<ComponentRef<typeof Text>>(null)
  useEffect(() => {
    const node = ref.current && findNodeHandle(ref.current)
    if (node) AccessibilityInfo.setAccessibilityFocus(node)
  }, [])
  return ref
}

// XP 浮字：上移 16pt＋淡出；減少動態時靜態顯示 600ms 後淡出。實際入帳 0 時寫「今天已計分」。
function XpFloat({ xp }: { xp: number }) {
  const t = useTheme()
  const y = useRef(new Animated.Value(0)).current,
    o = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const fade = Animated.timing(o, { toValue: 0.0, duration: t.motion.alternative.maxDuration, delay: 600, useNativeDriver: true })
    if (t.motion.reduceMotion) fade.start()
    else Animated.timing(y, { toValue: -16, duration: t.motion.duration.slow, useNativeDriver: true }).start()
  }, [o, y, t.motion])
  return (
    <Animated.View style={{ transform: [{ translateY: y }], opacity: t.motion.reduceMotion ? o : 1 }}>
      <AppText variant="headline" color="primary" numeric>
        {xp ? `+${xp} XP` : '今天已計分'}
      </AppText>
    </Animated.View>
  )
}

function Feedback({ correct, answered, explanation, reportKey }: { correct: boolean; answered: Answered; explanation?: string; reportKey: string }) {
  const t = useTheme()
  const router = useRouter()
  return (
    <Card tone={correct ? 'correctBg' : 'wrongBg'} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
        <AppText variant="headline" color={correct ? 'correct' : 'wrong'}>
          {correct ? '答對' : '答錯'}
        </AppText>
        <XpFloat xp={answered.xp} />
        {answered.combo >= 3 && (
          <AppText variant="headline" numeric style={{ marginLeft: 'auto' }}>
            連擊 {answered.combo}
          </AppText>
        )}
      </View>
      {explanation ? <AppText>{explanation}</AppText> : null}
      <Button variant="text" label="回報這題" onPress={() => router.push({ pathname: '/report', params: { key: reportKey } })} />
    </Card>
  )
}

function Broken({ item, onNext }: { item: QuizItem; onNext: () => void }) {
  return (
    <ErrorState title="這題資料有問題，已跳過" message={`題目代碼：${item.key}（可在「回報題目」使用）`}>
      <Button label="下一題" onPress={onNext} />
    </ErrorState>
  )
}

// 選擇題本體（讀音、文法、聽力、讀解子題共用）。
function Choices({
  options,
  answer,
  ja,
  onPick,
}: {
  options: string[]
  answer: string
  ja: boolean
  onPick: (option: string) => void
}) {
  const t = useTheme()
  const [picked, setPicked] = useState<string | null>(null)
  const stateOf = (o: string): OptionState =>
    picked === null ? 'idle' : o === picked ? (o === answer ? 'correct' : 'wrong') : o === answer ? 'answer' : 'locked'
  return (
    <View style={{ gap: t.space[2] }}>
      {options.map((o) => (
        <Option
          key={o}
          label={o}
          ja={ja}
          state={stateOf(o)}
          onPress={() => {
            if (picked !== null) return
            setPicked(o)
            onPick(o)
          }}
        />
      ))}
    </View>
  )
}

function NextButton({ shown, last, onNext }: { shown: boolean; last: boolean; onNext: () => void }) {
  if (!shown) return null
  return <Button label={last ? '看結果' : '下一題'} onPress={onNext} />
}

type Props<T extends QuizItem['type']> = { item: Extract<QuizItem, { type: T }>; submit: Submit; onNext: () => void; last: boolean }

export function Flashcard({ item, submit, onNext, last }: Props<'flashcard'>) {
  const t = useTheme()
  const focus = useFocusOnMount()
  const attempt = useRef(newAttemptId()).current
  const [flipped, setFlipped] = useState(false)
  const [result, setResult] = useState<{ correct: boolean; a: Answered } | null>(null)
  const v = item.vocab
  const doc = useDoc()
  const [scheduled] = useState(() => !!doc.learning.schedules[item.key]) // 進題時已學過的字，翻卡不改排程
  const grade = (correct: boolean) => {
    if (result) return
    const a = submit(item.refs[0], 'flashcard', correct, attempt)
    if (a) setResult({ correct, a })
  }
  return (
    <View style={{ gap: t.space[4] }}>
      <Card style={{ alignItems: 'center', paddingVertical: t.space[8] }}>
        <AppText variant="footnote" color="ink2">
          先在心裡想讀音和意思，再看答案
        </AppText>
        <AppText ref={focus} variant="wordHero" ja accessibilityRole="header">
          {v.w}
        </AppText>
        {flipped && (
          <>
            <AppText variant="bodyJa" ja color="ink2">
              {v.r}
            </AppText>
            <AppText>{v.zh}</AppText>
          </>
        )}
      </Card>
      {!flipped ? (
        <Button label="看答案" variant="secondary" onPress={() => setFlipped(true)} />
      ) : !result ? (
        <View style={{ flexDirection: 'row', gap: t.space[3] }}>
          <View style={{ flex: 1, gap: t.space[1] }}>
            <Button label="還不熟" variant="secondary" onPress={() => grade(false)} />
            <AppText variant="footnote" color="ink2" style={{ textAlign: 'center' }}>
              {scheduled ? '複習時間不變' : '之後還會再當新字出現'}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: t.space[1] }}>
            <Button label="記得" onPress={() => grade(true)} />
            <AppText variant="footnote" color="ink2" style={{ textAlign: 'center' }}>
              {scheduled ? '複習時間不變' : '隔幾天再複習'}
            </AppText>
          </View>
        </View>
      ) : (
        <Card tone="surface2" accessibilityLiveRegion="polite">
          <AppText variant="headline">{result.correct ? '記下了' : scheduled ? '沒關係，複習時再試試' : '沒關係，之後還會再見到'}</AppText>
          {/* 使用者 2026-11-11：翻卡只認識，掌握來自之後的讀音測驗，要讓人知道下一步。 */}
          <AppText variant="footnote" color="ink2">
            之後複習會考讀音，考過就在收集冊掛上這張札
          </AppText>
        </Card>
      )}
      <NextButton shown={!!result} last={last} onNext={onNext} />
    </View>
  )
}

export function Choice({ item, submit, onNext, last }: Props<'choice'>) {
  const t = useTheme()
  const focus = useFocusOnMount()
  const attempt = useRef(newAttemptId()).current
  const [result, setResult] = useState<{ correct: boolean; a: Answered } | null>(null)
  if (item.broken) return <Broken item={item} onNext={onNext} />
  const pron = item.mode === 'pronunciation'
  return (
    <View style={{ gap: t.space[4] }}>
      <Card>
        <AppText variant="footnote" color="ink2">
          {pron ? '選出正確的讀音' : '選出填入＿＿的答案'}
        </AppText>
        <AppText ref={focus} variant={pron ? 'wordHero' : 'bodyJa'} ja accessibilityRole="header">
          {item.prompt}
        </AppText>
      </Card>
      <Choices
        options={item.options}
        answer={item.answer}
        ja
        onPick={(o) => {
          const correct = o === item.answer
          const a = submit(item.refs[0], item.mode, correct, attempt)
          if (a) setResult({ correct, a })
        }}
      />
      {result && <Feedback correct={result.correct} answered={result.a} explanation={item.explanation} reportKey={item.key} />}
      <NextButton shown={!!result} last={last} onNext={onNext} />
    </View>
  )
}

// S10 聽力：expo-speech 朗讀（移除說話者標籤）、暫停／繼續／停止、語速、靜音提示、文字稿。播放不是學習活動。
type Voice = 'checking' | 'available' | 'missing'
type Play = 'idle' | 'preparing' | 'playing' | 'paused' | 'error'

function Player({ item, onTranscript }: { item: Listening; onTranscript: () => void }) {
  const t = useTheme()
  const { speech, store } = useServices()
  const rate = useDoc().settings.speechRate
  const [voice, setVoice] = useState<Voice>('checking')
  const [play, setPlay] = useState<Play>('idle')
  useEffect(() => {
    let alive = true
    speech.japaneseVoice().then(
      (v) => alive && setVoice(v),
      () => alive && setVoice('available'), // 查不到語音清單時照常嘗試播放，失敗走播放錯誤
    )
    // 切題或離開時停止；App 進背景停止並清除進度，回來按播放從頭開始。
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        void speech.stop()
        setPlay('idle')
      }
    })
    return () => {
      alive = false
      sub.remove()
      void speech.stop()
    }
  }, [speech, item.id])
  const start = () => {
    setPlay('preparing')
    speech
      .speak(speechText(item.script), rate, {
        start: () => setPlay('playing'),
        done: () => setPlay('idle'),
        error: () => setPlay('error'),
      })
      .catch(() => setPlay('error'))
  }
  if (voice === 'checking') return null
  if (voice === 'missing')
    return (
      <EmptyState
        title="這台 iPhone 沒有日語語音"
        message="請到「設定 → 輔助使用 → 朗讀內容 → 語音」下載日語，或先看文字稿作答。"
      >
        <Button label="顯示文字稿" variant="secondary" onPress={onTranscript} />
      </EmptyState>
    )
  if (play === 'error')
    return (
      <ErrorState title="播放失敗" message="不扣分、不算作答。" onRetry={start}>
        <Button label="顯示文字稿" variant="secondary" onPress={onTranscript} />
      </ErrorState>
    )
  return (
    <Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
        {play === 'playing' ? (
          <Button label="暫停" onPress={() => void speech.pause().then(() => setPlay('paused'))} />
        ) : play === 'paused' ? (
          <Button label="繼續" onPress={() => void speech.resume().then(() => setPlay('playing'))} />
        ) : (
          <Button label={play === 'preparing' ? '準備語音' : '播放'} loading={play === 'preparing'} onPress={start} />
        )}
        {(play === 'playing' || play === 'paused') && (
          <Button label="停止" variant="secondary" onPress={() => void speech.stop().then(() => setPlay('idle'))} />
        )}
        <Button
          variant="text"
          label={`語速 ${rate === 1 ? '1.0' : '0.8'}×`}
          accessibilityLabel={`語速 ${rate === 1 ? '1.0' : '0.8'} 倍，點一下切換`}
          onPress={() => store.updateSettings({ speechRate: rate === 1 ? 0.8 : 1.0 })}
        />
      </View>
      {play === 'playing' && (
        <AppText variant="footnote" color="ink2" accessibilityLiveRegion="polite">
          播放中
        </AppText>
      )}
    </Card>
  )
}

export function ListeningQuestion({ item, submit, onNext, last, showHint }: Props<'listening'> & { showHint: boolean }) {
  const t = useTheme()
  const focus = useFocusOnMount()
  const attempt = useRef(newAttemptId()).current
  const [transcript, setTranscript] = useState(false)
  const [result, setResult] = useState<{ correct: boolean; a: Answered } | null>(null)
  if (item.broken) return <Broken item={item} onNext={onNext} />
  const l = item.item
  return (
    <View style={{ gap: t.space[4] }}>
      <Player item={l} onTranscript={() => setTranscript(true)} />
      {showHint && (
        <Card tone="surface2">
          <AppText variant="callout">聽不到聲音？請關閉側邊的靜音開關並調高音量</AppText>
        </Card>
      )}
      {transcript ? (
        <Card accessibilityLabel="文字稿">
          <AppText variant="footnote" color="ink2">
            文字稿
          </AppText>
          <AppText variant="bodyJa" ja>
            {l.script}
          </AppText>
        </Card>
      ) : (
        <Button variant="text" label="顯示文字稿" onPress={() => setTranscript(true)} />
      )}
      <Card>
        <AppText ref={focus} variant="bodyJa" ja accessibilityRole="header">
          {l.q}
        </AppText>
      </Card>
      <Choices
        options={item.options}
        answer={l.answer}
        ja
        onPick={(o) => {
          const correct = o === l.answer
          const a = submit(item.refs[0], 'listening', correct, attempt)
          if (a) setResult({ correct, a })
        }}
      />
      {result && <Feedback correct={result.correct} answered={result.a} explanation={l.explanation} reportKey={item.key} />}
      <NextButton shown={!!result} last={last} onNext={onNext} />
    </View>
  )
}

// S11 讀解：每子題各自提交（attemptId = [文章 attempt, 子題]）；全部答完才記整篇完成。續做回到第一個未答子題。
export function ReadingArticle({
  item,
  submit,
  onNext,
  last,
  complete,
}: Props<'reading'> & { complete: ((attemptId: string, resultIds: string[]) => void) | null }) {
  const t = useTheme()
  const doc = useDoc()
  const today = useToday()
  const focus = useFocusOnMount()
  const a = item.article
  const [resume] = useState(() => (complete ? readingResume(doc.learning, item.refs[0].level, a.id, today) : null))
  const attemptId = useRef(resume?.attemptId ?? newAttemptId()).current
  const [index, setIndex] = useState(() => {
    const i = a.questions.findIndex((q) => !resume?.answered.includes(q.id))
    return i < 0 ? a.questions.length - 1 : i
  })
  const [result, setResult] = useState<{ correct: boolean; a: Answered } | null>(null)
  const q = a.questions[index]
  const final = index === a.questions.length - 1
  const next = () => {
    if (!final) {
      setIndex(index + 1)
      setResult(null)
      return
    }
    complete?.(attemptId, a.questions.map((x) => JSON.stringify([attemptId, x.id])))
    onNext()
  }
  return (
    <View style={{ gap: t.space[4] }}>
      <Card>
        <AppText ref={focus} variant="title2" ja accessibilityRole="header">
          {a.title}
        </AppText>
        <AppText variant="bodyJa" ja>
          {a.text}
        </AppText>
        {a.notes.map((n) => (
          <AppText key={n.term} variant="footnote" color="ink2">
            <AppText variant="footnote" ja>
              {n.term}
            </AppText>
            ：{n.meaning}
          </AppText>
        ))}
      </Card>
      <AppText variant="footnote" color="ink2" numeric>
        第 {index + 1}／{a.questions.length} 題
      </AppText>
      <Card key={q.id}>
        <AppText variant="bodyJa" ja>
          {q.q}
        </AppText>
      </Card>
      <Choices
        key={`c-${q.id}`}
        options={item.options[q.id]}
        answer={q.answer}
        ja
        onPick={(o) => {
          const correct = o === q.answer
          const ref = item.refs.find((r) => r.id === q.id)!
          // 續做時這個子題可能已在 App 被關前提交過：重複提交不再計分，直接前進。
          const ans = submit(ref, 'reading', correct, JSON.stringify([attemptId, q.id])) ?? (resume?.answered.includes(q.id) ? { xp: 0 as const, combo: 0 } : null)
          if (ans) setResult({ correct, a: ans })
        }}
      />
      {result && <Feedback correct={result.correct} answered={result.a} explanation={q.explanation} reportKey={item.key} />}
      {result && <Button label={final ? (last ? '看結果' : '下一題') : '下一個子題'} onPress={next} />}
    </View>
  )
}
