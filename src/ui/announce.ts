// iOS VoiceOver 不讀 accessibilityLiveRegion（只有 Android）；狀態結果改變時用系統公告朗讀一次。
// 第一次渲染的值不公告（進入畫面不是結果）；之後每次變成新的非空文字都公告。
import { useEffect, useRef } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useAnnounce(text: string | null | false | undefined) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (text) AccessibilityInfo.announceForAccessibility(text)
  }, [text])
}
