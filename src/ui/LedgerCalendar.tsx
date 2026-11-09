// 修行帳月曆（rewards §5、§4.2）：完成目標的日子蓋實心印，保護卡守住的日子蓋空心「護」，其他是空格；不寫責備文案。
import { View } from 'react-native'
import { Card } from './Card'
import { Seal } from './Seal'
import { AppText } from './Text'

export function LedgerCalendar({ month, done, guarded, stampText = '稽古' }: { month: string; done: string[]; guarded: string[]; stampText?: string }) {
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const lead = new Date(y, m - 1, 1).getDay()
  const count = done.filter((d) => d.startsWith(month)).length
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]
  return (
    <Card accessibilityLabel="修行帳">
      <AppText variant="headline" accessibilityRole="header">
        修行帳・{m} 月
      </AppText>
      <AppText color="ink2" numeric>
        本月修行 {count} 天
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          const day = d ? Number(d.slice(8)) : 0
          const kind = d && done.includes(d) ? 'done' : d && guarded.includes(d) ? 'guarded' : null
          return (
            <View key={d ?? `lead-${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2, alignItems: 'center', justifyContent: 'center' }}>
              {kind ? (
                <Seal
                  size={32}
                  text={kind === 'done' ? stampText.slice(0, 1) : '護'}
                  hollow={kind === 'guarded'}
                  label={`${m} 月 ${day} 日${kind === 'done' ? '，修行完成' : '，保護卡守住'}`}
                />
              ) : d ? (
                <AppText variant="caption" color="ink3" numeric accessibilityLabel={`${m} 月 ${day} 日`}>
                  {day}
                </AppText>
              ) : null}
            </View>
          )
        })}
      </View>
    </Card>
  )
}
