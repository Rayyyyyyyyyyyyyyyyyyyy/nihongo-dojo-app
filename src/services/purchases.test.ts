import { canDismiss, purchaseFlow } from '../domain/purchase'
import { createPurchases, fakeStoreGateway } from './purchases'

const ID = 'com.example.nihongodojo.full_n3_n1'
const setup = (init?: Parameters<typeof fakeStoreGateway>[0]) => {
  const gateway = fakeStoreGateway(init)
  const ent: Array<[boolean, string]> = []
  let t = 1_000_000
  const p = createPurchases(gateway, { productId: ID, setEntitlement: (o, at) => ent.push([o, at]), now: () => new Date(t) })
  return { gateway, ent, p, advance: (ms: number) => (t += ms) }
}

describe('購買狀態機（app-design §5.3）', () => {
  test('載入商品：成功 ready 帶本地化價格；查無商品 unavailable；失敗 productsError', async () => {
    const a = setup()
    await a.p.loadProduct()
    expect(a.p.getFlow()).toEqual({ s: 'ready', price: 'NT$290' })
    const b = setup({ price: null })
    await b.p.loadProduct()
    expect(b.p.getFlow().s).toBe('unavailable')
    const c = setup({ fail: true })
    await c.p.loadProduct()
    expect(c.p.getFlow().s).toBe('productsError')
  })

  test('連點購買只送一筆請求', async () => {
    const { p, gateway } = setup()
    await p.start()
    await p.loadProduct()
    await Promise.all([p.buy(), p.buy(), p.buy()])
    expect(gateway.requests).toEqual([ID])
  })

  test('使用者取消回到 ready，不顯示錯誤；其他失敗標 failed', async () => {
    const { p, gateway } = setup()
    await p.start()
    await p.loadProduct()
    await p.buy()
    gateway.emitError(true)
    expect(p.getFlow()).toEqual({ s: 'ready', price: 'NT$290' })
    await p.buy()
    gateway.emitError(false)
    expect(p.getFlow()).toEqual({ s: 'ready', price: 'NT$290', failed: true })
  })

  test('購買中 10 秒內不可關閉、10 秒後可關閉；關閉後交易在背景完成仍解鎖並 finish', async () => {
    const { p, gateway, ent, advance } = setup()
    await p.start()
    await p.loadProduct()
    await p.buy()
    advance(9_999)
    p.dismiss()
    expect(p.getFlow().s).toBe('purchasing')
    advance(1)
    p.dismiss()
    expect(p.getFlow().s).toBe('idle')
    await gateway.emit(ID)
    expect(ent[ent.length - 1][0]).toBe(true)
    expect(gateway.finished).toEqual([ID])
  })

  test('Ask to Buy 進入 pending；其他商品的交易不影響', async () => {
    const { p, gateway, ent } = setup()
    await p.start()
    await p.loadProduct()
    await p.buy()
    await gateway.emit(ID, 'pending')
    expect(p.getFlow().s).toBe('pending')
    await gateway.emit('other')
    expect(ent.filter(([o]) => o)).toEqual([])
  })

  test('啟動時以 StoreKit 目前 entitlements 更新快取；讀不到就保留快取', async () => {
    const a = setup({ owned: [ID] })
    await a.p.start()
    expect(a.ent).toEqual([[true, new Date(1_000_000).toISOString()]])
    const b = setup({ fail: true })
    await b.p.start()
    expect(b.ent).toEqual([])
  })

  test('還原購買：有紀錄 restored 並寫入；沒有 none；連線失敗 error，都不寫入 false', async () => {
    expect(await setup({ owned: [ID] }).p.restore()).toBe('restored')
    const none = setup()
    expect(await none.p.restore()).toBe('none')
    expect(none.ent).toEqual([])
    expect(await setup({ fail: true }).p.restore()).toBe('error')
  })

  test('純狀態機：非購買中隨時可關閉；ready 以外的 buy 無效', () => {
    expect(canDismiss({ s: 'ready', price: 'x' }, 0)).toBe(true)
    const idle = { s: 'idle' } as const
    expect(purchaseFlow(idle, { type: 'buy', now: 0 })).toBe(idle)
  })
})
