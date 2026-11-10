// S18 每日目標與提醒：規則在 domain/reminder.ts，排程在 services/notifications.ts。
// 開提醒前先說明（每天最多 1 則），按「設定提醒」才呼叫系統權限；被拒時引導到系統設定，回來時重新讀取。
import { Stack, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, View } from 'react-native'
import { syncReminders, type Permission, type SyncResult } from '../../services/notifications'
import { useServices } from '../../state/AppProvider'
import type { Settings } from '../../state/doc'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, ErrorState, Screen, Segmented, useAnnounce } from '../../ui'
import { useDoc } from '../hooks'
import { SwitchRow } from './SwitchRow'

const MINUTES = [
  { value: '5', label: '5 分鐘' },
  { value: '10', label: '10 分鐘' },
  { value: '20', label: '20 分鐘' },
] as const

// 時段以 30 分鐘為一格前後調整（沒有原生時間選擇器套件）。
const shift = (time: string, delta: number) => {
  const [h, m] = time.split(':').map(Number)
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function Reminders() {
  const t = useTheme()
  const { store, notifier, clock } = useServices()
  const settings = useDoc().settings
  const r = settings.reminder
  const [perm, setPerm] = useState<Permission | null>(null)
  const [sync, setSync] = useState<SyncResult | null>(null)
  const [asking, setAsking] = useState(false) // 顯示權限前說明卡
  const [requesting, setRequesting] = useState(false)

  const resync = useCallback(async () => setSync(await syncReminders(notifier, store.getState().doc!, clock)), [notifier, store, clock])
  const setReminder = (patch: Partial<Settings['reminder']>) => {
    store.updateSettings({ reminder: { ...store.getState().doc!.settings.reminder, ...patch } })
    void resync()
  }
  // 進入畫面、從系統設定回來時重新讀權限並重排。
  const refresh = useCallback(async () => {
    setPerm(await notifier.permission().catch(() => 'undetermined' as const))
    if (store.getState().doc!.settings.reminder.enabled) await resync()
  }, [notifier, store, resync])
  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh]),
  )
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void refresh())
    return () => sub.remove()
  }, [refresh])

  const toggle = (on: boolean) => {
    if (on && perm === 'undetermined') return setAsking(true)
    setAsking(false)
    setReminder({ enabled: on })
  }
  const request = async () => {
    setRequesting(true)
    const p = await notifier.request().catch(() => 'denied' as const)
    setRequesting(false)
    setAsking(false)
    setPerm(p)
    if (p === 'granted') setReminder({ enabled: true })
  }

  const denied = perm === 'denied'
  const status = !r.enabled || denied ? '目前沒有提醒' : `每天 ${r.time} 提醒（連勝 3 天以上且當天未練時）`
  useAnnounce(sync === 'failed' && r.enabled ? '提醒沒有排好，請再試一次' : status)
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '每日目標與提醒' }} />
      <Screen>
        <Card>
          <AppText variant="headline">每日目標</AppText>
          <Segmented
            label="每日目標"
            options={MINUTES}
            value={String(settings.dailyMinutes) as '5' | '10' | '20'}
            onChange={(v) => {
              store.updateSettings({ dailyMinutes: Number(v) as Settings['dailyMinutes'] })
              if (r.enabled) void resync() // 提醒文案帶分鐘數
            }}
          />
        </Card>
        <Card>
          <SwitchRow title="提醒" value={r.enabled && !denied} onChange={toggle} note={denied ? '通知權限已關閉' : undefined} />
          {denied && <Button variant="secondary" label="打開系統設定" onPress={() => void Linking.openSettings()} />}
          {asking && (
            <Card tone="surface2">
              <AppText>要不要每天提醒你修行？你選時段，每天最多 1 則。</AppText>
              <Button label="設定提醒" loading={requesting} onPress={request} />
              <Button variant="text" label="之後再說" disabled={requesting} onPress={() => setAsking(false)} />
            </Card>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
            <AppText style={{ flex: 1 }}>時段</AppText>
            <Button variant="text" label="−30" accessibilityLabel="提早 30 分鐘" onPress={() => setReminder({ time: shift(r.time, -30) })} />
            <AppText variant="headline" numeric accessibilityLabel={`時段 ${r.time}`}>
              {r.time}
            </AppText>
            <Button variant="text" label="+30" accessibilityLabel="延後 30 分鐘" onPress={() => setReminder({ time: shift(r.time, 30) })} />
          </View>
          <AppText accessibilityLiveRegion="polite" color="ink2">
            {status}
          </AppText>
        </Card>
        {sync === 'failed' && r.enabled && <ErrorState title="提醒沒有排好，請再試一次" onRetry={() => void resync()} />}
      </Screen>
    </>
  )
}
