import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import * as RN from 'react-native';
import { ThemeProvider, useTheme } from './ThemeProvider';

function Probe() {
  const t = useTheme();
  return <Text testID="probe">{`${t.scheme} ${t.colors.bg} ${t.motion.reduceMotion} ${t.motion.duration.base}`}</Text>;
}

afterEach(() => jest.restoreAllMocks());

test.each([
  ['light', 'light #F6F7F5 false 240'],
  ['dark', 'dark #0E1620 false 240'],
] as const)('%s 外觀提供對應色彩', async (scheme, expected) => {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue(scheme);
  await render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByTestId('probe')).toHaveTextContent(expected);
});

test('減少動態開啟時動效時長為 0，且跟隨變更事件', async () => {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  let listener: (v: boolean) => void = () => {};
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, fn: (v: boolean) => void) => {
    listener = fn;
    return { remove: jest.fn() };
  }) as never);
  await render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByTestId('probe')).toHaveTextContent('light #F6F7F5 true 0');
  await act(async () => listener(false));
  expect(screen.getByTestId('probe')).toHaveTextContent('light #F6F7F5 false 240');
});
