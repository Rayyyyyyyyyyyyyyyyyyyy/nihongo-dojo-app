// S12 收集冊（app-design §6 S12、rewards §7）：只是掌握狀態的檢視，沒有自己的完成紀錄；點亮沿用既有掌握判定（決策 F5-6）。
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import type { LevelBank } from '../../data/bank'
import type { StudyKind } from '../../domain/learning/types'
import { itemKey } from '../../domain/learning/types'
import { LEVELS } from '../../domain/progress/state'
import { collectionBoard, COSMETICS, FIRST_STAMP } from '../../domain/rewards'
import { useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, EmptyState, ErrorState, Screen, Seal, Segmented, Skeleton } from '../../ui'
import { useDoc, useLevelBank, useNavLock } from '../hooks'
import { chestText, KIND_NAMES, LEVEL_OPTIONS } from '../names'
import { isMastered } from '../practice/stats'

const KINDS: StudyKind[] = ['vocab', 'grammar', 'reading', 'listening']
const STAMP_IDS = [FIRST_STAMP, ...COSMETICS.filter((id) => id.startsWith('stamp-'))]

function Stamps() {
  const t = useTheme()
  const owned = useDoc().rewards.chest.ownedCosmetics
  const stamps = STAMP_IDS.map((id) => {
    const name = chestText(id === FIRST_STAMP ? { type: 'firstStamp' } : { type: 'cosmetic', id }).name
    return { id, name, on: owned.includes(id) }
  })
  const have = stamps.filter((x) => x.on).length
  return (
    <Card>
      <AppText variant="headline" accessibilityRole="header" numeric>
        {`印章・已取得 ${have}／${stamps.length}`}
      </AppText>
      {have === 0 && <AppText color="ink2">完成今日目標後開桐箱，就有機會拿到印章。</AppText>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] }}>
        {stamps.map(({ id, name, on }) => (
          <View key={id} accessible accessibilityLabel={`${name}，${on ? '已取得' : '未取得'}`} style={{ width: 72, alignItems: 'center', gap: t.space[1] }}>
            <Seal text={name.replace(/印$/, '').slice(0, 1)} hollow={!on} size={56} label={name} />
            <AppText variant="footnote" color={on ? 'ink' : 'ink3'} ja style={{ textAlign: 'center' }}>
              {on ? name : '未取得'}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  )
}

const label = (bank: LevelBank, kind: StudyKind, id: string, i: number) =>
  kind === 'vocab' ? id : kind === 'grammar' ? (bank.grammar.find((g) => g.id === id)?.answer ?? id) : kind === 'reading' ? (bank.reading.find((r) => r.id === id)?.title ?? id) : `第 ${i + 1} 題`

export default function Collection() {
  const t = useTheme()
  const doc = useDoc()
  const router = useRouter()
  const go = useNavLock()
  const { manifest } = useServices().bank
  const [level, setLevel] = useState(doc.learning.level) // 分頁保持掛載：回來時保留等級與類別篩選
  const [kind, setKind] = useState<StudyKind | 'stamp'>('vocab')
  const bank = useLevelBank(level)

  const boardOf = (l: typeof level, k: StudyKind) => {
    const ids = manifest.levels[l].lessons[k].flatMap((x) => x.itemIds)
    const idOf = new Map(ids.map((id) => [itemKey({ level: l, kind: k, id }), id]))
    const lit = new Set(collectionBoard([...idOf.keys()], (key) => isMastered(doc.learning, l, k, idOf.get(key)!)).lit)
    return { ids, lit, isLit: (id: string) => lit.has(itemKey({ level: l, kind: k, id })) }
  }
  const stamps = kind === 'stamp'
  const sk: StudyKind = kind === 'stamp' ? 'vocab' : kind
  const nothingLit = LEVELS.every((l) => KINDS.every((k) => boardOf(l, k).lit.size === 0))
  const board = boardOf(level, sk)
  const m = manifest.levels[level]
  const shown = m.free === 'all' || doc.entitlement.owned ? board.ids : (m.lessons[sk][0]?.itemIds ?? [])
  const more = board.ids.length - shown.length

  return (
    <Screen>
      {nothingLit && !stamps && (
        <EmptyState title="掌握一個單字或文法，就會在這裡掛上第一塊札">
          <Button label="去修行" onPress={() => go(() => router.navigate('/practice'))} />
        </EmptyState>
      )}
      {!stamps && <Segmented label="等級" options={LEVEL_OPTIONS} value={level} onChange={setLevel} />}
      <Segmented label="類別" options={[...KINDS.map((k) => ({ value: k, label: KIND_NAMES[k] })), { value: 'stamp' as const, label: '印章' }]} value={kind} onChange={setKind} />
      {stamps ? (
        <Stamps />
      ) : bank.status === 'loading' ? (
        <Skeleton rows={3} label="札板載入中" />
      ) : bank.status === 'error' ? (
        <ErrorState title="題庫載入失敗" onRetry={bank.retry} />
      ) : (
        <Card>
          <AppText variant="headline" accessibilityRole="header" numeric>
            {`${KIND_NAMES[sk]}札板・已掛 ${board.lit.size}／${board.ids.length}`}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
            {shown.map((id, i) => {
              const on = board.isLit(id)
              const text = label(bank.bank, sk, id, i)
              return (
                <View
                  key={id}
                  accessible
                  accessibilityLabel={`${text}，${on ? '已掌握' : '未掌握'}`}
                  style={{
                    width: 60,
                    aspectRatio: 3 / 5,
                    borderRadius: t.radius.surface,
                    borderWidth: 1,
                    borderStyle: on ? 'solid' : 'dashed',
                    borderColor: t.colors[on ? 'separator' : 'outline'],
                    backgroundColor: t.colors[on ? 'surface' : 'bg'],
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: t.space[1],
                  }}
                >
                  {on && <View style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderTopRightRadius: t.radius.surface, backgroundColor: t.colors.seal }} />}
                  <AppText ja variant="footnote" color={on ? 'ink' : 'ink3'} numberOfLines={3} style={{ textAlign: 'center', fontFamily: t.font.display.family }}>
                    {text}
                  </AppText>
                </View>
              )
            })}
          </View>
          {more > 0 && (
            <AppText color="ink2" numeric>
              完整版另有 {more.toLocaleString('en-US')} 項
            </AppText>
          )}
        </Card>
      )}
    </Screen>
  )
}
