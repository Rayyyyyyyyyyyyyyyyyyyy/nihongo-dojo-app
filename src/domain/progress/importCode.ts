import { decodeCode, type ProgressState } from './state'

// Project D11: the app accepts only web v5 codes; everything else uses the ported web rules.
export function importWebV5Code(code: string): ProgressState {
  let version: unknown
  try {
    version = JSON.parse(decodeURIComponent(atob(code.trim()))).version
  } catch {
    // decodeCode reports undecodable input.
  }
  if (version === 4)
    throw Error('不接受 v4 進度碼；請先在網頁版開啟一次，再匯出 v5 進度碼。')
  return decodeCode(code)
}
