// 底部 4 分頁（app-design §2）：系統原生分頁列（UITabBarController）＋SF Symbols，不加圖示套件。
// 首次體驗未完成時先進 O1–O5。徽章只用於道場的「有到期複習」，上限顯示 99+。
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useDueCount } from '../../screens/dojo/selectors';
import { useAppState } from '../../state/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';

export default function TabsLayout() {
  const onboarding = useAppState((s) => s.doc?.meta.onboarding);
  const due = useDueCount();
  const t = useTheme();
  if (onboarding !== 'done') return <Redirect href="/onboarding" />;
  return (
    <NativeTabs tintColor={t.colors.primary}>
      <NativeTabs.Trigger name="(dojo)">
        <NativeTabs.Trigger.Icon sf={{ default: 'figure.martial.arts', selected: 'figure.martial.arts' }} />
        <NativeTabs.Trigger.Label>道場</NativeTabs.Trigger.Label>
        {/* expo-router 有 children 時忽略 hidden，0 也會顯示，所以改成不渲染 */}
        {due > 0 && <NativeTabs.Trigger.Badge>{due > 99 ? '99+' : String(due)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="practice">
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} />
        <NativeTabs.Trigger.Label>修行</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="collection">
        <NativeTabs.Trigger.Icon sf="square.grid.3x3" />
        <NativeTabs.Trigger.Label>收集冊</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} />
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
