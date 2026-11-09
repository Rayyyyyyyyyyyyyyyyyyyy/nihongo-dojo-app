// S16 資料與備份：iCloud 備份／還原、恢復點（快照）與撤銷、保存失敗重試、損毀時從頭開始、匯出進度碼。
// 覆寫類操作一律先在卡片內確認；進行中所有操作停用（重複操作）。文件損毀時 doc 為 null，只提供恢復路徑。
import { Stack, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Share, View } from 'react-native'
import { encodeCode } from '../../domain/progress/state'
import type { BackupError, BackupFile } from '../../services/backup'
import { MAX_SNAPSHOTS, type Snapshot } from '../../services/storage'
import { useAppState, useServices } from '../../state/AppProvider'
import { AppText, Button, Card, EmptyState, ErrorState, Screen } from '../../ui'
import { useSlow } from './useSlow'

export const BACKUP_ERRORS: Record<BackupError, string> = {
  unavailable: 'iCloud 無法使用：沒有登入 iCloud，或已關閉 iCloud Drive。可以改用下方的匯出進度碼。',
  noSpace: 'iCloud 空間不足，備份沒有完成，你的進度沒有變動。可以改用下方的匯出進度碼。',
  invalid: '備份檔無法使用，沒有套用。',
  unknown: '備份沒有完成，你的進度沒有變動。請再試一次，或改用匯出進度碼。',
}
const REASONS: Record<Snapshot['reason'], string> = { beforeImport: '匯入前', beforeRestore: '還原前', beforeUndo: '恢復前', beforeReset: '從頭開始前' }

const pad = (n: number) => String(n).padStart(2, '0')
export const stamp = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Cloud = { status: 'loading' } | { status: 'ready'; file: BackupFile | null } | { status: 'error'; error: BackupError }
type Confirm = { kind: 'restore' } | { kind: 'undo'; index: number } | { kind: 'reset' } | null

