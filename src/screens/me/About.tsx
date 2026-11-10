// S19 關於與資料來源：全為文字（VoiceOver 可讀）；連結用系統瀏覽器開，開不了時改顯示可選取的網址。
import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { Linking } from 'react-native'
import { ATTRIBUTION_TEXT, DATA_SOURCES } from '../../content/attribution'
import { LICENSE_NOTICES, OPEN_SOURCE } from '../../content/licenses'
import { useServices } from '../../state/AppProvider'
import { AppText, Button, Card, Screen } from '../../ui'

const SELLER_NAME = '{{SELLER_NAME}}' // U3：送審前必須填入

function Link({ label, url }: { label: string; url: string }) {
  const [failed, setFailed] = useState(false)
  if (failed)
    return (
      <AppText selectable color="ink2" accessibilityHint="長按可拷貝網址">
        {url}
      </AppText>
    )
  return (
    <Button
      variant="text"
      label={label}
      accessibilityRole="link"
      onPress={() => Linking.openURL(url).catch(() => setFailed(true))}
    />
  )
}

export default function About() {
  const { bank } = useServices()
  const jmdict = DATA_SOURCES[0]
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '關於與資料來源' }} />
      <Screen>
        <Card>
          <AppText variant="title2" accessibilityRole="header">
            日本語道場
          </AppText>
          <AppText numeric>版本 {Constants.expoConfig?.version ?? '—'}</AppText>
          <AppText numeric>內容版本 {bank.manifest.contentVersion}</AppText>
          <AppText>賣家 {SELLER_NAME}</AppText>
          <AppText>本 App 為依 JLPT 程度設計的原創練習題，非 JLPT 官方試題；AI 輔助起草、經人工審閱。</AppText>
        </Card>
        <AppText variant="headline" accessibilityRole="header">
          資料來源
        </AppText>
        <Card>
          <AppText>{ATTRIBUTION_TEXT}</AppText>
          <AppText>
            繁中釋義：作為 {jmdict.name} 等上述資料的衍生內容，以 {jmdict.license} 提供；本 App 不主張這些資料的著作權。
          </AppText>
        </Card>
        {DATA_SOURCES.map((d) => (
          <Card key={d.name}>
            <AppText variant="headline">{d.name}</AppText>
            <AppText color="ink2">{d.holder}</AppText>
            <AppText>{d.note}</AppText>
            <Link label={`授權：${d.license}`} url={d.licenseUrl} />
            <Link label={`來源：${d.name}`} url={d.url} />
          </Card>
        ))}
        <AppText variant="headline" accessibilityRole="header">
          授權全文
        </AppText>
        {LICENSE_NOTICES.map((n) => (
          <Card key={n.source}>
            <AppText variant="headline">{n.source}</AppText>
            <AppText variant="footnote" selectable>
              {n.text}
            </AppText>
          </Card>
        ))}
        <AppText variant="headline" accessibilityRole="header">
          開源套件
        </AppText>
        <Card>
          {OPEN_SOURCE.map((p) => (
            <AppText key={p.name} variant="footnote">
              {p.name}（{p.license}）
            </AppText>
          ))}
        </Card>
      </Screen>
    </>
  )
}
