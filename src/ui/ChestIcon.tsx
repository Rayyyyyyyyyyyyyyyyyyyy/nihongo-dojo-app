// 桐箱插圖：關／開兩態，用 View 組形狀（木色取帶色 brown，扣為朱印色）。開啟時蓋子掀開；減少動態時直接在打開位置。
import { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

export const CHEST_LID_MS = 400
const OPEN_DEG = -28

export function ChestIcon({ open = false }: { open?: boolean }) {
  const t = useTheme()
  const lid = useRef(new Animated.Value(open ? 1 : 0)).current
  useEffect(() => {
    if (t.motion.reduceMotion) lid.setValue(open ? 1 : 0)
    else Animated.timing(lid, { toValue: open ? 1 : 0, duration: CHEST_LID_MS, useNativeDriver: true }).start()
  }, [open, lid, t.motion.reduceMotion])
  const rotate = lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${OPEN_DEG}deg`] })
  const wood = t.belt.brown
  const edge = t.colors.outline
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={open ? '打開的桐箱' : '桐箱'} style={{ width: 168, alignItems: 'center' }}>
      <Animated.View
        testID="chest-lid"
        style={{ width: 168, height: 30, borderTopLeftRadius: t.radius.surface, borderTopRightRadius: t.radius.surface, backgroundColor: wood, borderWidth: 2, borderColor: edge, transform: [{ rotate }], transformOrigin: 'left bottom' }}
      />
      <View style={{ width: 160, height: 92, backgroundColor: wood, borderWidth: 2, borderTopWidth: 0, borderColor: edge, borderBottomLeftRadius: t.radius.chip, borderBottomRightRadius: t.radius.chip, alignItems: 'center' }}>
        {!open && <View style={{ width: 22, height: 30, marginTop: -8, borderRadius: t.radius.chip, backgroundColor: t.colors.seal, borderWidth: 2, borderColor: edge }} />}
      </View>
    </View>
  )
}
