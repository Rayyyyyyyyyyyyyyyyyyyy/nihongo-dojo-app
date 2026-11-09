import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from './AppProvider';

// 載入中與讀取失敗的簡易狀態；S2／S16 的完整畫面由 C6 實作。
export function AppGate({ children }: { children: ReactNode }) {
  const status = useAppState((s) => s.status);
  const { colors, space } = useTheme();
  if (status === 'ready') return children;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[4], backgroundColor: colors.bg }}>
      {status === 'loading' ? (
        <ActivityIndicator accessibilityLabel="載入進度中" color={colors.primary} />
      ) : (
        <Text accessibilityRole="alert" style={{ color: colors.ink, textAlign: 'center' }}>
          進度資料無法讀取，已保留原始資料。
        </Text>
      )}
    </View>
  );
}
