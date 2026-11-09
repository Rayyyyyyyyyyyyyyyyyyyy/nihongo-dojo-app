// 本機持久化（handoff §2.2）：AppStateDoc 一個 JSON 檔、快照另一個檔，都以「寫暫存再改名」一次提交。
import { Directory, File, Paths } from 'expo-file-system'
import { validDoc, validPortable, type AppStateDoc, type PortableDoc } from '../state/doc'

// 檔案層的接縫：真實實作用 expo-file-system，測試用 memoryFiles。
export interface FilePort {
  read(name: string): Promise<string | null> // 不存在回傳 null；讀不到就丟錯
  writeAtomic(name: string, text: string): Promise<void>
  copy(from: string, to: string): Promise<void>
}

export interface Snapshot {
  at: string
  reason: 'beforeImport' | 'beforeRestore' | 'beforeUndo' | 'beforeReset'
  doc: PortableDoc // 不含 entitlement（handoff §2.3）
}
export const MAX_SNAPSHOTS = 10

export type LoadResult =
  | { status: 'empty'; snapshots: Snapshot[] }
  | { status: 'ok'; doc: AppStateDoc; snapshots: Snapshot[] }
  | { status: 'corrupt'; snapshots: Snapshot[] } // 原檔留在原處，不自動覆寫（S16）

export interface AppStorage {
  load(): Promise<LoadResult>
  saveDoc(doc: AppStateDoc): Promise<void> // 失敗會丟錯
  saveSnapshots(list: Snapshot[]): Promise<void>
  preserveCorrupt(stamp: string): Promise<void> // 覆寫損毀檔之前另存一份
}

const DOC = 'app-state.json',
  SNAPSHOTS = 'snapshots.json'

const validSnapshot = (s: unknown): s is Snapshot =>
  !!s &&
  typeof s === 'object' &&
  typeof (s as Snapshot).at === 'string' &&
  ['beforeImport', 'beforeRestore', 'beforeUndo', 'beforeReset'].includes((s as Snapshot).reason) &&
  validPortable((s as Snapshot).doc)

export function createAppStorage(files: FilePort): AppStorage {
  return {
    async load() {
      // 快照檔壞掉不影響主文件；當作沒有快照（下一次快照會覆寫它）。
      let snapshots: Snapshot[] = []
      try {
        const raw = await files.read(SNAPSHOTS)
        const list: unknown = raw === null ? [] : JSON.parse(raw)
        if (Array.isArray(list)) snapshots = list.filter(validSnapshot).slice(-MAX_SNAPSHOTS)
      } catch {}
      let raw: string | null
      try {
        raw = await files.read(DOC)
      } catch {
        return { status: 'corrupt', snapshots }
      }
      if (raw === null) return { status: 'empty', snapshots }
      try {
        const doc: unknown = JSON.parse(raw)
        if (validDoc(doc)) return { status: 'ok', doc, snapshots }
      } catch {}
      return { status: 'corrupt', snapshots }
    },
    saveDoc: (doc) => files.writeAtomic(DOC, JSON.stringify(doc)),
    saveSnapshots: (list) => files.writeAtomic(SNAPSHOTS, JSON.stringify(list)),
    preserveCorrupt: (stamp) => files.copy(DOC, `app-state.corrupt-${stamp}.json`),
  }
}

// shortcut: iOS 上 move(overwrite) 由原生端先刪後搬，不是 rename(2) 的單一系統呼叫；
// 中途當機最壞留下完整的 .tmp 檔與缺少的主檔，讀取時會走「empty」而非讀到半寫的 JSON。實機測量後再決定是否改原生 replaceItemAt。
export function expoFiles(dir: Directory = new Directory(Paths.document, 'dojo')): FilePort {
  const ensure = () => {
    if (!dir.exists) dir.create({ intermediates: true })
  }
  return {
    async read(name) {
      const f = new File(dir, name)
      return f.exists ? f.text() : null
    },
    async writeAtomic(name, text) {
      ensure()
      const tmp = new File(dir, `${name}.tmp`)
      await tmp.write(text)
      await tmp.move(new File(dir, name), { overwrite: true })
    },
    async copy(from, to) {
      ensure()
      await new File(dir, from).copy(new File(dir, to), { overwrite: true })
    },
  }
}

// 測試替身：可切換寫入失敗。
export function memoryFiles(initial: Record<string, string> = {}) {
  const files = { ...initial }
  const port = {
    files,
    failWrites: false,
    async read(name: string) {
      return name in files ? files[name] : null
    },
    async writeAtomic(name: string, text: string) {
      if (port.failWrites) throw Error('disk full')
      files[name] = text
    },
    async copy(from: string, to: string) {
      if (port.failWrites) throw Error('disk full')
      if (from in files) files[to] = files[from]
    },
  }
  return port
}
