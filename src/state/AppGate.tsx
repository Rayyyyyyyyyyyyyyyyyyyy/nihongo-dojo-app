import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { BackupPanel } from '../screens/settings/Backup';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/States';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from './AppProvider';

// 載入中（300ms 後顯示靜態骨架）與讀取失敗；損毀時「前往恢復」在這裡直接顯示 S16（其他畫面需要文件，不能進路由）。
export function AppGate({ children }: { children: ReactNode }) {
  const status = useAppState((s) => s.status);
  const { colors, space } = useTheme();
  const [recover, setRecover] = useState(false);
  if (status === 'ready') return children;
  if (status === 'corrupt' && recover) return <BackupPanel />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[4], backgroundColor: colors.bg }}>
      {status === 'loading' ? (
        <View style={{ alignSelf: 'stretch' }}>
          <Skeleton label="載入進度中" />
        </View>
      ) : (
        <View style={{ gap: space[4] }}>
          <Text accessibilityRole="alert" style={{ color: colors.ink, textAlign: 'center' }}>
            進度資料無法讀取，已保留原始資料。
          </Text>
          <Button label="前往恢復" onPress={() => setRecover(true)} />
        </View>
      )}
    </View>
  );
}
