// 元件不寫 hex 色碼（handoff.md §4.1）：掃 src/ 下 .ts/.tsx，排除 src/theme/ 與測試。
// 用法：node scripts/check-no-hex.mjs [root]，有違規 exit 1。
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? join(import.meta.dirname, '..');
const src = join(root, 'src');
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const isTest = (name) => /\.test\.tsx?$/.test(name);

const hits = [];
for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
  const file = join(entry.parentPath, entry.name);
  const rel = relative(src, file).split('\\').join('/');
  if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || isTest(entry.name)) continue;
  if (rel.startsWith('theme/') || rel.split('/').includes('__tests__')) continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(HEX)) hits.push(`src/${rel}:${i + 1}: ${m[0]}`);
  });
}

if (hits.length) {
  console.error(`發現 ${hits.length} 個 hex 色碼，請改用 src/theme tokens：\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('check-no-hex: OK');
