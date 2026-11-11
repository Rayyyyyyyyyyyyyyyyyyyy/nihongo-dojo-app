// 段位帶（rewards §3.2）：打了結的布帶——填色帶身（上緣微亮、下緣微暗、淡縫線）、兩片短帶斜向交疊成結、兩條略斜的實心帶尾；黑帶右端有朱線表段。
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
  const tailW = h * 0.8
  const tail = (side: 1 | -1, len: number) => (
    <View
      testID="belt-tail"
      style={{ position: 'absolute', top: h * 0.5, left: width / 2 - tailW / 2 + side * tailW * 0.6, width: tailW, height: len, backgroundColor: cloth, borderWidth: 1.5, borderColor: outline, borderBottomLeftRadius: 1, borderBottomRightRadius: tailW * 0.4, transform: [{ rotate: `${side * -10}deg` }], transformOrigin: 'top center', overflow: 'hidden' }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '25%', backgroundColor: t.belt.black, opacity: 0.14 }} />
    </View>
  )
  const piece = (deg: number) => (
    <View style={{ position: 'absolute', left: (width - h * 1.1) / 2, top: h * 0.125, width: h * 1.1, height: h * 0.75, backgroundColor: cloth, borderWidth: 1.5, borderColor: outline, borderRadius: 2, overflow: 'hidden', transform: [{ rotate: `${deg}deg` }] }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '30%', backgroundColor: t.belt.white, opacity: 0.22 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%', backgroundColor: t.belt.black, opacity: 0.16 }} />
    </View>
  )
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${info.name}的帶`} style={{ width, height: h * 2.7 }}>
      {tail(-1, h * 1.9)}
      {tail(1, h * 1.5)}
      <View style={{ width, height: h, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'stretch', gap: 6, paddingRight: 12, backgroundColor: cloth, borderWidth: 1.5, borderColor: outline, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h * 0.22, backgroundColor: t.belt.white, opacity: 0.22 }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.22, backgroundColor: t.belt.black, opacity: 0.18 }} />
        <View style={{ position: 'absolute', left: 4, right: 4, top: h * 0.28, borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.belt.black, opacity: 0.15 }} />
        <View style={{ position: 'absolute', left: 4, right: 4, bottom: h * 0.28, borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.belt.black, opacity: 0.15 }} />
        {Array.from({ length: info.stripes }, (_, i) => (
          <View key={i} testID="belt-stripe" style={{ width: 6, backgroundColor: t.belt.stripe }} />
        ))}
      </View>
      <View testID="belt-knot" style={{ position: 'absolute', left: 0, top: 0, width, height: h }}>
        {piece(35)}
        {piece(-35)}
      </View>
    </View>
  )
}