export function Backup() {
  const { store, backup } = useServices()
  const { status, doc, snapshots, saveError } = useAppState((s) => s)
  const router = useRouter()
  const [cloud, setCloud] = useState<Cloud>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const slow = useSlow(busy !== null || cloud.status === 'loading')

  useEffect(() => {
    let alive = true
    setCloud({ status: 'loading' })
    void backup.latest().then((r) => alive && setCloud(r.ok ? { status: 'ready', file: r.value } : { status: 'error', error: r.error }))
    return () => {
      alive = false
    }
  }, [backup, attempt])

  // 一次只跑一個操作；結果寫在頁面上（離開後回來仍看得到，因為元件不卸載時 state 保留）。
  const run = async (name: string, fn: () => Promise<string>) => {
    if (busy) return
    setBusy(name)
    setConfirm(null)
    setMessage(null)
    try {
      setMessage({ ok: true, text: await fn() })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const doBackup = () =>
    run('backup', async () => {
      const r = await backup.backup(doc!)
      if (!r.ok) throw Error(BACKUP_ERRORS[r.error])
      setCloud({ status: 'ready', file: null })
      setAttempt((a) => a + 1)
      return `已備份（${stamp(r.value)}）`
    })
  const doRestore = (file: BackupFile) =>
    run('restore', async () => {
      await store.restoreBackup(file.doc)
      return `已從 iCloud 還原（${stamp(file.createdAt)} 的備份）。還原前的進度已存成恢復點。`
    })
  const doUndo = (index: number) =>
    run('undo', async () => {
      await store.undo(index)
      return '已恢復。恢復前的進度也存成了恢復點，可以再撤銷。'
    })
  const doReset = () =>
    run('reset', async () => {
      await store.startFresh()
      return '已從頭開始。原始檔案已另存，舊進度也存成了恢復點。'
    })

  const full = snapshots.length >= MAX_SNAPSHOTS
  const evictNote = full ? `恢復點已滿 ${MAX_SNAPSHOTS} 份，這次操作會淘汰最舊的一份（${stamp(snapshots[0].at)}）。` : null
  const confirmCard = (text: string, label: string, onYes: () => void) => (
    <Card tone="warnBg" accessibilityRole="alert">
      <AppText>{text}</AppText>
      {evictNote && <AppText variant="callout">{evictNote}</AppText>}
      <Button variant="destructive" label={label} onPress={onYes} />
      <Button variant="text" label="取消" onPress={() => setConfirm(null)} />
    </Card>
  )

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '資料與備份' }} />
      <Screen>
        {message &&
          (message.ok ? (
            <Card tone="correctBg" accessibilityRole="alert" accessibilityLiveRegion="polite">
              <AppText>{message.text}</AppText>
            </Card>
          ) : (
            <ErrorState title="沒有完成" message={message.text} />
          ))}
        {slow && <AppText color="ink2" accessibilityLiveRegion="polite">還在處理，可以先離開，完成後在這頁顯示結果。</AppText>}

        {status === 'corrupt' && (
          <ErrorState title="進度資料無法讀取，已保留原始資料" message="可以從 iCloud 還原、選一個恢復點，或從頭開始。">
            {confirm?.kind === 'reset' ? (
              confirmCard('從頭開始會建立新的進度。損毀的原始檔案會另存一份，不會刪除。確定嗎？', '確定從頭開始', doReset)
            ) : (
              <Button variant="destructive" label="從頭開始" disabled={!!busy} loading={busy === 'reset'} onPress={() => setConfirm({ kind: 'reset' })} />
            )}
          </ErrorState>
        )}

        {saveError && (
          <ErrorState
            title="進度暫時沒有保存"
            message="練習照常在記憶體進行。可以再試一次保存，或先匯出進度碼。"
            retryLabel="再試一次保存"
            onRetry={() =>
              void run('save', async () => {
                await store.retrySave()
                if (store.getState().saveError) throw Error('還是沒有保存成功。請先匯出進度碼。')
                return '已保存。'
              })
            }
          />
        )}

        <AppText variant="headline" accessibilityRole="header">
          iCloud 備份
        </AppText>
        {cloud.status === 'loading' && <AppText color="ink2">正在查詢 iCloud…</AppText>}
        {cloud.status === 'error' && <ErrorState title="無法讀取 iCloud" message={BACKUP_ERRORS[cloud.error]} onRetry={() => setAttempt((a) => a + 1)} />}
        {cloud.status === 'ready' && !cloud.file && <EmptyState title="iCloud 上還沒有備份" />}
        {cloud.status === 'ready' && cloud.file && (
          <Card>
            <AppText>最近的備份：{stamp(cloud.file.createdAt)}</AppText>
            {confirm?.kind === 'restore' ? (
              confirmCard('還原會用 iCloud 備份覆寫這台 iPhone 上的進度。還原前會自動建立恢復點。', '覆寫並還原', () => doRestore(cloud.file!))
            ) : (
              <Button variant="secondary" label="從 iCloud 還原" disabled={!!busy} loading={busy === 'restore'} onPress={() => setConfirm({ kind: 'restore' })} />
            )}
          </Card>
        )}
        {doc && <Button label="立即備份" disabled={!!busy} loading={busy === 'backup'} onPress={doBackup} />}

        <AppText variant="headline" accessibilityRole="header">
          恢復點
        </AppText>
        <AppText color="ink2" variant="callout">
          匯入、還原、恢復與從頭開始之前都會自動存一份，最多保留 {MAX_SNAPSHOTS} 份。
        </AppText>
        {snapshots.length === 0 ? (
          <EmptyState title="還沒有恢復點" />
        ) : (
          snapshots
            .map((s, index) => ({ s, index }))
            .reverse()
            .map(({ s, index }) => (
              <Card key={`${s.at}-${index}`}>
                <AppText>
                  {stamp(s.at)}・{REASONS[s.reason]}
                </AppText>
                {confirm?.kind === 'undo' && confirm.index === index ? (
                  confirmCard(`要把進度恢復到 ${stamp(s.at)} 嗎？目前的進度會先存成恢復點。`, '恢復到這裡', () => doUndo(index))
                ) : (
                  <Button
                    variant="secondary"
                    label="恢復到這裡"
                    accessibilityLabel={`恢復到 ${stamp(s.at)}，${REASONS[s.reason]}`}
                    disabled={!!busy}
                    onPress={() => setConfirm({ kind: 'undo', index })}
                  />
                )}
              </Card>
            ))
        )}

        {doc && (
          <>
            <AppText variant="headline" accessibilityRole="header">
              進度碼
            </AppText>
            <Button variant="secondary" label="從網頁版匯入" disabled={!!busy} onPress={() => router.push('/import')} />
            {code === null ? (
              <Button variant="secondary" label="匯出進度碼" onPress={() => setCode(encodeCode(doc.learning))} />
            ) : (
              <Card>
                <AppText variant="callout">進度碼不是加密，請勿公開；不包含購買。長按可選取拷貝。</AppText>
                <View accessible accessibilityLabel="進度碼">
                  <AppText selectable numberOfLines={6} variant="footnote">
                    {code}
                  </AppText>
                </View>
                <Button variant="secondary" label="分享進度碼" onPress={() => void Share.share({ message: code }).catch(() => undefined)} />
              </Card>
            )}
          </>
        )}
      </Screen>
    </>
  )
}
