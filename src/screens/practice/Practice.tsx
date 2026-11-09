// S7 修行（課表）：等級（與道場共用）× 類別；N3–N1 第 2 課起依 lessonAccess 開說明（S14a）或付費（S14）。
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { lessonAccess } from '../../domain/access'
import type { StudyKind } from '../../domain/learning/types'
import { useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Card, EmptyState, ErrorState, Screen, Segmented, Skeleton } from '../../ui'
import { useDoc, useLevelBank, useNavLock, useToday } from '../hooks'
import { KIND_NAMES, LEVEL_OPTIONS, levelName } from '../names'
import { lessonStats } from './stats'

const KINDS: StudyKind[] = ['vocab', 'grammar', 'reading', 'listening']

export default function Practice() {
  const t = useTheme()
  const doc = useDoc()
  const today = useToday()
  const { store, bank: banks } = useServices()
  const router = useRouter()
  const go = useNavLock()
  const level = doc.learning.level
  const [kind, setKind] = useState<StudyKind>('vocab') // 分頁保持掛載：回來時仍是上次看的類別與捲動位置
  const bank = useLevelBank(level)
  const m = banks.manifest.levels[level]
  const lessons = m.lessons[kind]

  const openLesson = (lessonNo: number) => {
    // 購買狀態查不到時沿用本機 entitlement 快取（app-design S7 錯誤）。
    const access = lessonAccess({ free: m.free, lessonNo, owned: doc.entitlement.owned, today, firstOpenDate: doc.meta.firstOpenDate })
    go(() => {
      if (access === 'explainOnly') router.push('/paywall-explain')
      else if (access === 'paywall') router.push({ pathname: '/paywall', params: { level, kind, lesson: String(lessonNo) } })
      else if (kind === 'vocab') router.push({ pathname: '/practice/vocab', params: { lesson: String(lessonNo) } })
      else router.push({ pathname: '/session', params: { src: 'lesson', kind, lesson: String(lessonNo) } })
    })
  }

  return (
    <Screen>
      <Segmented label="目標等級" options={LEVEL_OPTIONS} value={level} onChange={(l) => store.setLevel(l)} />
      <Segmented label="類別" options={KINDS.map((k) => ({ value: k, label: KIND_NAMES[k] }))} value={kind} onChange={setKind} />
      {bank.status === 'loading' ? (
        <Skeleton rows={4} />
      ) : bank.status === 'error' ? (
        <ErrorState title="題庫載入失敗" onRetry={bank.retry} />
      ) : !lessons.length ? (
        <EmptyState title={`${levelName(level)} ${KIND_NAMES[kind]}題目準備中`} />
      ) : (
        <View style={{ gap: t.space[2] }}>
          {lessons.map((l) => {
            const s = lessonStats(doc.learning, level, kind, l.itemIds)
            const access = lessonAccess({ free: m.free, lessonNo: l.lessonNo, owned: doc.entitlement.owned, today, firstOpenDate: doc.meta.firstOpenDate })
            const tag = access !== 'open' ? '完整版・鎖定' : m.free === 'firstLesson' && l.lessonNo === 1 && !doc.entitlement.owned ? '免費試用' : ''
            return (
              <Card
                key={l.lessonNo}
                onPress={() => openLesson(l.lessonNo)}
                accessibilityLabel={`第 ${l.lessonNo} 課，已做 ${s.done}／${s.total}，掌握 ${s.mastered}${tag ? `，${tag}` : ''}`}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
                  <AppText variant="headline" style={{ flex: 1 }}>
                    第 {l.lessonNo} 課
                  </AppText>
                  {tag ? (
                    <AppText variant="footnote" color="ink2">
                      {tag}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="footnote" color="ink2" numeric>
                  已做 {s.done}／{s.total}・掌握 {s.mastered}
                </AppText>
              </Card>
            )
          })}
        </View>
      )}
    </Screen>
  )
}
