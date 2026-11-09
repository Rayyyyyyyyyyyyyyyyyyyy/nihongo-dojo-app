// S14 購買狀態機（app-design §5.3）。純函式；時間由呼叫端傳入。
export type PurchaseFlow =
  | { s: 'idle' }
  | { s: 'productsLoading' }
  | { s: 'productsError' } // 無法連線 App Store：可重試
  | { s: 'unavailable' } // 查無商品：還原購買仍可用
  | { s: 'ready'; price: string; failed?: boolean } // failed：上次購買沒有完成（不是取消）
  | { s: 'purchasing'; price: string; startedAt: number }
  | { s: 'pending'; price: string } // Ask to Buy／延遲付款
  | { s: 'verified' }

export type PurchaseEvent =
  | { type: 'load' }
  | { type: 'loaded'; price: string | null }
  | { type: 'loadFailed' }
  | { type: 'buy'; now: number }
  | { type: 'success' }
  | { type: 'pending' }
  | { type: 'cancelled' }
  | { type: 'failed' }
  | { type: 'dismiss'; now: number }

export const DISMISS_AFTER_MS = 10_000 // 修正審查 F6：購買中 10 秒後才可關閉

export const canDismiss = (f: PurchaseFlow, now: number) => f.s !== 'purchasing' || now - f.startedAt >= DISMISS_AFTER_MS

export function purchaseFlow(f: PurchaseFlow, e: PurchaseEvent): PurchaseFlow {
  switch (e.type) {
    case 'load':
      return f.s === 'purchasing' || f.s === 'pending' ? f : { s: 'productsLoading' }
    case 'loaded':
      return f.s !== 'productsLoading' ? f : e.price === null ? { s: 'unavailable' } : { s: 'ready', price: e.price }
    case 'loadFailed':
      return f.s === 'productsLoading' ? { s: 'productsError' } : f
    case 'buy': // 連點只送一筆：只有 ready 能進入購買中
      return f.s === 'ready' ? { s: 'purchasing', price: f.price, startedAt: e.now } : f
    case 'success': // 交易可能在 sheet 關閉後才在背景完成，任何狀態都進入 verified
      return { s: 'verified' }
    case 'pending':
      return f.s === 'purchasing' ? { s: 'pending', price: f.price } : f
    case 'cancelled': // 取消不顯示錯誤
      return f.s === 'purchasing' ? { s: 'ready', price: f.price } : f
    case 'failed':
      return f.s === 'purchasing' ? { s: 'ready', price: f.price, failed: true } : f
    case 'dismiss':
      return canDismiss(f, e.now) ? { s: 'idle' } : f
  }
}
