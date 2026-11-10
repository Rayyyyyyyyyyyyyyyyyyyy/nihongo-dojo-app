// 外部操作（iCloud）超過 10 秒時回傳 true，畫面顯示「還在處理，可以先離開」（app-design §6 共用規則）。
import { useEffect, useState } from 'react'

export const SLOW_MS = 10_000

export function useSlow(active: boolean): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    setSlow(false)
    if (!active) return
    const id = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(id)
  }, [active])
  return slow
}
