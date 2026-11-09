// CloudPort 的真實實作：react-native-cloud-storage 的 iCloud Documents 範圍。需要 iCloud capability 與實機（handoff §5 E-02）。
import { CloudStorage, CloudStorageScope } from 'react-native-cloud-storage'
import type { CloudPort } from './backup'

const PATH = '/dojo-backup.json'

export const iCloudPort: CloudPort = {
  available: () => CloudStorage.isCloudAvailable(),
  async read() {
    if (!(await CloudStorage.exists(PATH, CloudStorageScope.Documents))) return null
    await CloudStorage.downloadFile(PATH, CloudStorageScope.Documents) // 另一台裝置寫的檔可能還沒下載
    return CloudStorage.readFile(PATH, CloudStorageScope.Documents)
  },
  write: (text) => CloudStorage.writeFile(PATH, text, CloudStorageScope.Documents),
}
