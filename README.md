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

### 草稿與審閱（C10）

新題先寫在 `src/data/drafts/<level>/{grammar,reading,listening}.json`（`origin: "ai-draft"`），不直接出貨。審閱結果逐行追加到 `review/ledger.jsonl`（不打包；只增不改），每行：

```json
{"key":["n3","grammar","g-n3-031"],"contentHash":"<sha256>","decision":"approve","reviewer":"R1","role":"native-teacher","date":"2026-12-01","notes":""}
```

`contentHash` 是題目去掉 `origin`／`source`／`draftedAt` 後、鍵排序 JSON 的 SHA-256；`npm run check:review -- --list` 印出每個待審題的範本行。同一題以最後一行為準，只有雜湊相符的 `approve` 會出貨：

```sh
npm run check:review -- --write   # 把已核准草稿寫入 src/data/bank/reviewed.json
npm run check:data -- --write     # 更新 counts.json／manifest.json（只計已審）
```

核准後題目再被修改，`check:review`（包含在 `npm run check`）就失敗，須重新審閱。開發時設 `EXPO_PUBLIC_DOJO_INCLUDE_DRAFTS=1` 再 `npx expo start`，可另外載入未審草稿（仍標 `origin: "ai-draft"`）；正式 bundle 不含草稿。

在受限網路下，`expo install`／`expo export` 可加 `EXPO_OFFLINE=1`。

## 狀態

開發中。實機、模擬器、內購 sandbox、iCloud 尚未驗證；上架未進行。
