import { createDoc } from '../state/doc'
import { createAppStorage, memoryFiles } from './storage'
import { createAppStore } from '../state/store'
import { classifyCloudError, createBackup, memoryCloud } from './backup'

const now = () => new Date(2026, 10, 9, 21, 30)
const setup = () => {
  const cloud = memoryCloud()
  return { cloud, backup: createBackup(cloud, { appVersion: '1.0.0', contentVersion: '2026.11.1', now }) }
}

describe('iCloud 備份（handoff §2.4、S16）', () => {
  test('備份內容是 dojo-backup/1，且不含購買狀態', async () => {
    const { cloud, backup } = setup()
    const doc = { ...createDoc('i', now), entitlement: { ...createDoc('i', now).entitlement, owned: true } }
    expect(await backup.backup(doc)).toEqual({ ok: true, value: now().toISOString() })
    const file = JSON.parse(cloud.text!)
    expect(file).toMatchObject({ format: 'dojo-backup/1', appVersion: '1.0.0', contentVersion: '2026.11.1' })
    expect(file.doc).not.toHaveProperty('entitlement')
  })

  test('錯誤分類：未登入／iCloud Drive 關閉、空間不足、其他', async () => {
    const { cloud, backup } = setup()
    cloud.signedIn = false
    expect(await backup.backup(createDoc('i', now))).toEqual({ ok: false, error: 'unavailable' })
    expect(await backup.latest()).toEqual({ ok: false, error: 'unavailable' })
    cloud.signedIn = true
    cloud.writeError = Object.assign(Error('NSFileWriteOutOfSpaceError'), { code: 'ERR_WRITE_ERROR' })
    expect(await backup.backup(createDoc('i', now))).toEqual({ ok: false, error: 'noSpace' })
    expect(classifyCloudError({ code: 'ERR_AUTHENTICATION_FAILED' })).toBe('unavailable')
    expect(classifyCloudError(Error('boom'))).toBe('unknown')
  })

  test('沒有備份回傳 null；格式不符回傳 invalid', async () => {
    const { cloud, backup } = setup()
    expect(await backup.latest()).toEqual({ ok: true, value: null })
    cloud.text = '{"format":"dojo-backup/1","doc":{}}'
    expect(await backup.latest()).toEqual({ ok: false, error: 'invalid' })
    cloud.text = 'not json'
    expect(await backup.latest()).toEqual({ ok: false, error: 'invalid' })
  })

  test('還原：經 store 套用，保護卡基線設為當天、購買狀態不變、先留快照', async () => {
    const { backup } = setup()
    const other = createDoc('other-device', () => new Date(2026, 0, 1, 12))
    await backup.backup(other)
    const store = createAppStore({ storage: createAppStorage(memoryFiles()), clock: now, newId: () => 'me' })
    await store.load()
    store.setEntitlement(true, 'x')
    const r = await backup.latest()
    if (!r.ok || !r.value) throw Error('no backup')
    await store.restoreBackup(r.value.doc)
    expect(store.getState().doc).toMatchObject({
      meta: { installId: 'other-device' },
      rewards: { protectionBaselineDate: '2026-11-09' },
      entitlement: { owned: true },
    })
    expect(store.getState().snapshots.map((s) => s.reason)).toEqual(['beforeRestore'])
  })
})
