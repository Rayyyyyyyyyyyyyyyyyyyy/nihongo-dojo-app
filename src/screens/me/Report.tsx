// S20 回報題目：首版只「複製題目代碼」，不自動傳送任何資料（維持「不收集資料」的隱私申報）。
// 代碼＝題目 key＋contentVersion，例如 N3-grammar-g-n3-045@c2026.11.1。
import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import { copyText } from '../../services/clipboard'
import { useServices } from '../../state/AppProvider'
import { AppText, Button, Card, Screen } from '../../ui'

export const COPIED_MS = 1500

export function reportCode(key: string | undefined, contentVersion: string): string | null {
  try {
    const [level, kind, id] = JSON.parse(key ?? '') as string[]
    return level && kind && id ? `${level.toUpperCase()}-${kind}-${id}@c${contentVersion}` : null
  } catch {
    return null
  }
}

export default function Report() {
  const { key } = useLocalSearchParams<{ key?: string }>()
  const code = reportCode(key, useServices().bank.manifest.contentVersion)
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (status !== 'copied') return
    const id = setTimeout(() => setStatus('idle'), COPIED_MS)
    return () => clearTimeout(id)
  }, [status])
  const copy = async () => {
    const ok = await copyText(code!)
    setStatus(ok ? 'copied' : 'failed')
    if (ok) AccessibilityInfo.announceForAccessibility('已拷貝')
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '回報題目' }} />
      <Screen>
        {code ? (
          <Card>
            <AppText variant="headline">題目代碼</AppText>
            <AppText selectable numeric accessibilityHint="長按可選取">
              {code}
            </AppText>
            <Button label="拷貝" variant="secondary" onPress={copy} />
            {status === 'copied' && <AppText accessibilityLiveRegion="polite">已拷貝</AppText>}
            {status === 'failed' && <AppText accessibilityLiveRegion="polite">沒有拷貝成功，請長按上方代碼手動選取。</AppText>}
          </Card>
        ) : (
          <Card>
            <AppText>覺得題目有錯時，在那題的解析區按「回報這題」，就會看到題目代碼。</AppText>
          </Card>
        )}
        <AppText color="ink2">拷貝後可透過 App Store 頁面的支援網址回報。App 不會自動傳送任何資料。</AppText>
      </Screen>
    </>
  )
}
