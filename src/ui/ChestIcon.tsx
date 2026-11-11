// 桐箱插圖：關／開兩態，另有上鎖態（壓暗、掛鎖）。用 View 組形狀：木色取帶色 brown、板縫與紋理用墨線疊層、扣為朱印色。
// 開啟時蓋子掀開；減少動態時直接在打開位置。width 可縮放（預設 168），內部尺寸依比例。
import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

export const CHEST_LID_MS = 400
const OPEN_DEG = -28
const GRAIN: [number, number, number][] = [[10, 8, 34], [60, 15, 22], [104, 11, 38], [26, 38, 28], [86, 46, 30], [12, 62, 24], [70, 70, 36]] // [left, top, width]

export function ChestIcon({ open = false, locked = false, remaining, width = 168 }: { open?: boolean; locked?: boolean; remaining?: number; width?: number }) {
  const t = useTheme()
  const u = width / 168
  const lid = useRef(new Animated.Value(open ? 1 : 0)).current
  useEffect(() => {
    if (t.motion.reduceMotion) lid.setValue(open ? 1 : 0)
    else Animated.timing(lid, { toValue: open ? 1 : 0, duration: CHEST_LID_MS, useNativeDriver: true }).start()
  }, [open, lid, t.motion.reduceMotion])
  const rotate = lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${OPEN_DEG}deg`] })
  const wood = t.belt.brown
  const edge = t.colors.outline
  const bw = Math.max(1, 2 * u)
  const label = locked ? `桐箱，還沒解鎖${remaining ? `，再 ${remaining} 題` : ''}` : open ? '打開的桐箱' : '桐箱'
  const dim = locked && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.belt.black, opacity: 0.4 }]} />
  const line = (style: object, opacity: number, color: string = t.belt.black) => <View style={{ position: 'absolute', height: Math.max(1, u), backgroundColor: color, opacity, ...style }} />
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width, alignItems: 'center' }}>
      <Animated.View
        testID="chest-lid"
        style={{ width, height: 30 * u, overflow: 'hidden', borderTopLeftRadius: t.radius.surface, borderTopRightRadius: t.radius.surface, backgroundColor: wood, borderWidth: bw, borderColor: edge, transform: [{ rotate }], transformOrigin: 'left bottom' }}
      >
        {line({ left: 6 * u, right: 6 * u, top: 3 * u }, 0.3, t.belt.white)}
        {line({ left: 20 * u, top: 12 * u, width: 40 * u }, 0.18)}
        {line({ left: 96 * u, top: 17 * u, width: 44 * u }, 0.18)}
        {dim}
      </Animated.View>
      <View style={{ width: width - 8 * u, height: 92 * u, overflow: 'hidden', backgroundColor: wood, borderWidth: bw, borderTopWidth: 0, borderColor: edge, borderBottomLeftRadius: t.radius.chip, borderBottomRightRadius: t.radius.chip }}>
        {line({ left: 0, right: 0, top: 0, height: 7 * u }, 0.3 /* 蓋下的陰影，分開蓋與箱身 */)}
        {[1, 2, 3].map((i) => <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: 23 * u * i, height: Math.max(1, 1.5 * u), backgroundColor: edge, opacity: 0.55 }} />)}
        {GRAIN.map(([l, tp, w], i) => <View key={i} style={{ position: 'absolute', left: l * u, top: tp * u + (i % 2) * 2 * u, width: w * u, height: Math.max(1, u), backgroundColor: t.belt.black, opacity: 0.16 }} />)}
        {dim}
      </View>
      {!open && !locked && (
        <View testID="chest-clasp" style={{ position: 'absolute', top: 22 * u, width: 24 * u, height: 32 * u, borderRadius: t.radius.chip, backgroundColor: t.colors.seal, borderWidth: bw, borderColor: edge, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 6 * u, height: 6 * u, borderRadius: 3 * u, backgroundColor: t.colors.onAccent }} />
        </View>
      )}
      {locked && (
        <View testID="chest-lock" style={{ position: 'absolute', top: 14 * u, alignItems: 'center' }}>
          <View style={{ width: 20 * u, height: 16 * u, borderTopLeftRadius: 10 * u, borderTopRightRadius: 10 * u, borderWidth: 3 * u, borderBottomWidth: 0, borderColor: t.belt.white }} />
          <View style={{ width: 32 * u, height: 26 * u, borderRadius: t.radius.chip, backgroundColor: t.belt.black, borderWidth: bw, borderColor: t.belt.white, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 6 * u, height: 10 * u, borderRadius: 3 * u, backgroundColor: t.belt.white }} />
          </View>
        </View>
      )}
    </View>
  )
}
