// UI 測試用的小題庫（不是出貨題庫）：涵蓋單字、文法、讀解（2 子題）、聽力（含說話者標籤）。
import type { LevelBank } from '../data/bank'
import { buildManifest } from '../domain/bank/manifest'
import type { Grammar, Listening, Reading, Vocab } from '../domain/bank/types'
import { LEVELS, mapLevels, type Level } from '../domain/progress/state'

const words: Array<[string, string, string]> = [
  ['水', 'みず', '水'], ['山', 'やま', '山'], ['川', 'かわ', '河川'], ['花', 'はな', '花'], ['雨', 'あめ', '雨'],
  ['空', 'そら', '天空'], ['海', 'うみ', '海'], ['木', 'き', '樹'], ['火', 'ひ', '火'], ['石', 'いし', '石頭'],
  ['月', 'つき', '月亮'], ['星', 'ほし', '星星'], ['道', 'みち', '道路'], ['本', 'ほん', '書'], ['車', 'くるま', '車子'],
  ['犬', 'いぬ', '狗'], ['猫', 'ねこ', '貓'], ['鳥', 'とり', '鳥'], ['魚', 'さかな', '魚'], ['肉', 'にく', '肉'],
  ['米', 'こめ', '米'], ['茶', 'ちゃ', '茶'], ['朝', 'あさ', '早上'], ['夜', 'よる', '晚上'],
]
export const vocabFor = (level: Level): Vocab[] =>
  words.map(([w, r, zh]) => ({ w: level === 'n5' ? w : `${w}${level}`, r, zh: level === 'n5' ? zh : `${zh}（${level}）`, en: w }))
export const grammarFor = (level: Level, n = 12): Grammar[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `g-${level}-${String(i + 1).padStart(3, '0')}`,
    q: `文${i + 1}：ここで＿＿ください。`,
    answer: `正${i + 1}`,
    distractors: [`誤${i + 1}a`, `誤${i + 1}b`, `誤${i + 1}c`],
    explanation: `解析 ${i + 1}`,
  }))
export const readingFor = (level: Level): Reading[] => [
  {
    id: `r-${level}-1`,
    level,
    title: '駅のお知らせ',
    type: '通知文',
    text: '本日、東口は工事のため通れません。西口をご利用ください。',
    notes: [{ term: '工事（こうじ）', meaning: '施工' }],
    questions: [
      { id: `rq-${level}-1`, q: '今日通れないのはどこですか。', answer: '東口', distractors: ['西口', '南口'], explanation: '「東口は工事のため通れません」。' },
      { id: `rq-${level}-2`, q: 'どこを使いますか。', answer: '西口', distractors: ['東口', '北口'], explanation: '「西口をご利用ください」。' },
    ],
  },
]
export const listeningFor = (level: Level): Listening[] =>
  Array.from({ length: 3 }, (_, i) => ({
    id: `l-${level}-${i + 1}`,
    level,
    script: `男：集合は${i + 1}時ですね。女：いいえ、${i + 2}時です。`,
    q: '集合は何時ですか。',
    answer: `${i + 2}時`,
    distractors: [`${i + 1}時`, `${i + 3}時`],
    explanation: `女的說 ${i + 2} 點。`,
  }))

export const fixtureBank = (level: Level): LevelBank => ({
  vocab: vocabFor(level),
  grammar: grammarFor(level),
  reading: readingFor(level),
  listening: listeningFor(level),
})
export const fixtureManifest = buildManifest(
  {
    vocab: mapLevels(vocabFor),
    grammar: mapLevels((l) => grammarFor(l)),
    reading: LEVELS.flatMap(readingFor),
    listening: LEVELS.flatMap(listeningFor),
  },
  [],
)
