// 畫面共用 hooks：今天、目前文件、題庫載入狀態。
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LevelBank } from '../data/bank'
import { localDate } from '../domain/learning/calendar'
import type { Level } from '../domain/progress/state'
import { useAppState, useServices } from '../state/AppProvider'
import type { AppStateDoc } from '../state/doc'

export const useDoc = (): AppStateDoc => useAppState((s) => s.doc!) // 畫面都在 AppGate 之內，ready 時一定有文件
export function useToday(): string {
  const { clock } = useServices()
  useAppState((s) => s.doc) // 文件變更（例如回到前景的 refreshDay）時重算日期
  return localDate(clock())
}

export type BankState = { status: 'loading' } | { status: 'ready'; bank: LevelBank } | { status: 'error' }

// 內建題庫在畫面出現後才載入（第一幀先畫出來）；驗證失敗回報 error，可重試。
export function useLevelBank(level: Level): BankState & { retry: () => void } {
  const { bank } = useServices()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<BankState & { key: string }>({ status: 'loading', key: '' })
  const key = `${level}:${attempt}`
  useEffect(() => {
    let alive = true
    Promise.resolve()
      .then(() => bank.load(level))
      .then(
        (b) => alive && setState({ status: 'ready', bank: b, key }),
        () => alive && setState({ status: 'error', key }),
      )
    return () => {
      alive = false
    }
  }, [bank, level, key])
  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  return { ...(state.key === key ? state : { status: 'loading' }), retry }
}

// 連點只觸發一次：導覽後鎖住，畫面重新取得焦點時解鎖（app-design §6 重複操作）。
export function useNavLock() {
  const locked = useRef(false)
  useFocusEffect(
    useCallback(() => {
      locked.current = false
    }, []),
  )
  return useCallback((fn: () => void) => {
    if (locked.current) return
    locked.current = true
    fn()
  }, [])
}
