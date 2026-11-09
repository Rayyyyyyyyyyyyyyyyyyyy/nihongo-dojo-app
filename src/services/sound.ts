// 音效（rewards §8：木魚、低音、印章、太鼓）。音效素材與授權來源都還沒有（handoff §3），
// 所以這裡只保留介面、不播放；S22 的開關與示範音由之後接上真實素材時實作。
export type SoundEvent = 'correct' | 'wrong' | 'stamp' | 'rankUp'
export interface SoundService {
  play(event: SoundEvent): void
}
export const silentSound: SoundService = { play: () => {} }
