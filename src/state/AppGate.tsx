import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Skeleton } from '../ui/States';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from './AppProvider';

// 載入中（300ms 後顯示靜態骨架）與讀取失敗；損毀時的「前往恢復」（S16）由下一個工作接上。
export function AppGate({ children }: { children: ReactNode }) {
  const status = useAppState((s) => s.status);
  const { colors, space } = useTheme();
  if (status === 'ready') return children;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[4], backgroundColor: colors.bg }}>
      {status === 'loading' ? (
        <View style={{ alignSelf: 'stretch' }}>
          <Skeleton label="載入進度中" />
        </View>
      ) : (
        <Text accessibilityRole="alert" style={{ color: colors.ink, textAlign: 'center' }}>
          進度資料無法讀取，已保留原始資料。
        </Text>
      )}
    </View>
  );
}
