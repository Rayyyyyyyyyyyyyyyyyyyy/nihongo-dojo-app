// 桐箱（kiri-bako）插圖：淡米白的桐木盒，平蓋略寬於盒身，以朱色真田紐一字綁、蓋頂打結。關／開／上鎖三態：
// 開啟時蓋子掀起、紐鬆開垂在一側；上鎖（今日目標未完成）是同一個綁緊的盒子，疊一層淡墨降彩度，不畫鎖。
// 木色取 tokens kiri／kiriDeep；減少動態時蓋子直接在打開位置。width 可縮放（預設 168），內部尺寸依比例。
import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

export const CHEST_LID_MS = 400
const OPEN_DEG = -28
const GRAIN: [number, number, number][] = [[10, 10, 40], [70, 22, 26], [108, 8, 36], [24, 36, 30], [90, 48, 34], [14, 62, 22], [76, 70, 40]] // [left, top, width]

export function ChestIcon({ open = false, locked = false, remaining, width = 168 }: { open?: boolean; locked?: boolean; remaining?: number; width?: number }) {
  const t = useTheme()
  const u = width / 168
  const lid = useRef(new Animated.Value(open ? 1 : 0)).current
  useEffect(() => {
    if (t.motion.reduceMotion) lid.setValue(open ? 1 : 0)
    else Animated.timing(lid, { toValue: open ? 1 : 0, duration: CHEST_LID_MS, useNativeDriver: true }).start()
  }, [open, lid, t.motion.reduceMotion])
  const rotate = lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${OPEN_DEG}deg`] })
  const edge = t.colors.outline
  const bw = Math.max(1, 1.5 * u)
  const cord = t.colors.seal
  const label = locked ? `桐箱，還沒解鎖${remaining ? `，再 ${remaining} 題` : ''}` : open ? '打開的桐箱' : '桐箱'
  const dim = locked && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.belt.black, opacity: 0.22 }]} />
  const band = (testID?: string) => <View testID={testID} style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', marginLeft: -4 * u, width: 8 * u, backgroundColor: cord }} />
  const tail = (deg: number, len: number) => (
    <View style={{ position: 'absolute', top: 8 * u, left: '50%', marginLeft: -3.5 * u, width: 7 * u, height: len * u, borderRadius: 1.5 * u, backgroundColor: cord, borderWidth: Math.max(1, u), borderColor: edge, transform: [{ rotate: `${deg}deg` }], transformOrigin: 'top center' }} />
  )
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width, alignItems: 'center', paddingTop: 8 * u }}>
      <Animated.View
        testID="chest-lid"
        style={{ width, height: 26 * u, overflow: 'hidden', borderRadius: 3 * u, backgroundColor: t.colors.kiri, borderWidth: bw, borderColor: edge, transform: [{ rotate }], transformOrigin: 'left bottom' }}
      >
        {GRAIN.slice(0, 3).map(([l, tp, w], i) => <View key={i} style={{ position: 'absolute', left: l * u, top: tp * u, width: w * u, height: Math.max(1, u * 0.8), backgroundColor: t.belt.black, opacity: 0.07 }} />)}
        {!open && band()}
        {dim}
      </Animated.View>
      <View style={{ width: width - 14 * u, height: 84 * u, overflow: 'hidden', backgroundColor: t.colors.kiriDeep, borderWidth: bw, borderTopWidth: 0, borderColor: edge, borderBottomLeftRadius: 3 * u, borderBottomRightRadius: 3 * u }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 6 * u, backgroundColor: t.belt.black, opacity: 0.12 /* 蓋下的陰影 */ }} />
        {GRAIN.map(([l, tp, w], i) => <View key={i} style={{ position: 'absolute', left: l * u, top: tp * u + 8 * u, width: w * u, height: Math.max(1, u * 0.8), backgroundColor: t.belt.black, opacity: 0.07 }} />)}
        {!open && band('chest-cord')}
        {dim}
      </View>
      {!open ? (
        <View testID="chest-knot" style={{ position: 'absolute', top: 0, width: 0, height: 0, alignItems: 'center' }}>
          {tail(18, 22)}
          {tail(-24, 17)}
          <View style={{ position: 'absolute', top: 0, width: 20 * u, height: 14 * u, borderRadius: 7 * u, backgroundColor: cord, borderWidth: Math.max(1, u), borderColor: edge }} />
        </View>
      ) : (
        <View testID="chest-cord-loose" style={{ position: 'absolute', right: 2 * u, top: 40 * u, width: 7 * u, height: 54 * u, borderRadius: 3 * u, backgroundColor: cord, borderWidth: Math.max(1, u), borderColor: edge, transform: [{ rotate: '10deg' }], transformOrigin: 'top center' }} />
      )}
    </View>
  )
}
