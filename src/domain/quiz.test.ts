import { choiceOptions, speechText, stableShuffle, suggestLevel } from './quiz'

describe('stableShuffle：選項打亂但穩定', () => {
  test('同一 seed 結果相同、不同 seed 通常不同；不遺失也不重複', () => {
    const xs = ['a', 'b', 'c', 'd', 'e']
    expect(stableShuffle(xs, 's1')).toEqual(stableShuffle(xs, 's1'))
    expect([...stableShuffle(xs, 's1')].sort()).toEqual(xs)
    const orders = new Set(['s1', 's2', 's3', 's4', 's5'].map((s) => stableShuffle(xs, s).join('')))
    expect(orders.size).toBeGreaterThan(1)
    expect(xs).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  test('choiceOptions 去掉與答案重複的干擾項', () => {
    expect(choiceOptions({ answer: 'x', distractors: ['y', 'x', 'z', 'y'] }, 'k').sort()).toEqual(['x', 'y', 'z'])
  })
})

describe('speechText：朗讀前移除說話者標籤（畫面文字稿保留）', () => {
  test('句首與句號後的「男：」「女：」「店員：」等標籤被移除', () => {
    expect(speechText('男：明日ですね。女：はい。男：分かりました。')).toBe('明日ですね。はい。分かりました。')
    expect(speechText('店員：三千円です。客：青はありますか。')).toBe('三千円です。青はありますか。')
    expect(speechText('館内放送：本日の説明会は二階です。')).toBe('本日の説明会は二階です。')
  })
  test('沒有標籤的稿子原樣；句中的冒號不動', () => {
    expect(speechText('教室に学生が三人います。')).toBe('教室に学生が三人います。')
    expect(speechText('時間は九時：三十分です。')).toBe('時間は九時：三十分です。')
  })
})

describe('suggestLevel：O5 建議等級（程度測驗，每級 3 題）', () => {
  const r = (...xs: number[]) => xs.map((correct, i) => ({ level: (['n5', 'n4', 'n3', 'n2', 'n1'] as const)[Math.floor(i / 3)], correct: !!correct }))
  test('建議第一個答對少於 2／3 的等級', () => {
    expect(suggestLevel(r(1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe('n4')
    expect(suggestLevel(r(0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1))).toBe('n5')
    expect(suggestLevel(r(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1))).toBe('n1')
  })
  test('中途略過：作答過的等級都達標時建議第一個沒測到的等級，而不是 N1', () => {
    expect(suggestLevel(r(1, 1, 1))).toBe('n4')
    expect(suggestLevel(r(1, 1, 0, 1))).toBe('n4')
  })
  test('沒有作答（全部略過）回傳 null', () => {
    expect(suggestLevel([])).toBeNull()
  })
})
