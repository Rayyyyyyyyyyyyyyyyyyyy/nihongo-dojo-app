// 段位帶（rewards §3.2）：打了結的布帶——填色帶身（上緣微亮、下緣微暗、縫線）、中央交叉的結、兩條略斜的垂尾；黑帶右端有朱線表段。
// 帶色取 tokens.belt，是圖形不承載文字，靠墨線外框辨識（tokens.json belt._rule）；明暗與縫線用 belt.white／belt.black 的低透明度疊層。
import { View } from 'react-native'
import { RANKS } from '../screens/names'
import { useTheme } from '../theme/ThemeProvider'

export function Belt({ rank, width = 160, onCeremony }: { rank: number; width?: number; onCeremony?: boolean }) {
  const t = useTheme()
  const info = RANKS[rank - 1]
  const outline = t.colors[onCeremony ? 'ceremonyOutline' : 'outline']
  const cloth = t.belt[info.belt]
  const h = Math.round(width / 8)
  const knotW = h * 1.3
  const tailW = h * 0.55
  const tail = (side: 1 | -1, len: number) => (
    <View
      testID="belt-tail"
      style={{ position: 'absolute', top: h * 0.6, left: width / 2 - tailW / 2 + side * tailW * 0.7, width: tailW, height: len, backgroundColor: cloth, borderWidth: 1.5, borderColor: outline, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, transform: [{ rotate: `${side * -9}deg` }], transformOrigin: 'top center' }}
    >
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: tailW * 0.3, width: 1, backgroundColor: t.belt.black, opacity: 0.18 }} />
    </View>
  )
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${info.name}的帶`} style={{ width, height: h * 2.7 }}>
      {tail(-1, h * 1.9)}
      {tail(1, h * 1.5)}
      <View style={{ width, height: h, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'stretch', gap: 6, paddingRight: 12, backgroundColor: cloth, borderWidth: 1.5, borderColor: outline, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h * 0.22, backgroundColor: t.belt.white, opacity: 0.22 }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.22, backgroundColor: t.belt.black, opacity: 0.18 }} />
        <View style={{ position: 'absolute', left: 4, right: 4, top: h * 0.28, borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.belt.black, opacity: 0.3 }} />
        <View style={{ position: 'absolute', left: 4, right: 4, bottom: h * 0.28, borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.belt.black, opacity: 0.3 }} />
        {Array.from({ length: info.stripes }, (_, i) => (
          <View key={i} testID="belt-stripe" style={{ width: 6, backgroundColor: t.belt.stripe }} />
        ))}
      </View>
      <View
        testID="belt-knot"
        style={{ position: 'absolute', left: (width - knotW) / 2, top: -h * 0.18, width: knotW, height: h * 1.36, borderRadius: t.radius.chip, backgroundColor: cloth, borderWidth: 1.5, borderColor: outline, overflow: 'hidden' }}
      >
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '40%', backgroundColor: t.belt.white, opacity: 0.22 }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%', backgroundColor: t.belt.black, opacity: 0.18 }} />
        <View style={{ position: 'absolute', left: '50%', top: 2, bottom: 2, width: 1.5, backgroundColor: outline, opacity: 0.6 }} />
        <View style={{ position: 'absolute', top: '50%', left: 2, right: 2, height: 1.5, backgroundColor: outline, opacity: 0.6 }} />
      </View>
    </View>
  )
}
