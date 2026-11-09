import web from '../domain/progress/__fixtures__/web-v5.json'
import { createAppStorage, memoryFiles } from '../services/storage'
import { createDoc } from './doc'
import { createAppStore } from './store'

const clock = () => new Date(2026, 10, 9, 12)
let ids = 0
const setup = (initial: Record<string, string> = {}) => {
  const files = memoryFiles(initial)
  const store = createAppStore({ storage: createAppStorage(files), clock, newId: () => `id-${++ids}` })
  return { files, store }
}
const W = { level: 'n3', kind: 'vocab', id: '連なる' } as const
let seq = 0
const answer = () => ({ attemptId: `s${++seq}`, ref: W, mode: 'flashcard' as const, correct: true })
const saved = (files: { files: Record<string, string> }) => JSON.parse(files.files['app-state.json'])

describe('載入', () => {
  test('沒有文件：建立新文件並保存，firstOpenDate 為今天', async () => {
    const { files, store } = setup()
    await store.load()
    expect(store.getState().status).toBe('ready')
    expect(saved(files).meta.firstOpenDate).toBe('2026-11-09')
  })

  test('讀到無法驗證的文件：保留原檔、不自動覆寫，作答等操作不可用', async () => {
    const { files, store } = setup({ 'app-state.json': '{"schema":"dojo-app/1"' })
    await store.load()
    expect(store.getState().status).toBe('corrupt')
    expect(() => store.submitAnswer(answer())).toThrow()
    await store.flush()
    expect(files.files['app-state.json']).toBe('{"schema":"dojo-app/1"')
  })

  test('從損毀狀態重新開始：原檔另存一份後才寫新文件', async () => {
    const { files, store } = setup({ 'app-state.json': 'garbage' })
    await store.load()
    await store.startFresh()
    expect(store.getState().status).toBe('ready')
    expect(Object.entries(files.files).find(([k]) => k.startsWith('app-state.corrupt-'))?.[1]).toBe('garbage')
  })

  test('既有文件原樣載入；壞掉的快照檔當作沒有快照', async () => {
    const doc = createDoc('old', clock)
    const { store } = setup({ 'app-state.json': JSON.stringify(doc), 'snapshots.json': '[{"bad":1}]' })
    await store.load()
    expect(store.getState().doc?.meta.installId).toBe('old')
    expect(store.getState().snapshots).toEqual([])
  })
})

describe('一般保存', () => {
  test('保存失敗：記憶體狀態照常生效並標示 saveError；之後保存成功一併寫入並清除', async () => {
    const { files, store } = setup()
    await store.load()
    files.failWrites = true
    expect(store.submitAnswer(answer())?.xp).toBe(10)
    await store.flush()
    expect(store.getState()).toMatchObject({ saveError: true, doc: { rewards: { xpTotal: 10 } } })
    expect(saved(files).rewards.xpTotal).toBe(0)
    files.failWrites = false
    await store.retrySave()
    expect(store.getState().saveError).toBe(false)
    expect(saved(files).rewards.xpTotal).toBe(10)
  })

  test('訂閱者在每次變更時被通知', async () => {
    const { store } = setup()
    await store.load()
    const seen: number[] = []
    store.subscribe(() => seen.push(store.getState().doc!.rewards.xpTotal))
    store.submitAnswer(answer())
    expect(seen).toContain(10)
  })
})

describe('v5 匯入、快照與撤銷（handoff §4.1）', () => {
  test('匯入前建立快照；只覆寫 learning；撤銷回到匯入前，撤銷本身也建立快照', async () => {
    const { files, store } = setup()
    await store.load()
    store.submitAnswer(answer())
    store.setEntitlement(true, '2026-11-09T00:00:00.000Z')
    await store.importV5(web.code)
    const s = store.getState()
    expect(s.doc?.learning).toEqual(web.state)
    expect(s.doc?.rewards.xpTotal).toBe(10)
    expect(s.doc?.entitlement.owned).toBe(true)
    expect(s.snapshots.map((x) => x.reason)).toEqual(['beforeImport'])
    expect(s.snapshots[0].doc).not.toHaveProperty('entitlement')
    expect(saved(files).learning).toEqual(web.state)

    await store.undo()
    expect(store.getState().doc?.learning.results.map((r) => r.ref.id)).toEqual(['連なる'])
    expect(store.getState().doc?.entitlement.owned).toBe(true)
    expect(store.getState().snapshots.map((x) => x.reason)).toEqual(['beforeImport', 'beforeUndo'])
  })

  test('保存失敗：匯入不套用、進度不變，丟出可顯示的訊息', async () => {
    const { files, store } = setup()
    await store.load()
    const before = store.getState().doc
    files.failWrites = true
    await expect(store.importV5(web.code)).rejects.toThrow('進度沒有變動')
    expect(store.getState().doc).toBe(before)
    expect(store.getState().snapshots).toEqual([])
  })

  test('快照存好但文件寫入失敗：仍不套用', async () => {
    const { files, store } = setup()
    await store.load()
    const before = store.getState().doc
    const write = files.writeAtomic
    files.writeAtomic = async (name, text) => {
      if (name === 'app-state.json') throw Error('disk full')
      return write(name, text)
    }
    await expect(store.importV5(web.code)).rejects.toThrow('沒有套用')
    expect(store.getState().doc).toBe(before)
  })

  test('無效碼與 v4 碼：拒絕且不建立快照', async () => {
    const { store } = setup()
    await store.load()
    await expect(store.importV5('garbage')).rejects.toThrow()
    const v4 = btoa(encodeURIComponent(JSON.stringify({ version: 4, state: {} })))
    await expect(store.importV5(v4)).rejects.toThrow(/v4/)
    expect(store.getState().snapshots).toEqual([])
  })

  test('快照最多 10 份，最舊的被淘汰', async () => {
    const { store } = setup()
    await store.load()
    for (let i = 0; i < 12; i++) await store.importV5(web.code)
    expect(store.getState().snapshots).toHaveLength(10)
  })

  test('還原備份：驗證失敗不套用；成功時保護卡基線設為當天、購買狀態不變', async () => {
    const { store } = setup()
    await store.load()
    store.setEntitlement(true, 'x')
    await expect(store.restoreBackup({ schema: 'nope' } as never)).rejects.toThrow('備份檔無法使用')
    const { entitlement: _, ...backup } = createDoc('other', () => new Date(2026, 0, 1, 12))
    await store.restoreBackup(backup)
    expect(store.getState().doc).toMatchObject({
      meta: { installId: 'other' },
      rewards: { protectionBaselineDate: '2026-11-09' },
      entitlement: { owned: true },
    })
  })
})
