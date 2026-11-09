import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: '道場' }} />
      <Tabs.Screen name="practice" options={{ title: '修行' }} />
      <Tabs.Screen name="collection" options={{ title: '收集冊' }} />
      <Tabs.Screen name="me" options={{ title: '我的' }} />
    </Tabs>
  );
}
