// StoreGateway 的真實實作：expo-iap（StoreKit 2）。需要 development build；sandbox 未實測（handoff §5 E-01）。
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
} from 'expo-iap'
import type { StoreGateway } from './purchases'

const ownedIds = async () => (await getAvailablePurchases()).map((p) => p.productId)

export const storeKitGateway: StoreGateway = {
  async connect() {
    await initConnection()
  },
  async fetchPrice(productId) {
    const products = await fetchProducts({ skus: [productId], type: 'in-app' })
    return products?.find((p) => p.id === productId)?.displayPrice ?? null
  },
  ownedProductIds: ownedIds,
  async restore() {
    await restorePurchases()
    return ownedIds()
  },
  async requestPurchase(productId) {
    try {
      await requestPurchase({ request: { apple: { sku: productId } }, type: 'in-app' })
    } catch (e) {
      if (!isUserCancelledError(e)) throw e // 取消也會經 purchaseErrorListener 回報，這裡不當失敗
    }
  },
  onTransaction(cb) {
    const sub = purchaseUpdatedListener((p) =>
      cb({ productId: p.productId, state: p.purchaseState, finish: () => finishTransaction({ purchase: p, isConsumable: false }) }),
    )
    return () => sub.remove()
  },
  onError(cb) {
    const sub = purchaseErrorListener((e) => cb({ cancelled: isUserCancelledError(e) }))
    return () => sub.remove()
  },
}
