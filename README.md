# 日本語道場 iOS App

台灣繁中日文學習者的 JLPT N5–N1 iOS App（Expo／React Native）。由網頁版 [NHK-N3-1](https://github.com/Rayyyyyyyyyyyyyyyyyyyy/NHK-N3-1) 重寫：題庫與學習規則移植，UI/UX 與獎賞機制重新設計。

設計、決策與研究在 skill-workflow repo 的 `projects/nihongo-dojo-ios-app/accepted/`（design/app-design.md、rewards.md、visual-system.md、tokens.json、handoff.md）。

## 開發

需要 Node.js 22。

```sh
npm install
npm run check        # 型別檢查 + 測試
npm run export:ios   # 打包 iOS JS bundle（不需 Mac）
npx expo run:ios     # 在 Mac 上建 development build（內購、iCloud 需要）
```

在受限網路下，`expo install`／`expo export` 可加 `EXPO_OFFLINE=1`。

## 狀態

開發中。實機、模擬器、內購 sandbox、iCloud 尚未驗證；上架未進行。
