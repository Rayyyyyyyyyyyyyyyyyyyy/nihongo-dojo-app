// iCloud Documents 備份／還原（handoff §2.4）。還原經 store.restoreBackup：驗證、快照、protectionBaselineDate 設當天。
import { portable, validPortable, type AppStateDoc, type PortableDoc } from '../state/doc'

export type BackupError =
  | 'unavailable' // 未登入 iCloud 或關閉 iCloud Drive（套件無法區分兩者）
  | 'noSpace' // iCloud 空間不足
  | 'invalid' // 備份檔無法使用
  | 'unknown'
export type BackupResult<T> = { ok: true; value: T } | { ok: false; error: BackupError }

export interface BackupFile {
  format: 'dojo-backup/1'
  createdAt: string
  appVersion: string
  contentVersion: string
  doc: PortableDoc // 不含購買狀態
}

// iCloud 檔案的接縫：真實實作在 backupICloud.ts，測試用 memoryCloud。
export interface CloudPort {
  available(): Promise<boolean>
  read(): Promise<string | null>
  write(text: string): Promise<void>
}

export function classifyCloudError(e: unknown): BackupError {
  const code = String((e as { code?: unknown })?.code ?? ''),
    msg = String((e as { message?: unknown })?.message ?? '')
  if (code === 'ERR_AUTHENTICATION_FAILED') return 'unavailable'
  if (code === 'ERR_QUOTA_EXCEEDED' || /out ?of ?space|quota|not enough (storage|space)|NSFileWriteOutOfSpace/i.test(msg)) return 'noSpace'
  return 'unknown'
}

export function createBackup(cloud: CloudPort, info: { appVersion: string; contentVersion: string; now: () => Date }) {
  const guard = async <T>(run: () => Promise<BackupResult<T>>): Promise<BackupResult<T>> => {
    try {
      if (!(await cloud.available())) return { ok: false, error: 'unavailable' }
      return await run()
    } catch (e) {
      return { ok: false, error: classifyCloudError(e) }
    }
  }
  return {
    backup: (doc: AppStateDoc) =>
      guard<string>(async () => {
        const createdAt = info.now().toISOString()
        const file: BackupFile = { format: 'dojo-backup/1', createdAt, appVersion: info.appVersion, contentVersion: info.contentVersion, doc: portable(doc) }
        await cloud.write(JSON.stringify(file))
        return { ok: true, value: createdAt }
      }),
    // 沒有備份回傳 null（S16 空結果）；格式不符回傳 invalid，不套用。
    latest: () =>
      guard<BackupFile | null>(async () => {
        const raw = await cloud.read()
        if (raw === null) return { ok: true, value: null }
        let f: Partial<BackupFile>
        try {
          f = JSON.parse(raw)
        } catch {
          return { ok: false, error: 'invalid' }
        }
        return f?.format === 'dojo-backup/1' && typeof f.createdAt === 'string' && validPortable(f.doc)
          ? { ok: true, value: f as BackupFile }
          : { ok: false, error: 'invalid' }
      }),
  }
}

export function memoryCloud() {
  const c = {
    signedIn: true,
    text: null as string | null,
    writeError: null as unknown,
    available: async () => c.signedIn,
    read: async () => c.text,
    async write(text: string) {
      if (c.writeError) throw c.writeError
      c.text = text
    },
  }
  return c
}
