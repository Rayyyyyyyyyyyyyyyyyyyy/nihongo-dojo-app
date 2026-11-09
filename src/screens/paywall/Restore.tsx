// 還原購買（S15 狀態表）：S14 與 S14a 共用；entitlement 只在 purchases.restore 驗證成功後寫入。
import { useState } from 'react'
import type { RestoreResult } from '../../services/purchases'
import { useServices } from '../../state/AppProvider'
import { AppText, Button, ErrorState } from '../../ui'
import { useDoc } from '../hooks'

export function Restore() {
  const { purchases } = useServices()
  const owned = useDoc().entitlement.owned
  const [r, setR] = useState<'idle' | 'busy' | 'already' | RestoreResult>('idle')
  const run = async () => {
    if (owned) return setR('already')
    setR('busy')
    setR(await purchases.restore())
  }
  return (
    <>
      {r === 'error' ? (
        <ErrorState title="無法連線 App Store" onRetry={run} />
      ) : (
        <Button label="還原購買" variant="secondary" loading={r === 'busy'} onPress={run} />
      )}
      {r === 'busy' && <AppText accessibilityLiveRegion="polite">正在向 App Store 確認</AppText>}
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
