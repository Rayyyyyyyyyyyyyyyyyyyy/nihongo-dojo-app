// 清單列（設定類分組清單）：≥52pt，左標題右值；導覽入口用。
import { Pressable, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { AppText } from './Text'

export function ListRow({ title, value, onPress, hint }: { title: string; value?: string; onPress?: () => void; hint?: string }) {
  const t = useTheme()
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${title}，${value}` : title}
      accessibilityHint={hint}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: t.layout.listRowMinHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space[3],
        paddingHorizontal: t.space[4],
        paddingVertical: t.space[2],
        backgroundColor: t.colors[pressed ? 'surface2' : 'surface'],
      })}
    >
      <AppText style={{ flex: 1 }}>{title}</AppText>
      {value !== undefined && (
        <View>
          <AppText color="ink2" numeric>
            {value}
          </AppText>
        </View>
      )}
    </Pressable>
  )
}
