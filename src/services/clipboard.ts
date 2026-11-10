// 剪貼簿（S20 拷貝題目代碼）：失敗回傳 false，畫面改請使用者手動選取。
import * as Clipboard from 'expo-clipboard'

export const copyText = (text: string): Promise<boolean> => Clipboard.setStringAsync(text).catch(() => false)
