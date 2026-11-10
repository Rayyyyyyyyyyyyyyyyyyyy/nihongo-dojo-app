// S6 升段儀式（rewards §6.3）：靛藍底、名札上移、帶色展開，約 2.4 秒，點任意處跳過；
// 減少動態時靜態卡片淡入 200ms。帶色在儀式底上對比不足，辨識靠 ceremonyOutline 外框與段位名。
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, type ComponentRef } from 'react'
import { AccessibilityInfo, Animated, findNodeHandle, Pressable, View } from 'react-native'
import { useServices } from '../../state/AppProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Screen } from '../../ui'
import { useDoc, goBack } from '../hooks'
import { RANKS } from '../names'

export default function Ceremony() {
  const t = useTheme()
  const doc = useDoc()
  const router = useRouter()
  const { haptics, sound } = useServices()
  const p = useLocalSearchParams<{ rank?: string; passed?: string }>()
  const rank = Math.min(10, Math.max(2, Number(p.rank) || 2))
  const info = RANKS[rank - 1]
  const passed = (p.passed ?? '').split(',').map(Number).filter((n) => n >= 2 && n < rank)
  const xp = doc.rewards.xpTotal
  const days = doc.rewards.goalCompletedDates.length
  const tag = useRef(new Animated.Value(t.motion.reduceMotion ? 0 : 40)).current
  const belt = useRef(new Animated.Value(t.motion.reduceMotion ? 1 : 0)).current
  const fade = useRef(new Animated.Value(t.motion.reduceMotion ? 0 : 1)).current
  const done = useRef<ComponentRef<typeof View>>(null)
  const leaving = useRef(false)

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`升段：${info.name}。累積 ${xp.toLocaleString()} XP`)
    const node = done.current && findNodeHandle(done.current)
    if (node) AccessibilityInfo.setAccessibilityFocus(node)
    void haptics.play('rankUp')
    sound.play('rankUp')
    if (t.motion.reduceMotion) {
      Animated.timing(fade, { toValue: 1, duration: t.motion.alternative.maxDuration, useNativeDriver: true }).start()
      return
    }
    Animated.sequence([
      Animated.spring(tag, { toValue: 0, ...t.motion.ease.settle, useNativeDriver: true } as never),
      Animated.timing(belt, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()
    // 評分請求（rewards §6.3）需 expo-store-review，未安裝；不自製評分彈窗。
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => {
    tag.setValue(0)
    belt.setValue(1)
    fade.setValue(1)
  }
  const finish = () => {
    if (leaving.current) return
    leaving.current = true
    goBack(router)
  }
  return (
    <Screen modal tone="surfaceCeremony">
      <Pressable accessible={false} onPress={skip} style={{ gap: t.space[6], paddingVertical: t.space[10] }}>
        <Animated.View style={{ opacity: fade, gap: t.space[6], alignItems: 'center' }}>
          <Animated.View style={{ transform: [{ translateY: tag }] }}>
            <View style={{ borderWidth: 1.5, borderColor: t.colors.ceremonyOutline, borderRadius: t.radius.chip, paddingHorizontal: t.space[4], paddingVertical: t.space[2] }}>
              <AppText variant="headline" color="onCeremony">
                {doc.rewards.nameTag}
              </AppText>
            </View>
          </Animated.View>
          <Animated.View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${info.name}的帶`}
            style={{
              width: 240,
              height: 20,
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 6,
              paddingRight: 12,
              backgroundColor: t.belt[info.belt],
              borderWidth: 1.5,
              borderColor: t.colors.ceremonyOutline,
              transform: [{ scaleX: belt }],
            }}
          >
            {Array.from({ length: info.stripes }, (_, i) => (
              <View key={i} style={{ width: 6, backgroundColor: t.belt.stripe }} />
            ))}
          </Animated.View>
          <AppText variant="title1" color="onCeremony" accessibilityRole="header" style={{ fontFamily: t.font.display.family, fontSize: 40, lineHeight: 48 }}>
            {info.name}
          </AppText>
          <AppText color="onCeremony" numeric>
            累積 {xp.toLocaleString()} XP・修行 {days} 天
          </AppText>
          {passed.length > 0 && (
            <AppText color="onCeremony" variant="footnote">
              經過：{passed.map((r) => RANKS[r - 1].name).join('、')}
            </AppText>
          )}
        </Animated.View>
      </Pressable>
      <Button label="分享" variant="secondary" onPress={() => router.push('/share')} />
      <View ref={done} accessible={false}>
        <Button label="完成" onPress={finish} />
      </View>
    </Screen>
  )
}
