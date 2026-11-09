import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { encodeCode, defaultState } from '../../domain/progress/state'
import { memoryFiles } from '../../services/storage'
import { Backup, BACKUP_ERRORS } from './Backup'
import { SLOW_MS } from './useSlow'
import { setup } from './testkit'

jest.mock('expo-router', () => require('./routerMock'))

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }))

test('空結果：iCloud 沒有備份、沒有恢復點；立即備份成功顯示時間', async () => {
  const k = await setup()
  await k.show(<Backup />)
  expect(await screen.findByText('iCloud 上還沒有備份')).toBeTruthy()
  expect(screen.getByText('還沒有恢復點')).toBeTruthy()
  await act(async () => press('立即備份'))
  expect(await screen.findByText('已備份（11/09 12:00）')).toBeTruthy()
  expect(k.cloud.text).toContain('dojo-backup/1')
  expect(await screen.findByText('最近的備份：11/09 12:00')).toBeTruthy()
})

test.each([
  ['unavailable', (c: ReturnType<typeof import('../../services/backup').memoryCloud>) => (c.signedIn = false)],
  ['noSpace', (c: ReturnType<typeof import('../../services/backup').memoryCloud>) => (c.writeError = { code: 'ERR_QUOTA_EXCEEDED' })],
  ['unknown', (c: ReturnType<typeof import('../../services/backup').memoryCloud>) => (c.writeError = Error('boom'))],
] as const)('錯誤：備份失敗寫出原因（%s）', async (error, arrange) => {
  const k = await setup()
  arrange(k.cloud)
  await k.show(<Backup />)
  await act(async () => press('立即備份'))
  expect((await screen.findAllByText(BACKUP_ERRORS[error])).length).toBeGreaterThan(0)
})

test('錯誤：iCloud 備份檔無效時不提供還原', async () => {
  const k = await setup()
  k.cloud.text = '{"format":"x"}'
  await k.show(<Backup />)
  expect(await screen.findByText(BACKUP_ERRORS.invalid)).toBeTruthy()
  expect(screen.queryByRole('button', { name: '從 iCloud 還原' })).toBeNull()
})

test('恢復：從 iCloud 還原需確認，先建立快照，之後可從恢復點撤銷', async () => {
  const k = await setup()
  await k.services.backup.backup(k.store.getState().doc!)
  k.store.markVocab('n5', '水', true)
  await k.store.flush()
  await k.show(<Backup />)
  await act(async () => press('從 iCloud 還原'))
  expect(screen.getByText(/還原會用 iCloud 備份覆寫/)).toBeTruthy()
  await act(async () => press('覆寫並還原'))
  expect(await screen.findByText(/已從 iCloud 還原/)).toBeTruthy()
  expect(k.store.getState().snapshots).toHaveLength(1)
  expect(k.store.getState().doc!.learning.vKnown.n5['水']).toBeUndefined()
  await act(async () => press(/^恢復到 .*還原前/))
  await act(async () => press('恢復到這裡'))
  expect(await screen.findByText(/已恢復/)).toBeTruthy()
  expect(k.store.getState().doc!.learning.vKnown.n5['水']).toBeTruthy()
})

test('恢復點滿 10 份時，確認卡事先告知會淘汰最舊的一份', async () => {
  const k = await setup()
  const code = encodeCode(defaultState())
  for (let i = 0; i < 10; i++) await k.store.importV5(code)
  await k.show(<Backup />)
  await act(async () => press(screen.getAllByRole('button', { name: /^恢復到 / })[0].props.accessibilityLabel))
  expect(screen.getByText(/恢復點已滿 10 份，這次操作會淘汰最舊的一份/)).toBeTruthy()
})

test('保存失敗：顯示重試，成功後清除', async () => {
  const files = memoryFiles()
  const k = await setup(files)
  await k.show(<Backup />)
  files.failWrites = true
  await act(async () => {
    k.store.markVocab('n5', '水', true)
    await k.store.flush()
  })
  expect(screen.getByText('進度暫時沒有保存')).toBeTruthy()
  files.failWrites = false
  await act(async () => press('再試一次保存'))
  expect(await screen.findByText('已保存。')).toBeTruthy()
  expect(k.store.getState().saveError).toBe(false)
})

test('損毀：從頭開始需二次確認，原檔另存', async () => {
  const files = memoryFiles({ 'app-state.json': 'garbage' })
  const k = await setup(files)
  await k.show(<Backup />)
  expect(screen.getByText('進度資料無法讀取，已保留原始資料')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '立即備份' })).toBeNull()
  await act(async () => press('從頭開始'))
  expect(k.store.getState().status).toBe('corrupt')
  await act(async () => press('確定從頭開始'))
  expect(await screen.findByText(/已從頭開始/)).toBeTruthy()
  expect(k.store.getState().status).toBe('ready')
  expect(Object.values(files.files)).toContain('garbage')
})

test('等待與重複操作：備份中按鈕停用；超過 10 秒顯示可以先離開', async () => {
  jest.useFakeTimers()
  const k = await setup()
  let finish = () => {}
  k.cloud.write = () => new Promise<void>((r) => (finish = r))
  await k.show(<Backup />)
  await act(async () => press('立即備份'))
  expect(screen.getByRole('button', { name: '立即備份' }).props.accessibilityState).toMatchObject({ disabled: true, busy: true })
  await act(async () => press('立即備份'))
  act(() => jest.advanceTimersByTime(SLOW_MS))
  expect(screen.getByText(/還在處理，可以先離開/)).toBeTruthy()
  await act(async () => finish())
  await waitFor(() => expect(screen.getByText('已備份（11/09 12:00）')).toBeTruthy())
  jest.useRealTimers()
})
