// S22 聲音、觸覺、外觀：切換即時生效並保存（保存失敗由 Screen 的橫條提示）；外觀由 RootNavigator 套用到 ThemeProvider。
import { Stack } from 'expo-router'
import { useServices } from '../../state/AppProvider'
import type { Settings as SettingsDoc } from '../../state/doc'
import { AppText, Card, Screen, Segmented } from '../../ui'
import { useDoc } from '../hooks'
import { SwitchRow } from './SwitchRow'

const APPEARANCE = [
  { value: 'system', label: '跟隨系統' },
  { value: 'light', label: '淺色' },
  { value: 'dark', label: '深色' },
] as const
const RATES = [
  { value: '0.8', label: '0.8×', a11y: '0.8 倍' },
  { value: '1', label: '1.0×', a11y: '1.0 倍' },
] as const

export default function Settings() {
  const { store, sound, haptics } = useServices()
  const s = useDoc().settings
  const set = (patch: Partial<SettingsDoc>) => store.updateSettings(patch)
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '聲音、觸覺、外觀' }} />
      <Screen>
        <Card>
          <SwitchRow
            title="音效"
            value={s.sound}
            onChange={(on) => {
              set({ sound: on })
              if (on) sound.play('correct') // 開啟時播放一次示範音
            }}
          />
          <SwitchRow
            title="觸覺"
            value={s.haptics}
            onChange={(on) => {
              set({ haptics: on })
              if (on) void haptics.play('selection')
            }}
          />
        </Card>
        <Card>
          <AppText variant="headline">外觀</AppText>
          <Segmented label="外觀" options={APPEARANCE} value={s.appearance} onChange={(appearance) => set({ appearance })} />
        </Card>
        <Card>
          <AppText variant="headline">語速預設</AppText>
          <Segmented label="語速預設" options={RATES} value={String(s.speechRate) as '0.8' | '1'} onChange={(v) => set({ speechRate: v === '1' ? 1.0 : 0.8 })} />
        </Card>
      </Screen>
    </>
  )
}
