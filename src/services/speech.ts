// 日語朗讀（S10）：expo-speech。沒有日語語音時畫面走空狀態並提供文字稿。
import * as Speech from 'expo-speech'

export interface SpeechEngine {
  speak(text: string, options: Speech.SpeechOptions): void
  stop(): Promise<void>
  getAvailableVoicesAsync(): Promise<Array<{ identifier: string; language: string }>>
}

// handoff §5 E-07：無法確認能否偵測靜音開關，結果出來前一律顯示靜音提示（每次進入聽力課一次）。
export const SILENT_MODE_HINT = true

export function createSpeech(engine: SpeechEngine = Speech) {
  return {
    async japaneseVoice(): Promise<'available' | 'missing'> {
      const voices = await engine.getAvailableVoicesAsync()
      return voices.some((v) => v.language.toLowerCase().startsWith('ja')) ? 'available' : 'missing'
    },
    // 先停前一段再播：連點播放只會有一個 utterance；播放不產生學習活動。
    async speak(text: string, rate: 0.8 | 1.0, on: { start?(): void; done?(): void; error?(e: Error): void } = {}) {
      await engine.stop()
      engine.speak(text, { language: 'ja-JP', rate, onStart: on.start, onDone: on.done, onError: on.error })
    },
    stop: () => engine.stop(),
  }
}
export type SpeechService = ReturnType<typeof createSpeech>
