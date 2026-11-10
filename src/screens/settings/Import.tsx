// S17 從網頁版匯入 v5 進度碼：貼上 → 驗證 → 預覽 → 確認覆寫 → 結果（可撤銷）。
// 錯誤寫在欄位下方，輸入保留。首次體驗尚未完成時是首次模式（O1 次要入口）：成功後回 O3。
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { TextInput, View } from 'react-native'
import type { BankManifest } from '../../domain/bank/manifest'
import { itemKey } from '../../domain/learning/types'
import { importWebV5Code } from '../../domain/progress/importCode'
import { LEVELS, type ProgressState } from '../../domain/progress/state'
import { useAppState, useServices } from '../../state/AppProvider'
import { importedItems } from '../../state/core'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, ErrorState, Screen, useAnnounce } from '../../ui'
import { levelName } from '../names'
import { evictNote } from './Backup'

// 驗證器的錯誤訊息換成 app-design S17 錯誤列的文字。
export function importError(message: string): string {
  if (message.includes('不支援此版本')) return '這個進度碼的版本比 App 新，請更新 App。'
  if (message.includes('v4')) return '這是舊版（v4）進度碼。請先在網頁版開啟一次，讓它升級，再重新匯出。'
  if (message.includes('無法解碼')) return '這不是有效的進度碼。'
  return '進度碼內容不完整或互相矛盾。'
}

// U2：碼內的項目不在目前題庫（已退役或題目已更新）就算「不可用」，紀錄照樣保留。
export function unavailableCount(s: ProgressState, manifest: BankManifest): number {
  const shipped = new Set<string>()
  for (const level of LEVELS)
    for (const [kind, lessons] of Object.entries(manifest.levels[level].lessons))
      for (const l of lessons) for (const id of l.itemIds) shipped.add(itemKey({ level, kind: kind as never, id }))
  const keys = new Set<string>()
  for (const level of LEVELS) {
    for (const id of [...Object.keys(s.vKnown[level]), ...Object.keys(s.vLearning[level])]) keys.add(itemKey({ level, kind: 'vocab', id }))
    for (const id of s.gDone[level]) keys.add(itemKey({ level, kind: 'grammar', id }))
    for (const id of [...s.lDone[level], ...s.lCorrect[level]]) keys.add(itemKey({ level, kind: 'listening', id }))
    for (const id of s.rDone[level]) keys.add(itemKey({ level, kind: 'reading', id }))
  }
  for (const sc of Object.values(s.schedules)) keys.add(itemKey(sc.ref))
  return [...keys].filter((k) => !shipped.has(k)).length
}

const md = (date: string) => (date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : '')
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

type Phase = { s: 'edit'; error: string | null } | { s: 'preview'; state: ProgressState; confirming: boolean } | { s: 'done'; lit: number } | { s: 'undone' }

