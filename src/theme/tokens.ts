// 由 src/theme/tokens.json（設計規格 design/tokens.json 的副本）轉寫；說明用的 `_`／`$` 欄位與只有規則文字的 elevation 未收錄。
// 修改時同步 tokens.json，tokens.test.ts 會比對兩者。
export const tokens = {
  "color": {
    "light": {
      "bg": "#F6F7F5",
      "surface": "#FFFFFF",
      "surface2": "#ECEFEC",
      "surfaceCeremony": "#1B3A5C",
      "ink": "#20242B",
      "ink2": "#5B6470",
      "ink3": "#646C78",
      "inkDisabled": "#8892A0",
      "primary": "#1B3A5C",
      "primaryPressed": "#0F2438",
      "onPrimary": "#FFFFFF",
      "accent": "#C73E2E",
      "onAccent": "#FFFFFF",
      "seal": "#C73E2E",
      "correct": "#276B46",
      "correctBg": "#EAF5EE",
      "wrong": "#B3372A",
      "wrongBg": "#FBEAE7",
      "warn": "#8A5A00",
      "warnBg": "#FBF1DD",
      "focus": "#1B3A5C",
      "separator": "#DDE3E6",
      "outline": "#5B6470",
      "onCeremony": "#FFFFFF",
      "ceremonyOutline": "#FFFFFF"
    },
    "dark": {
      "bg": "#0E1620",
      "surface": "#16212D",
      "surface2": "#1F2C3B",
      "surfaceCeremony": "#0A1018",
      "ink": "#E9ECEA",
      "ink2": "#A9B3BF",
      "ink3": "#8F9AA7",
      "inkDisabled": "#5E6976",
      "primary": "#A9C4E4",
      "primaryPressed": "#C7DAF0",
      "onPrimary": "#0F2438",
      "accent": "#F08A78",
      "onAccent": "#0E1620",
      "seal": "#E86A57",
      "correct": "#7CCB9F",
      "correctBg": "#143524",
      "wrong": "#F29384",
      "wrongBg": "#3D1D18",
      "warn": "#E8B85C",
      "warnBg": "#33280F",
      "focus": "#A9C4E4",
      "separator": "#2A3847",
      "outline": "#A9B3BF",
      "onCeremony": "#E9ECEA",
      "ceremonyOutline": "#A9B3BF"
    },
    "belt": {
      "white": "#FFFFFF",
      "yellow": "#E3B505",
      "orange": "#E07A1F",
      "green": "#2E7D52",
      "blue": "#2B5FA8",
      "purple": "#6A4C93",
      "brown": "#7A4E2D",
      "black": "#1A1A1A",
      "stripe": "#C73E2E"
    }
  },
  "contrastPairs": [
    [
      "ink",
      "bg",
      4.5
    ],
    [
      "ink",
      "surface",
      4.5
    ],
    [
      "ink",
      "surface2",
      4.5
    ],
    [
      "ink2",
      "bg",
      4.5
    ],
    [
      "ink2",
      "surface",
      4.5
    ],
    [
      "ink2",
      "surface2",
      4.5
    ],
    [
      "ink3",
      "bg",
      4.5
    ],
    [
      "ink3",
      "surface",
      4.5
    ],
    [
      "ink3",
      "surface2",
      4.5
    ],
    [
      "onPrimary",
      "primary",
      4.5
    ],
    [
      "primary",
      "bg",
      4.5
    ],
    [
      "primary",
      "surface",
      4.5
    ],
    [
      "accent",
      "bg",
      4.5
    ],
    [
      "accent",
      "surface",
      4.5
    ],
    [
      "onAccent",
      "accent",
      4.5
    ],
    [
      "correct",
      "correctBg",
      4.5
    ],
    [
      "correct",
      "surface",
      4.5
    ],
    [
      "ink",
      "correctBg",
      4.5
    ],
    [
      "wrong",
      "wrongBg",
      4.5
    ],
    [
      "wrong",
      "surface",
      4.5
    ],
    [
      "ink",
      "wrongBg",
      4.5
    ],
    [
      "warn",
      "warnBg",
      4.5
    ],
    [
      "ink",
      "warnBg",
      4.5
    ],
    [
      "seal",
      "surface",
      3
    ],
    [
      "focus",
      "surface",
      3
    ],
    [
      "focus",
      "bg",
      3
    ],
    [
      "outline",
      "surface",
      3
    ],
    [
      "outline",
      "bg",
      3
    ],
    [
      "outline",
      "surface2",
      3
    ],
    [
      "onCeremony",
      "surfaceCeremony",
      4.5
    ],
    [
      "ceremonyOutline",
      "surfaceCeremony",
      3
    ]
  ],
  "fixedPairs": [
    [
      "#C73E2E",
      "#1A1A1A",
      3,
      "belt.stripe on belt.black（兩種外觀相同）"
    ]
  ],
  "font": {
    "display": {
      "family": "HiraMinProN-W6",
      "fallback": "system serif",
      "use": "日文學習內容大字、段位名、畫面大標"
    },
    "displayRegular": {
      "family": "HiraMinProN-W3",
      "use": "日文例句、讀解本文"
    },
    "text": {
      "family": "System",
      "use": "所有繁中 UI 文字（iOS 系統字，繁中為 PingFang TC）"
    },
    "numeric": {
      "family": "System",
      "fontVariant": [
        "tabular-nums"
      ],
      "use": "XP、題數、連勝天數"
    }
  },
  "type": {
    "wordHero": {
      "size": 48,
      "lineHeight": 56,
      "weight": "W6",
      "font": "display",
      "textStyle": "custom (scales with largeTitle)",
      "maxScale": 1.6
    },
    "largeTitle": {
      "size": 34,
      "lineHeight": 41,
      "weight": "700",
      "font": "text",
      "textStyle": "largeTitle"
    },
    "title1": {
      "size": 28,
      "lineHeight": 34,
      "weight": "700",
      "font": "display",
      "textStyle": "title1"
    },
    "title2": {
      "size": 22,
      "lineHeight": 28,
      "weight": "700",
      "font": "text",
      "textStyle": "title2"
    },
    "headline": {
      "size": 17,
      "lineHeight": 22,
      "weight": "600",
      "font": "text",
      "textStyle": "headline"
    },
    "body": {
      "size": 17,
      "lineHeight": 26,
      "weight": "400",
      "font": "text",
      "textStyle": "body"
    },
    "bodyJa": {
      "size": 19,
      "lineHeight": 30,
      "weight": "W3",
      "font": "displayRegular",
      "textStyle": "body (+2)"
    },
    "callout": {
      "size": 16,
      "lineHeight": 22,
      "weight": "400",
      "font": "text",
      "textStyle": "callout"
    },
    "footnote": {
      "size": 13,
      "lineHeight": 18,
      "weight": "400",
      "font": "text",
      "textStyle": "footnote"
    },
    "caption": {
      "size": 12,
      "lineHeight": 16,
      "weight": "400",
      "font": "text",
      "textStyle": "caption1"
    }
  },
  "space": {
    "0": 0,
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48,
    "16": 64
  },
  "layout": {
    "gutter": 16,
    "gutterWide": 20,
    "sectionGap": 32,
    "cardPadding": 16,
    "touchTargetMin": 44,
    "buttonHeight": 50,
    "listRowMinHeight": 52,
    "contentMaxWidth": 560
  },
  "radius": {
    "surface": 6,
    "chip": 6,
    "button": 25,
    "sheet": 12
  },
  "motion": {
    "duration": {
      "instant": 100,
      "fast": 160,
      "base": 240,
      "slow": 400,
      "ceremony": 2400
    },
    "ease": {
      "standard": [
        0.2,
        0,
        0,
        1
      ],
      "exit": [
        0.4,
        0,
        1,
        1
      ],
      "settle": {
        "type": "spring",
        "damping": 18,
        "stiffness": 220,
        "mass": 1
      }
    },
    "reduceMotion": {
      "replaceTranslateScaleWith": "opacity",
      "maxDuration": 200,
      "disableLoops": true
    }
  },
  "haptic": {
    "correct": "notification.success",
    "wrong": "notification.warning",
    "combo": "impact.light",
    "stamp": "impact.heavy",
    "rankUp": "notification.success",
    "selection": "selection"
  }
} as const;

