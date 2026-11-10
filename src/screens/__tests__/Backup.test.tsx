// S16 資料與備份狀態表：空結果、iCloud 錯誤、還原與恢復點、快照上限告知、保存失敗、損毀恢復、等待與重複操作、前往 S17。
import { act, fireEvent, renderHook, screen, waitFor } from 'expo-router/testing-library'
import { defaultState, encodeCode } from '../../domain/progress/state'
import { readyDoc } from '../../test/harness'
import { renderSettings, settingsServices } from '../../test/settingsHarness'
import type { memoryCloud } from '../../services/backup'
import { BACKUP_ERRORS } from '../settings/Backup'
import { SLOW_MS, useSlow } from '../settings/useSlow'

type Cloud = ReturnType<typeof memoryCloud>
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }))
const open = async (s = settingsServices({ doc: readyDoc() }), url = '/backup') => {
  await renderSettings(s, url)
  await screen.findByText('iCloud 備份')
  await waitFor(() => expect(screen.queryByText('正在查詢 iCloud…')).not.toBeOnTheScreen())
  return s
}

describe('S16 資料與備份', () => {
  afterEach(() => jest.useRealTimers())

  test('空結果：iCloud 沒有備份、沒有恢復點；立即備份成功顯示時間', async () => {
    const s = await open()
    expect(await screen.findByText('iCloud 上還沒有備份')).toBeOnTheScreen()
    expect(screen.getByText('還沒有恢復點')).toBeOnTheScreen()
    await act(async () => press('立即備份'))
    expect(await screen.findByText('已備份（11/09 12:00）')).toBeOnTheScreen()
    expect(s.cloud.text).toContain('dojo-backup/1')
    expect(s.cloud.text).not.toContain('entitlement')
    expect(await screen.findByText('最近的備份：11/09 12:00')).toBeOnTheScreen()
  })

  test.each([
    ['unavailable', (c: Cloud): void => {
      c.signedIn = false
    }],
    ['noSpace', (c: Cloud): void => {
      c.writeError = { code: 'ERR_QUOTA_EXCEEDED' }
    }],
    ['unknown', (c: Cloud): void => {
      c.writeError = Error('boom')
    }],
  ] as const)('錯誤：備份失敗寫出原因並建議匯出碼（%s），進度不變', async (error, arrange) => {
    const s = settingsServices({ doc: readyDoc() })
    arrange(s.cloud)
    await open(s)
    const before = JSON.stringify(s.store.getState().doc)
    await act(async () => press('立即備份'))
    expect((await screen.findAllByText(BACKUP_ERRORS[error])).length).toBeGreaterThan(0)
    expect(BACKUP_ERRORS[error]).toMatch(/匯出進度碼|無法使用/)
    expect(JSON.stringify(s.store.getState().doc)).toBe(before)
  })

  test('錯誤：iCloud 備份檔無效時寫「備份檔無法使用」，不提供還原', async () => {
    const s = settingsServices({ doc: readyDoc() })
    s.cloud.text = '{"format":"x"}'
    await open(s)
    expect(await screen.findByText(BACKUP_ERRORS.invalid)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: '從 iCloud 還原' })).not.toBeOnTheScreen()
  })

  test('恢復：從 iCloud 還原需確認，先建立快照，之後可從恢復點撤銷', async () => {
    const s = settingsServices({ doc: readyDoc() })
    await s.services.backup.backup(readyDoc())
    await open(s)
    await act(async () => s.store.markVocab('n5', '水', true))
    await act(async () => press('從 iCloud 還原'))
    expect(screen.getByText(/還原會用 iCloud 備份覆寫/)).toBeOnTheScreen()
    expect(s.store.getState().snapshots).toHaveLength(0)
    await act(async () => press('覆寫並還原'))
    expect(await screen.findByText(/已從 iCloud 還原/)).toBeOnTheScreen()
    expect(s.store.getState().snapshots).toHaveLength(1)
    expect(s.store.getState().doc!.learning.vKnown.n5['水']).toBeUndefined()
    await act(async () => press(/^恢復到 .*還原前/))
    await act(async () => press('恢復到這裡'))
    expect(await screen.findByText(/已恢復/)).toBeOnTheScreen()
    expect(s.store.getState().doc!.learning.vKnown.n5['水']).toBe(true)
    expect(s.store.getState().snapshots).toHaveLength(2)
  })

  test('恢復點滿 10 份時，確認卡事先告知會淘汰最舊的一份', async () => {
    const s = await open()
    await screen.findByText('還沒有恢復點')
    const code = encodeCode(defaultState())
    for (let i = 0; i < 10; i++) await act(() => s.store.importV5(code))
    await act(async () => fireEvent.press(screen.getAllByRole('button', { name: /^恢復到 / })[0]))
    expect(screen.getByText(/恢復點已滿 10 份，這次操作會淘汰最舊的一份/)).toBeOnTheScreen()
    await act(async () => press('取消'))
    expect(screen.queryByText(/恢復點已滿/)).not.toBeOnTheScreen()
  })

  test('保存失敗：顯示重試，成功後清除', async () => {
    const s = await open()
    await screen.findByText('iCloud 備份')
    s.files.failWrites = true
    await act(async () => {
      s.store.markVocab('n5', '水', true)
      await s.store.flush()
    })
    expect(screen.getByText('進度暫時沒有保存')).toBeOnTheScreen()
    s.files.failWrites = false
    await act(async () => press('再試一次保存'))
    expect(await screen.findByText('已保存。')).toBeOnTheScreen()
    expect(s.store.getState().saveError).toBe(false)
  })

  test('損毀：啟動顯示「前往恢復」，進入 S16；從頭開始需二次確認，原檔另存', async () => {
    const s = settingsServices()
    s.files.files['app-state.json'] = 'garbage'
    await renderSettings(s, '/')
    expect(await screen.findByText('進度資料無法讀取，已保留原始資料。')).toBeOnTheScreen()
    await act(async () => press('前往恢復'))
    expect(screen.getByText('進度資料無法讀取，已保留原始資料')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: '立即備份' })).not.toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: '從網頁版匯入' })).not.toBeOnTheScreen()
    await act(async () => press('從頭開始'))
    expect(s.store.getState().status).toBe('corrupt')
    expect(s.files.files['app-state.json']).toBe('garbage')
    await act(async () => press('確定從頭開始'))
    await waitFor(() => expect(s.store.getState().status).toBe('ready'))
    expect(Object.entries(s.files.files).find(([k]) => k.startsWith('app-state.corrupt-'))?.[1]).toBe('garbage')
    expect(await screen.findByText('占位 首頁')).toBeOnTheScreen()
  })

  test('損毀：可從 iCloud 備份還原', async () => {
    const s = settingsServices()
    await s.services.backup.backup(readyDoc((d) => ({ ...d, learning: { ...d.learning, streak: 7 } })))
    s.files.files['app-state.json'] = 'garbage'
    await renderSettings(s, '/')
    await screen.findByText('前往恢復')
    await act(async () => press('前往恢復'))
    await screen.findByRole('button', { name: '從 iCloud 還原' })
    await act(async () => press('從 iCloud 還原'))
    await act(async () => press('覆寫並還原'))
    await waitFor(() => expect(s.store.getState().status).toBe('ready'))
    expect(s.store.getState().doc!.learning.streak).toBe(7)
  })

  test('重複操作：備份中按鈕停用、連點只寫一次，完成後顯示結果', async () => {
    const s = settingsServices({ doc: readyDoc() })
    let finish = () => {}
    const write = jest.fn(() => new Promise<void>((r) => (finish = r)))
    s.cloud.write = write
    await open(s)
    await press('立即備份')
    expect(screen.getByRole('button', { name: '立即備份' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '從網頁版匯入' })).toBeDisabled()
    await press('立即備份')
    expect(write).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    expect(await screen.findByText('已備份（11/09 12:00）')).toBeOnTheScreen()
  })

  test('等待：外部操作超過 10 秒才回報 slow（顯示「還在處理，可以先離開」）', async () => {
    jest.useFakeTimers()
    const { result, rerender } = await renderHook(({ on }: { on: boolean }) => useSlow(on), { initialProps: { on: true } })
    await act(() => jest.advanceTimersByTime(SLOW_MS - 1))
    expect(result.current).toBe(false)
    await act(() => jest.advanceTimersByTime(1))
    expect(result.current).toBe(true)
    await rerender({ on: false })
    expect(result.current).toBe(false)
  })

  test('匯出進度碼：顯示說明與分享；可前往從網頁版匯入', async () => {
    await open()
    await act(async () => press('匯出進度碼'))
    expect(screen.getByText(/進度碼不是加密，請勿公開；不包含購買/)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '分享進度碼' })).toBeOnTheScreen()
    await act(async () => press('從網頁版匯入'))
    expect(await screen.findByLabelText('網頁版進度碼')).toBeOnTheScreen()
  })
})
