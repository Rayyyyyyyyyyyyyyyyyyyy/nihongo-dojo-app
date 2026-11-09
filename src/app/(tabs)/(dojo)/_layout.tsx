// 分頁內的導覽堆疊：大標題、推入次層時分頁列保持可見（HIG Tab bars）。
import { Stack } from 'expo-router';
import { useTheme } from '../../../theme/ThemeProvider';

export default function TabStack() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: 'systemMaterial',
        headerLargeTitleShadowVisible: false,
        headerTintColor: t.colors.primary,
        headerTitleStyle: { color: t.colors.ink },
        contentStyle: { backgroundColor: t.colors.bg },
      }}
    />
  );
}