export type ColorScheme = 'light' | 'dark';
export type ColorToken = keyof typeof tokens.color.light;
export type Palette = { readonly [K in ColorToken]: string };
export type TypeVariant = keyof typeof tokens.type;
export type MotionDuration = keyof typeof tokens.motion.duration;
export type HapticEvent = keyof typeof tokens.haptic;

export const palettes: { readonly [S in ColorScheme]: Palette } = tokens.color;

// RN TextStyle：字重 'W6'／'W3' 由明朝字型族名本身決定，不轉成 fontWeight。
export function typeStyle(variant: TypeVariant) {
  const t = tokens.type[variant];
  const font = tokens.font[t.font];
  return {
    fontFamily: font.family,
    fontSize: t.size,
    lineHeight: t.lineHeight,
    ...(t.weight.startsWith('W') ? {} : { fontWeight: t.weight as '400' | '600' | '700' }),
  };
}

// Dynamic Type 建議值（visual-system.md §6）：一律可縮放；只有設 maxScale 的字級（wordHero 1.6）設上限，正文不設。
export function fontScaling(variant: TypeVariant): { allowFontScaling: true; maxFontSizeMultiplier?: number } {
  const t = tokens.type[variant];
  return 'maxScale' in t ? { allowFontScaling: true, maxFontSizeMultiplier: t.maxScale } : { allowFontScaling: true };
}
