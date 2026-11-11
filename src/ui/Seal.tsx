// 印（visual-system §4.3）：朱色圓角方形印框＋明朝字；實心為修行日，空心「護」為保護卡守住的日子。
import { View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { AppText } from './Text'

export function Seal({ text, hollow = false, size = 44, label }: { text: string; hollow?: boolean; size?: number; label: string }) {
  const t = useTheme()
  const large = size >= 96 // 結果頁大印：加內框與放大字
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        minWidth: size,
        minHeight: size,
        paddingHorizontal: t.space[1],
        borderRadius: t.radius.chip,
        borderWidth: 2,
        borderColor: t.colors.seal,
        backgroundColor: hollow ? 'transparent' : t.colors.seal,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {large && (
        <View
          testID="seal-inner"
          style={{ position: 'absolute', top: 6, right: 6, bottom: 6, left: 6, borderRadius: t.radius.chip, borderWidth: 1.5, borderColor: hollow ? t.colors.seal : t.colors.onAccent }}
        />
      )}
      <AppText
        variant="headline"
        color={hollow ? 'seal' : 'onAccent'}
        style={[{ fontFamily: t.font.display.family }, large && { fontSize: size / 3, lineHeight: size / 2.4 }]}
        numeric
      >
        {text}
      </AppText>
    </View>
  )
}
