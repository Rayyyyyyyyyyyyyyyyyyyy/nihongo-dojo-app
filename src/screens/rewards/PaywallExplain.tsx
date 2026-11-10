// S14a 第一天點鎖定課（app-design §5.1）：無價格、無購買鈕；仍可還原購買。
import { Stack, useRouter } from 'expo-router'
import { AppText, Button, Screen } from '../../ui'
import { useDoc, goBack } from '../hooks'
import { levelName } from '../names'
import { Restore } from '../paywall/Restore'

export default function PaywallExplain() {
  const router = useRouter()
  const level = useDoc().learning.level
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Screen>
        <AppText variant="title2" accessibilityRole="header">
          這是 N3–N1 完整版的內容
        </AppText>
        <AppText>{`今天先專心修行 ${levelName(level)} 第 1 課，明天起可以在這裡查看完整版的內容與價格。`}</AppText>
        <Button label="回到第 1 課" onPress={() => goBack(router)} />
        <Restore />
      </Screen>
    </>
  )
}
