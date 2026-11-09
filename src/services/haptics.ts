// 觸覺回饋：依 theme tokens 的 haptic 事件（rewards §8）。可在設定關閉；失敗不影響流程（觸覺只是輔助）。
import * as Haptics from 'expo-haptics'
import { tokens, type HapticEvent } from '../theme/tokens'

export interface HapticsEngine {
  notificationAsync(type: Haptics.NotificationFeedbackType): Promise<void>
  impactAsync(style: Haptics.ImpactFeedbackStyle): Promise<void>
  selectionAsync(): Promise<void>
}

const notification = { success: Haptics.NotificationFeedbackType.Success, warning: Haptics.NotificationFeedbackType.Warning, error: Haptics.NotificationFeedbackType.Error }
const impact = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy }

export function createHaptics(enabled: () => boolean, engine: HapticsEngine = Haptics) {
  return {
    async play(event: HapticEvent) {
      if (!enabled()) return
      const [kind, arg] = tokens.haptic[event].split('.') as [string, string]
      try {
        if (kind === 'notification') await engine.notificationAsync(notification[arg as keyof typeof notification])
        else if (kind === 'impact') await engine.impactAsync(impact[arg as keyof typeof impact])
        else await engine.selectionAsync()
      } catch {}
    },
  }
}
