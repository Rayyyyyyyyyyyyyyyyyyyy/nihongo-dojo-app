// S19 授權全文（handoff H-11）：資料整理來源的版權聲明全文，以及 App 直接使用的開源套件。
// OPEN_SOURCE 由 licenses.test.ts 對照 package.json 與 node_modules，新增套件時測試會提醒補上。
export const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`

// chyyran/jlpt-anki-decks 的 LICENSE（DO WHAT YOU WANT TO PUBLIC LICENSE v3），2026-11-10 自 GitHub 取得。
export const WTFPL_V3_TEXT = `DO WHAT YOU WANT TO PUBLIC LICENSE
Version 3, January 2012

Copyright (C) 2012 Ryan Thompson

Everyone is permitted to copy and distribute verbatim or modified copies of this license document, and changing it is allowed as long as the name is changed.

DO WHAT YOU WANT TO PUBLIC LICENSE
TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION

0. You just DO WHAT YOU WANT TO.`

// 版權行取自各 repo 的 LICENSE（2026-11-10）；Sigmabond01/jlpt-grammar-api 的 LICENSE 檔當天取不到（404），版權行待確認。
export const LICENSE_NOTICES: Array<{ source: string; text: string }> = [
  { source: 'elzup/jlpt-word-list', text: `MIT License\n\nCopyright (c) 2020 Jamie Sinclair\nCopyright (c) 2020 elzup\n\n${MIT_TEXT}` },
  { source: 'jamsinclair/open-anki-jlpt-decks', text: `MIT License\n\nCopyright (c) 2020 Jamie Sinclair\n\n${MIT_TEXT}` },
  { source: 'chyyran/jlpt-anki-decks', text: WTFPL_V3_TEXT },
  { source: 'Sigmabond01/jlpt-grammar-api', text: `MIT License\n\n${MIT_TEXT}` },
]

export const OPEN_SOURCE: Array<{ name: string; license: string }> = [
  'expo', 'expo-clipboard', 'expo-constants', 'expo-crypto', 'expo-file-system', 'expo-haptics', 'expo-iap', 'expo-linking',
  'expo-notifications', 'expo-router', 'expo-speech', 'expo-status-bar', 'react', 'react-native', 'react-native-cloud-storage',
  'react-native-safe-area-context', 'react-native-screens',
].map((name) => ({ name, license: 'MIT' }))
