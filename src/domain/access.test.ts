import { bankManifest } from '../data/bank'
import { lessonAccess } from './access'

const at = (level: 'n5' | 'n4' | 'n3' | 'n2' | 'n1', lessonNo: number, owned = false, today = '2026-11-10') =>
  lessonAccess({ free: bankManifest.levels[level].free, lessonNo, owned, today, firstOpenDate: '2026-11-09' })

describe('鎖定判定（D16、S14a）', () => {
  test('N5、N4 每一課都開放', () => {
    expect([at('n5', 1), at('n5', 9), at('n4', 7)]).toEqual(['open', 'open', 'open'])
  })
  test('N3–N1 第 1 課免費，第 2 課起未購買就鎖定', () => {
    expect([at('n3', 1), at('n2', 1), at('n1', 1)]).toEqual(['open', 'open', 'open'])
    expect([at('n3', 2), at('n2', 3), at('n1', 2)]).toEqual(['paywall', 'paywall', 'paywall'])
  })
  test('已擁有完整版全部開放', () => {
    expect(at('n1', 5, true)).toBe('open')
  })
  test('firstOpenDate 當天點鎖定課只開說明（S14a），隔天開付費畫面（S14）', () => {
    expect(at('n3', 2, false, '2026-11-09')).toBe('explainOnly')
    expect(at('n3', 2, false, '2026-11-10')).toBe('paywall')
  })
})
