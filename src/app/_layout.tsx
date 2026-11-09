import { Stack } from 'expo-router';
import { useState } from 'react';
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
          <Stack screenOptions={{ headerShown: false }} />
        </AppGate>
      </AppProvider>
    </ThemeProvider>
  );
}
