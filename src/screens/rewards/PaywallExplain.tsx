// S14a 第一天點鎖定課（app-design §5.1）：無價格、無購買鈕；仍可還原購買（S15 由下一個工作實作）。
import { Stack, useRouter } from 'expo-router'
import { AppText, Button, Screen } from '../../ui'

export default function PaywallExplain() {
  const router = useRouter()
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Screen>
        <AppText variant="title2" accessibilityRole="header">
          這是 N3–N1 完整版的內容
        </AppText>
        <AppText>今天先專心修行 N3 第 1 課，明天起可以在這裡查看完整版的內容與價格。</AppText>
        <Button label="回到第 1 課" onPress={() => router.back()} />
        <Button label="還原購買" variant="secondary" onPress={() => router.push('/restore')} />
      </Screen>
    </>
  )
}
