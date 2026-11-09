// 作答選項（visual-system §4.3）：最小高 52pt；正誤一定同時有文字（不只靠顏色）。不用序號字母，以位置區分。
import { Pressable, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { AppText } from './Text'

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'answer' | 'locked'
const tag = { correct: '答對', wrong: '答錯', answer: '正確答案' } as const

export function Option({ label, state = 'idle', ja, onPress }: { label: string; state?: OptionState; ja?: boolean; onPress?: () => void }) {
  const t = useTheme()
  const mark = state === 'correct' || state === 'wrong' || state === 'answer' ? tag[state] : null
  const bg = state === 'correct' || state === 'answer' ? 'correctBg' : state === 'wrong' ? 'wrongBg' : 'surface2'
  const done = state !== 'idle' && state !== 'selected'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mark ? `${label}，${mark}` : label}
      accessibilityLanguage={ja ? 'ja-JP' : undefined}
      accessibilityState={{ selected: state === 'selected' || state === 'correct' || state === 'wrong', disabled: done }}
      disabled={done}
      onPress={onPress}
      style={{
        minHeight: t.layout.listRowMinHeight,
        borderRadius: t.radius.surface,
        paddingHorizontal: t.space[4],
        paddingVertical: t.space[3],
        backgroundColor: t.colors[bg],
        borderWidth: 2,
        borderColor: state === 'selected' ? t.colors.primary : t.colors[bg],
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space[3],
      }}
    >
      <AppText ja={ja} variant={ja ? 'bodyJa' : 'body'} style={{ flex: 1 }}>
        {label}
      </AppText>
      {mark && (
        <View>
          <AppText variant="footnote" color={state === 'wrong' ? 'wrong' : 'correct'} style={{ fontWeight: '600' }}>
            {mark}
          </AppText>
        </View>
      )}
    </Pressable>
  )
}