export default function Import() {
  const { store, bank } = useServices()
  const firstRun = useAppState((s) => s.doc!.meta.onboarding !== 'done')
  const snapshots = useAppState((s) => s.snapshots)
  const router = useRouter()
  const t = useTheme()
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<Phase>({ s: 'edit', error: null })
  const [busy, setBusy] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const check = () => {
    if (!code.trim()) return setPhase({ s: 'edit', error: '請貼上進度碼' })
    try {
      setPhase({ s: 'preview', state: importWebV5Code(code), confirming: false })
    } catch (e) {
      setPhase({ s: 'edit', error: importError((e as Error).message) })
    }
  }
  const apply = async (state: ProgressState) => {
    if (busy) return
    setBusy(true)
    setApplyError(null)
    try {
      await store.importV5(code)
      setPhase({ s: 'done', lit: importedItems(state).length })
    } catch {
      setPhase({ s: 'preview', state, confirming: false })
      setApplyError('匯入沒有套用，你的進度沒有變動。')
    } finally {
      setBusy(false)
    }
  }
  const undo = async () => {
    if (busy) return
    setBusy(true)
    setApplyError(null)
    try {
      await store.undo()
      setPhase({ s: 'undone' })
    } catch (e) {
      setApplyError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const doneText = phase.s === 'done' && `匯入完成。已依掌握紀錄點亮收集冊 ${thousands(phase.lit)} 塊札。XP 從今天的修行開始累計。`
  const undoneText = '已撤銷這次匯入，進度回到匯入前。撤銷前的進度也存成了恢復點。'
  useAnnounce(applyError ? `沒有完成。${applyError}` : doneText || (phase.s === 'undone' && undoneText))
  const leave = () => {
    if (firstRun) {
      if (phase.s === 'done') store.setOnboarding('minutes')
      router.replace('/onboarding')
    } else router.back()
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '從網頁版匯入' }} />
      <Screen>
        {phase.s === 'edit' && (
          <>
            <View style={{ gap: t.space[2] }}>
              <AppText variant="headline" nativeID="code-label">
                網頁版進度碼
              </AppText>
              <AppText color="ink2" variant="callout">
                在網頁版「首頁 → 備份」按「匯出」取得，長按欄位可貼上。
              </AppText>
              <TextInput
                accessibilityLabel="網頁版進度碼"
                accessibilityLabelledBy="code-label"
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                value={code}
                onChangeText={(v) => {
                  setCode(v)
                  if (phase.error) setPhase({ s: 'edit', error: null })
                }}
                style={{
                  ...t.typeStyle('footnote'),
                  minHeight: 120,
                  color: t.colors.ink,
                  backgroundColor: t.colors.surface,
                  borderColor: phase.error ? t.colors.wrong : t.colors.outline,
                  borderWidth: 1,
                  borderRadius: t.radius.surface,
                  padding: t.space[3],
                  textAlignVertical: 'top',
                }}
              />
              {phase.error && (
                <AppText color="wrong" accessibilityRole="alert">
                  {phase.error}
                </AppText>
              )}
            </View>
            <Button label="檢查進度碼" onPress={check} />
          </>
        )}

        {phase.s === 'preview' && (
          <>
            <Card>
              <AppText variant="headline">將匯入</AppText>
              {LEVELS.map((l) => (
                <AppText key={l}>
                  {levelName(l)} 單字 {Object.keys(phase.state.vKnown[l]).length}／{bank.manifest.levels[l].counts.vocab} 掌握
                </AppText>
              ))}
              <AppText>
                連勝 {phase.state.streak} 天{phase.state.lastDate ? `（最後學習 ${md(phase.state.lastDate)}）` : ''}
              </AppText>
              <AppText>錯題 {Object.keys(phase.state.mistakes).length}</AppText>
              <AppText>不可用項目 {unavailableCount(phase.state, bank.manifest)}（題目已更新或退役，紀錄會保留）</AppText>
            </Card>
            <AppText>
              匯入會覆寫這台 iPhone 上的學習進度。你的 XP、段位、寶箱收藏與保護卡不受影響；匯入前沒有練習的日子不會扣保護卡。匯入前會自動建立恢復點。
            </AppText>
            {applyError && <ErrorState title="沒有完成" message={applyError} />}
            {phase.confirming ? (
              <Card tone="warnBg" accessibilityRole="alert">
                <AppText>確定要用這個進度碼覆寫目前的學習進度嗎？</AppText>
                {evictNote(snapshots) && <AppText variant="callout">{evictNote(snapshots)}</AppText>}
                <Button variant="destructive" label="確定覆寫" loading={busy} onPress={() => void apply(phase.state)} />
                <Button variant="text" label="取消" disabled={busy} onPress={() => setPhase({ ...phase, confirming: false })} />
              </Card>
            ) : (
              <>
                <Button variant="destructive" label="覆寫並匯入" onPress={() => setPhase({ ...phase, confirming: true })} />
                <Button variant="text" label="修改進度碼" onPress={() => setPhase({ s: 'edit', error: null })} />
              </>
            )}
          </>
        )}

        {phase.s === 'done' && (
          <>
            <Card tone="correctBg" accessibilityRole="alert" accessibilityLiveRegion="polite">
              <AppText>{doneText}</AppText>
            </Card>
            {applyError && <ErrorState title="沒有完成" message={applyError} />}
            <Button label={firstRun ? '繼續設定' : '完成'} disabled={busy} onPress={leave} />
            <Button variant="secondary" label="撤銷這次匯入" loading={busy} onPress={() => void undo()} />
          </>
        )}

        {phase.s === 'undone' && (
          <>
            <Card accessibilityRole="alert">
              <AppText>{undoneText}</AppText>
            </Card>
            <Button label={firstRun ? '回到歡迎頁' : '完成'} onPress={leave} />
          </>
        )}
      </Screen>
    </>
  )
}
