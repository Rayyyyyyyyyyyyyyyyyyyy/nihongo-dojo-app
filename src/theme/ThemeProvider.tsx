import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { fontScaling, palettes, tokens, typeStyle, type ColorScheme } from './tokens';

const zeroDurations = Object.fromEntries(
  Object.keys(tokens.motion.duration).map((k) => [k, 0]),
) as { readonly [K in keyof typeof tokens.motion.duration]: number };

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => active && setReduced(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

function buildTheme(scheme: ColorScheme, reduceMotion: boolean) {
  return {
    scheme,
    colors: palettes[scheme],
    belt: tokens.color.belt,
    font: tokens.font,
    type: tokens.type,
    typeStyle,
    fontScaling,
    space: tokens.space,
    layout: tokens.layout,
    radius: tokens.radius,
    haptic: tokens.haptic,
    motion: {
      reduceMotion,
      // 減少動態時所有時長為 0；需要淡入替代的地方用 alternative（opacity、≤200ms，見 visual-system.md §5）。
      duration: reduceMotion ? zeroDurations : tokens.motion.duration,
      ease: tokens.motion.ease,
      alternative: tokens.motion.reduceMotion,
    },
  };
}

export type Theme = ReturnType<typeof buildTheme>;

const ThemeContext = createContext<Theme>(buildTheme('light', false));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const reduceMotion = useReducedMotion();
  const theme = useMemo(() => buildTheme(scheme, reduceMotion), [scheme, reduceMotion]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
