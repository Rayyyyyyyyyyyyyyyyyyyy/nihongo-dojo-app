import { useState } from 'react';
import { LogBox } from 'react-native';
import { RootNavigator } from '../screens/RootNavigator';
import { createAppServices } from '../services/app';
import { AppGate } from '../state/AppGate';
import { AppProvider } from '../state/AppProvider';
import { ThemeProvider } from '../theme/ThemeProvider';

// blur 是 iOS 16–25 透明 header 需要的；iOS 26 與 scroll edge effect 重疊只是視覺提醒，別讓 dev toast 蓋住分頁列。
LogBox.ignoreLogs(['Using both `blurEffect` and `scrollEdgeEffects`']);

export default function RootLayout() {
  const [services] = useState(createAppServices);
  return (
    <ThemeProvider>
      <AppProvider services={services}>
        <AppGate>
          <RootNavigator />
        </AppGate>
      </AppProvider>
    </ThemeProvider>
  );
}
