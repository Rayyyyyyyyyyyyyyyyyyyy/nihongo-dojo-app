import { useState } from 'react';
import { RootNavigator } from '../screens/RootNavigator';
import { createAppServices } from '../services/app';
import { AppGate } from '../state/AppGate';
import { AppProvider } from '../state/AppProvider';
import { ThemeProvider } from '../theme/ThemeProvider';

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
