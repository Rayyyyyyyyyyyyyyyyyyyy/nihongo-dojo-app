// S15 還原購買（從「我的」推入）：狀態都在共用的 Restore；返回鍵一直可用，中途離開不留半套狀態。
import { Stack } from 'expo-router'
import { AppText, Screen } from '../../ui'
import { Restore } from './Restore'

export default function RestoreScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '還原購買' }} />
      <Screen>
        <AppText>用購買時的 Apple 帳號向 App Store 確認，重新取得 N3–N1 完整版。</AppText>
        <Restore />
      </Screen>
    </>
  )
}
