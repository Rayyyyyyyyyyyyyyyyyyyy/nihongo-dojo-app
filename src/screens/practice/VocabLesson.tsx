// S8 單字課：翻卡／讀音測驗入口與單字清單（虛擬化）；篩選「到期」、搜尋；手動標記已掌握（不給 XP、可再點取消）。
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, TextInput, View } from 'react-native'
import { lessonAccess } from '../../domain/access'
import { itemKey } from '../../domain/learning/types'
import { useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, EmptyState, ErrorState, SaveErrorBanner, Screen, Segmented, Skeleton } from '../../ui'
import { useDoc, useLevelBank, useNavLock, useToday } from '../hooks'

export default function VocabLesson() {
  const t = useTheme()
  const doc = useDoc()
  const today = useToday()
  const { bank: banks } = useServices()
  const router = useRouter()
  const go = useNavLock()
  const lesson = Number(useLocalSearchParams<{ lesson?: string }>().lesson ?? 1)
  const level = doc.learning.level
  const bank = useLevelBank(level)
  const [filter, setFilter] = useState<'all' | 'due'>('all')
  const [query, setQuery] = useState('')
  const ids = banks.manifest.levels[level].lessons.vocab.find((l) => l.lessonNo === lesson)?.itemIds ?? []
  const words = useMemo(() => (bank.status === 'ready' ? ids.flatMap((id) => bank.bank.vocab.find((v) => v.w === id) ?? []) : []), [bank, ids])
  const due = (w: string) => (doc.learning.schedules[itemKey({ level, kind: 'vocab', id: w })]?.dueOn ?? '9999') <= today
  const shown = words.filter((v) => (filter === 'all' || due(v.w)) && (!query || v.w.includes(query) || v.r.includes(query) || v.zh.includes(query)))
  const start = (vmode: 'flashcard' | 'pronunciation') =>
    go(() => router.push({ pathname: '/session', params: { src: 'lesson', kind: 'vocab', lesson: String(lesson), vmode } }))

  // 深連結也要套用購買限制：未開放的課不列單字、不能標記掌握，只提供完整版說明入口。
  const access = lessonAccess({
    free: banks.manifest.levels[level].free,
    lessonNo: lesson,
    owned: doc.entitlement.owned,
    today,
    firstOpenDate: doc.meta.firstOpenDate,
  })
  if (access !== 'open')
    return (
      <Screen>
        <EmptyState title="這是 N3–N1 完整版的內容">
          <Button label="查看完整版" onPress={() => go(() => router.push(access === 'explainOnly' ? '/paywall-explain' : '/paywall'))} />
        </EmptyState>
      </Screen>
    )

  const header = (
    <View style={{ gap: t.space[3], paddingBottom: t.space[3] }}>
      <SaveErrorBanner />
      <View style={{ flexDirection: 'row', gap: t.space[3] }}>
        <View style={{ flex: 1 }}>
          <Button label="翻卡" onPress={() => start('flashcard')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="讀音測驗" variant="secondary" onPress={() => start('pronunciation')} />
        </View>
      </View>
      <Segmented label="篩選" options={[{ value: 'all', label: '全部' }, { value: 'due', label: '到期' }]} value={filter} onChange={setFilter} />
      <TextInput
        accessibilityLabel="搜尋單字"
        placeholder="搜尋單字、讀音或中文"
        placeholderTextColor={t.colors.ink3}
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
        style={[t.typeStyle('body'), { color: t.colors.ink, minHeight: t.layout.touchTargetMin, backgroundColor: t.colors.surface, borderRadius: t.radius.surface, paddingHorizontal: t.space[3], borderWidth: 1, borderColor: t.colors.separator }]}
      />
    </View>
  )
  const empty =
    bank.status === 'loading' ? (
      <Skeleton rows={6} />
    ) : bank.status === 'error' ? (
      <ErrorState title="題庫載入失敗" onRetry={bank.retry} />
    ) : query ? (
      <EmptyState title={`找不到「${query}」`}>
        <Button variant="secondary" label="清除搜尋" onPress={() => setQuery('')} />
      </EmptyState>
    ) : filter === 'due' ? (
      <EmptyState title="沒有到期的單字">
        <Button variant="secondary" label="改看全部" onPress={() => setFilter('all')} />
      </EmptyState>
    ) : (
      <EmptyState title="這一課沒有單字" />
    )

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: t.colors.bg }}
      contentContainerStyle={{ padding: t.layout.gutter, gap: 1 }}
      data={shown}
      keyExtractor={(v) => v.w}
      initialNumToRender={20}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item: v }) => {
        const known = Object.hasOwn(doc.learning.vKnown[level], v.w)
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], minHeight: t.layout.listRowMinHeight, backgroundColor: t.colors.surface, paddingHorizontal: t.space[3] }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyJa" ja>
                {v.w}
                <AppText variant="footnote" color="ink2" ja>
                  {'　'}
                  {v.r}
                </AppText>
              </AppText>
              <AppText variant="footnote" color="ink2">
                {v.zh}
                {due(v.w) ? '・到期' : ''}
              </AppText>
            </View>
            {/* 掌握只能靠作答（使用者 2026-11-10 決定），不提供手動標記，避免一鍵點亮收集冊。 */}
            {known && (
              <AppText variant="footnote" color="ink2" accessibilityLabel={`${v.w}，已掌握`}>
                已掌握
              </AppText>
            )}
          </View>
        )
      }}
    />
  )
}
