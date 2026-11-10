// 還原購買（S15 狀態表）：S14 與 S14a 共用；entitlement 只在 purchases.restore 驗證成功後寫入。
// 等待：<300ms 只有按鈕進行中，之後顯示「正在向 App Store 確認」，超過 10 秒加「還在處理，可以先離開」（§6 共用規則）。
import { useEffect, useRef, useState } from 'react'
import { DISMISS_AFTER_MS } from '../../domain/purchase'
import type { RestoreResult } from '../../services/purchases'
import { useServices } from '../../state/AppProvider'
import { AppText, Button, ErrorState, SKELETON_DELAY_MS } from '../../ui'
import { useDoc } from '../hooks'

export function Restore() {
  const { purchases } = useServices()
  const owned = useDoc().entitlement.owned
  const [r, setR] = useState<'idle' | 'busy' | 'already' | RestoreResult>('idle')
  const [waited, setWaited] = useState(0)
  const running = useRef(false) // 連點只送一次請求
  useEffect(() => {
    if (r !== 'busy') return
    const a = setTimeout(() => setWaited(SKELETON_DELAY_MS), SKELETON_DELAY_MS)
    const b = setTimeout(() => setWaited(DISMISS_AFTER_MS), DISMISS_AFTER_MS)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [r])
  const run = async () => {
    if (running.current) return
    if (owned) return setR('already')
    running.current = true
    setWaited(0)
    setR('busy')
    setR(await purchases.restore())
    running.current = false
  }
  return (
    <>
      {r === 'error' ? (
        <ErrorState title="無法連線 App Store" onRetry={() => void run()} />
      ) : (
        <Button label="還原購買" variant="secondary" loading={r === 'busy'} onPress={() => void run()} />
      )}
      {r === 'busy' && waited >= SKELETON_DELAY_MS && <AppText accessibilityLiveRegion="polite">正在向 App Store 確認</AppText>}
      {r === 'busy' && waited >= DISMISS_AFTER_MS && <AppText accessibilityLiveRegion="polite">還在處理，可以先離開</AppText>}
      {r === 'none' && (
        <AppText accessibilityLiveRegion="polite">
          這個 Apple 帳號沒有完整版購買紀錄。如果你用其他 Apple 帳號購買過，請先在系統設定切換帳號。
        </AppText>
      )}
      {r === 'restored' && <AppText accessibilityLiveRegion="polite">已還原完整版</AppText>}
      {r === 'already' && <AppText accessibilityLiveRegion="polite">已確認，你擁有完整版</AppText>}
    </>
  )
}
