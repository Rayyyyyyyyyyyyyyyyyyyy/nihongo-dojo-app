// 段位帶（rewards §3.2）：帶色取 tokens.belt，帶結置中，黑帶右端的朱線表段。帶色是圖形不承載文字，靠外框辨識（tokens.json belt._rule）。
import { View } from 'react-native'
import { RANKS } from '../screens/names'
import { useTheme } from '../theme/ThemeProvider'

export function Belt({ rank, width = 160, onCeremony }: { rank: number; width?: number; onCeremony?: boolean }) {
  const t = useTheme()
  const info = RANKS[rank - 1]
  const outline = t.colors[onCeremony ? 'ceremonyOutline' : 'outline']
  const h = Math.round(width / 8)
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${info.name}的帶`}
      style={{ width, height: h, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'stretch', gap: 6, paddingRight: 12, backgroundColor: t.belt[info.belt], borderWidth: 1.5, borderColor: outline }}
    >
      <View
        style={{ position: 'absolute', left: (width - h * 1.4) / 2 - 1.5, top: -h * 0.2, width: h * 1.4, height: h * 1.4, borderRadius: t.radius.chip, backgroundColor: t.belt[info.belt], borderWidth: 1.5, borderColor: outline }}
      />
      {Array.from({ length: info.stripes }, (_, i) => (
        <View key={i} testID="belt-stripe" style={{ width: 6, backgroundColor: t.belt.stripe }} />
      ))}
    </View>
  )
}
