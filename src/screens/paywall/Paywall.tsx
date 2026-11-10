// S14 付費畫面（app-design §5.2、§5.3、§6 S14）：價格只用 StoreKit 回傳字串；無倒數、無刪除線、無限時字樣。
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useReducer, useRef } from 'react'
import { Linking, View } from 'react-native'
import { canDismiss, DISMISS_AFTER_MS } from '../../domain/purchase'
import { useAppState, usePurchaseFlow, useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, EmptyState, ErrorState, Screen, Skeleton, useAnnounce } from '../../ui'
import { KIND_NAMES, levelName } from '../names'
import { Restore } from './Restore'

// 占位：隱私政策與使用條款網址未定，上架前換成正式網址（研究 5.1.1(i)）。
export const PRIVACY_URL = 'https://example.com/privacy'
export const TERMS_URL = 'https://example.com/terms'
const PAID_LEVELS = ['n3', 'n2', 'n1'] as const
const KINDS = ['grammar', 'reading', 'listening', 'vocab'] as const

export default function Paywall() {
  const t = useTheme()
  const router = useRouter()
  const { purchases, clock, bank } = useServices()
  const flow = usePurchaseFlow()
  const owned = useAppState((s) => s.doc!.entitlement.owned)
  const p = useLocalSearchParams<{ kind?: string; lesson?: string }>()
  const [, tick] = useReducer((n: number) => n + 1, 0)
  const startS = useRef(flow.s)

  useEffect(() => {
    if (!owned) void purchases.loadProduct()
  }, [purchases]) // eslint-disable-line react-hooks/exhaustive-deps -- 只在開啟時載入一次

  // 購買中：10 秒後重繪，出現「先離開」。
  useEffect(() => {
    if (flow.s !== 'purchasing') return
    const id = setTimeout(tick, Math.max(0, flow.startedAt + DISMISS_AFTER_MS - clock().getTime()))
    return () => clearTimeout(id)
  }, [flow, clock])

  // 這次開啟期間購買成功：進入原本要進的課（從 S7 來時有課程參數），否則返回。
  const justBought = flow.s === 'verified' && startS.current !== 'verified'
  useAnnounce(justBought && '已解鎖 N3–N1 完整版')
  useEffect(() => {
    if (!justBought) return
    if (!p.lesson) router.back()
    else if (p.kind === 'vocab') router.replace({ pathname: '/practice/vocab', params: { lesson: p.lesson } })
    else router.replace({ pathname: '/session', params: { src: 'lesson', kind: p.kind!, lesson: p.lesson } })
  }, [justBought]) // eslint-disable-line react-hooks/exhaustive-deps

  const closable = canDismiss(flow, clock().getTime())
  const close = () => {
    purchases.dismiss()
    router.back()
  }
  const price = flow.s === 'ready' || flow.s === 'purchasing' || flow.s === 'pending' ? flow.price : null

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: closable }} />
      <Screen modal>
        {closable && (
          <View style={{ alignItems: 'flex-end' }}>
            <Button variant="text" label={flow.s === 'purchasing' ? '先離開，完成後會自動解鎖' : '關閉'} onPress={close} />
          </View>
        )}
        <AppText variant="title2" accessibilityRole="header">
          N3–N1 完整版
        </AppText>
        <AppText>一次購買，不是訂閱。之後新增的 N3–N1 內容免費更新。</AppText>
        <Card>
          {PAID_LEVELS.map((l) => {
            const c = bank.manifest.levels[l].counts
            // §5.2-3：N2／N1 有任一類題數少於其他付費等級，就照實顯示並附「持續補充中」。
            const fewer = l !== 'n3' && KINDS.some((k) => PAID_LEVELS.some((o) => bank.manifest.levels[o].counts[k] > c[k]))
            const text = `${levelName(l)}：${KINDS.map((k) => `${KIND_NAMES[k]} ${c[k]} 題`).join('、')}${fewer ? '（持續補充中）' : ''}`
            return <AppText key={l}>{text}</AppText>
          })}
        </Card>
        {owned && !justBought ? (
          <EmptyState title="你已擁有完整版" />
        ) : flow.s === 'verified' ? (
          <EmptyState title="已解鎖 N3–N1 完整版" />
        ) : flow.s === 'productsError' ? (
          <>
            <ErrorState title="無法連線 App Store" onRetry={() => void purchases.loadProduct()} />
            <Button label="購買" disabled />
          </>
        ) : flow.s === 'unavailable' ? (
          <EmptyState title="目前無法購買，請稍後再試" />
        ) : price === null ? (
          <>
            <Skeleton rows={1} label="載入價格中" />
            <Button label="載入價格中" disabled />
          </>
        ) : (
          <>
            <AppText variant="title1" numeric>
              {price}
            </AppText>
            {flow.s === 'ready' && flow.failed && <ErrorState title="購買沒有完成，沒有扣款" message="可以再試一次；若不確定，請用「還原購買」確認。" />}
            {flow.s === 'pending' ? (
              <EmptyState title="已送出，等待家長核准" message="核准後會自動解鎖。" />
            ) : (
              <Button label={`購買 ${price}`} loading={flow.s === 'purchasing'} onPress={() => void purchases.buy()} />
            )}
          </>
        )}
        <Restore />
        <View style={{ gap: t.space[2] }}>
          <AppText variant="footnote" color="ink2">
            付款由 Apple 處理。購買會綁定你的 Apple 帳號，可在其他裝置用「還原購買」取得。
          </AppText>
          <View style={{ flexDirection: 'row', gap: t.space[4] }}>
            <Button variant="text" accessibilityRole="link" label="隱私政策" onPress={() => void Linking.openURL(PRIVACY_URL)} />
            <Button variant="text" accessibilityRole="link" label="使用條款" onPress={() => void Linking.openURL(TERMS_URL)} />
          </View>
        </View>
      </Screen>
    </>
  )
}
