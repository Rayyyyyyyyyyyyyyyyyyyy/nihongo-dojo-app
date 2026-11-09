// 購買服務（handoff §2.3）：StoreKit 是唯一真相，Entitlement 只是離線快取，由這裡在驗證後寫入 store。
import { purchaseFlow, type PurchaseEvent, type PurchaseFlow } from '../domain/purchase'

export type RestoreResult = 'restored' | 'none' | 'error'

// StoreKit 的接縫：真實實作在 purchasesStoreKit.ts（expo-iap），測試用 fakeStoreGateway。
export interface StoreGateway {
  connect(): Promise<void>
  fetchPrice(productId: string): Promise<string | null> // 本地化價格字串；查無商品 null
  ownedProductIds(): Promise<string[]>
  restore(): Promise<string[]>
  requestPurchase(productId: string): Promise<void> // 結果經 onTransaction／onError 回來
  onTransaction(cb: (t: { productId: string; state: 'purchased' | 'pending' | 'unknown'; finish(): Promise<void> }) => void): () => void
  onError(cb: (e: { cancelled: boolean }) => void): () => void
}

export function createPurchases(
  gateway: StoreGateway,
  opts: { productId: string; setEntitlement: (owned: boolean, verifiedAt: string) => void; now: () => Date },
) {
  let flow: PurchaseFlow = { s: 'idle' }
  const listeners = new Set<() => void>()
  const send = (e: PurchaseEvent) => {
    const next = purchaseFlow(flow, e)
    if (next === flow) return
    flow = next
    listeners.forEach((l) => l())
  }
  const verified = () => opts.setEntitlement(true, opts.now().toISOString())

  return {
    getFlow: () => flow,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    // App 啟動時呼叫一次。監聽與畫面無關，所以 sheet 關閉後交易在背景完成仍會解鎖。
    async start() {
      const offTx = gateway.onTransaction(async (t) => {
        if (t.productId !== opts.productId) return
        if (t.state === 'pending') return send({ type: 'pending' })
        if (t.state !== 'purchased') return
        verified() // 先寫快取再 finish：中途被關，下次啟動 StoreKit 會重送未完成的交易
        send({ type: 'success' })
        await t.finish()
      })
      const offErr = gateway.onError((e) => send({ type: e.cancelled ? 'cancelled' : 'failed' }))
      await gateway.connect()
      await this.refresh()
      return () => {
        offTx()
        offErr()
      }
    },
    // 啟動與回到前景時讀目前 entitlements；讀不到就保留快取。
    async refresh() {
      try {
        opts.setEntitlement((await gateway.ownedProductIds()).includes(opts.productId), opts.now().toISOString())
      } catch {}
    },
    async loadProduct() {
      send({ type: 'load' })
      try {
        send({ type: 'loaded', price: await gateway.fetchPrice(opts.productId) })
      } catch {
        send({ type: 'loadFailed' })
      }
    },
    async buy() {
      if (flow.s !== 'ready') return
      send({ type: 'buy', now: opts.now().getTime() })
      try {
        await gateway.requestPurchase(opts.productId)
      } catch {
        send({ type: 'failed' })
      }
    },
    dismiss: () => send({ type: 'dismiss', now: opts.now().getTime() }),
    async restore(): Promise<RestoreResult> {
      try {
        if (!(await gateway.restore()).includes(opts.productId)) return 'none'
      } catch {
        return 'error'
      }
      verified()
      return 'restored'
    },
  }
}

// 測試替身：手動觸發交易與錯誤。
export function fakeStoreGateway(init: { price?: string | null; owned?: string[]; fail?: boolean } = {}) {
  let tx: Parameters<StoreGateway['onTransaction']>[0] = () => {}
  let err: Parameters<StoreGateway['onError']>[0] = () => {}
  const g = {
    owned: init.owned ?? [],
    price: init.price === undefined ? 'NT$290' : init.price,
    fail: init.fail ?? false,
    requests: [] as string[],
    finished: [] as string[],
    async connect() {},
    async fetchPrice() {
      if (g.fail) throw Error('offline')
      return g.price
    },
    async ownedProductIds() {
      if (g.fail) throw Error('offline')
      return g.owned
    },
    async restore() {
      return g.ownedProductIds()
    },
    async requestPurchase(id: string) {
      g.requests.push(id)
    },
    onTransaction(cb: typeof tx) {
      tx = cb
      return () => (tx = () => {})
    },
    onError(cb: typeof err) {
      err = cb
      return () => (err = () => {})
    },
    emit(productId: string, state: 'purchased' | 'pending' = 'purchased') {
      return tx({ productId, state, finish: async () => void g.finished.push(productId) })
    },
    emitError: (cancelled: boolean) => err({ cancelled }),
  }
  return g
}
