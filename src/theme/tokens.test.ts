import json from './tokens.json';
import { contrastRatio } from './contrast';
import { fontScaling, tokens, typeStyle } from './tokens';

// 去掉說明用的 `_`／`$` 欄位，與 tokens.ts 的收錄範圍相同。
function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).filter(([k]) => !/^[_$]/.test(k)).map(([k, x]) => [k, strip(x)]));
  return v;
}

test('tokens.ts 與 tokens.json 值一致', () => {
  const { elevation, ...expected } = strip(json) as Record<string, unknown>;
  expect(elevation).toEqual({}); // elevation 只有規則文字
  expect(tokens).toEqual(expected);
});

test('contrastPairs 淺深兩種外觀＋fixedPairs 共 63 項全部達標（同 contrast.py）', () => {
  const failures: string[] = [];
  let checked = 0;
  for (const mode of ['light', 'dark'] as const) {
    const palette = tokens.color[mode];
    for (const [fg, bg, min] of tokens.contrastPairs) {
      checked++;
      const r = contrastRatio(palette[fg], palette[bg]);
      if (r < min) failures.push(`${mode} ${fg} on ${bg} ${r.toFixed(2)} < ${min}`);
    }
  }
  for (const [fg, bg, min, label] of tokens.fixedPairs) {
    checked++;
    if (contrastRatio(fg, bg) < min) failures.push(label);
  }
  expect(checked).toBe(63);
  expect(failures).toEqual([]);
});

test('對比計算與 contrast.py／visual-system.md 數值一致', () => {
  expect(contrastRatio('#C73E2E', '#1A1A1A').toFixed(2)).toBe('3.45');
  expect(contrastRatio(tokens.color.light.accent, tokens.color.light.surface2).toFixed(2)).toBe('4.36');
  expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21);
});

test('字級：wordHero 上限 1.6、正文不設上限；W 字重由字型族決定', () => {
  expect(fontScaling('wordHero')).toEqual({ allowFontScaling: true, maxFontSizeMultiplier: 1.6 });
  expect(fontScaling('body')).toEqual({ allowFontScaling: true });
  expect(typeStyle('wordHero')).toEqual({ fontFamily: 'HiraMinProN-W6', fontSize: 48, lineHeight: 56 });
  expect(typeStyle('headline')).toEqual({ fontFamily: 'System', fontSize: 17, lineHeight: 22, fontWeight: '600' });
});
