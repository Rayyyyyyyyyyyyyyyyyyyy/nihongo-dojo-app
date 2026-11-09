// S12–S22 占位畫面：保留路由與導覽入口，內容由下一個工作實作。
import { Stack } from 'expo-router'
import { EmptyState, Screen } from '../ui'

export function Placeholder({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <Screen>
        <EmptyState title={title} message={note ?? `${id} 下一版實作。`} />
      </Screen>
    </>
  )
}
