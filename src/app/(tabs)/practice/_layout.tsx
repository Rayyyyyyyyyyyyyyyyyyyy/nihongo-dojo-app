// 分頁內的導覽堆疊：推入次層時分頁列保持可見（HIG Tab bars）。
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';

export default function TabStack() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        // iOS 26＋NativeTabs 下大標題保留空間卻不繪製文字（模擬器 iOS 26.5 實測），改用小標題。
        headerLargeTitle: false,
        headerTransparent: true,
        // iOS 16–25 透明 header 需要 blur；iOS 26 交給系統 scroll edge effect，blur 在深色模式會畫成淺灰底（模擬器 26.5 實測）。
        headerBlurEffect: parseInt(String(Platform.Version), 10) >= 26 ? undefined : 'systemMaterial',
        headerLargeTitleShadowVisible: false,
        headerTintColor: t.colors.primary,
        headerTitleStyle: { color: t.colors.ink },
        contentStyle: { backgroundColor: t.colors.bg },
      }}
    />
  );
}
