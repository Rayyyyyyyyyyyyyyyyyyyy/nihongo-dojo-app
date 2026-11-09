// 進度條：8pt、surface2 軌、primary 填；寬度以 scaleX 動畫（不動 width），減少動態時直接跳到新值。
import { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

export function ProgressBar({ value, max, label, text }: { value: number; max: number; label: string; text?: string }) {
  const t = useTheme()
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const scale = useRef(new Animated.Value(ratio)).current
  useEffect(() => {
    if (t.motion.reduceMotion) scale.setValue(ratio)
    else Animated.timing(scale, { toValue: ratio, duration: t.motion.duration.base, useNativeDriver: true }).start()
  }, [ratio, scale, t.motion])
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max), text: text ?? `${value}／${max}` }}
      style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.surface2, overflow: 'hidden' }}
    >
      <Animated.View
        style={{ height: 8, width: '100%', backgroundColor: t.colors.primary, transformOrigin: 'left', transform: [{ scaleX: scale }] }}
      />
    </View>
  )
}
