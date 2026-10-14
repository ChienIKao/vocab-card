# vocab-card

從 Gemini Canvas 還原的英文學習閃卡，支援分類、翻面、英文朗讀、新增與編輯卡片、批次匯入及 JSON 備份。

## 執行

執行 `node scripts/serve.mjs`，開啟 `http://localhost:4173/vocab-card/`。樣式、圖示、字型與 Firebase SDK 使用外部 CDN，需要網路連線。

## GitHub Pages

[線上版本](https://chienikao.github.io/vocab-card/) · [GitHub repository](https://github.com/ChienIKao/vocab-card)

GitHub Pages 的發布來源為 **main / (root)**，推送至 `main` 後會自動部署。

## 資料儲存

已啟用 Google OIDC 登入與 Firestore 同步，Firebase 專案為 `vocab-card-c4149`，使用免付費 Spark 方案，未連結帳單帳戶。資料庫使用台灣 `asia-east1` 地區的 Standard 版。

登入後每張卡片獨立保存在 `users/{uid}/cards/{cardId}`，排序保存在 `users/{uid}`。每次只上傳變更的卡片；同一張卡片的同時編輯以最後成功寫入的版本為準。尚未成功同步的變更保存在該帳號的本機待同步清單中。

本機詞庫和各登入帳號的快取分開保存。新帳號第一次建立雲端詞庫時會帶入目前的本機卡片；已存在的雲端詞庫會直接載入。

Gemini 上的自訂卡片可使用「詞庫 → 匯出備份」匯出，再於本 app 使用「還原備份」匯入。

## Firebase 設定

1. 建立 Firebase 專案與 Web app，將公開的 Firebase Web 設定物件填入 `firebase-config.js` 的 `firebaseConfig`，以及 Google 登入供應商的公開 Web 用戶端 ID 填入 `googleClientId`。app 透過 Google Identity Services 取得 Google OIDC ID token，再由 Firebase Authentication 驗證；OAuth client secret 保存在服務端。
2. 在 Authentication 啟用 Google 登入，將 `chienikao.github.io` 和 `localhost` 加入授權網域。在 Google Cloud OAuth Web 用戶端的授權 JavaScript 來源加入 `https://chienikao.github.io` 和 `http://localhost:4173`。
3. 建立 Cloud Firestore，先使用正式環境的封閉規則。
4. 在 app 用 Google 登入一次，在 Firebase Authentication 的使用者列表取得自己的 UID。`firestore.rules` 的 `isOwner` 已填入目前擁有者的 UID；若改用另一個 Firebase 專案，請替換成新的 UID，再於 Firestore 控制台發布規則。也可使用 Firebase CLI 執行 `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`。
5. 推送專案設定與程式至 `main`，重新整理 app，即可啟用跨裝置同步。

`firestore.rules` 只允許指定 UID 存取自己的詞庫。Firebase Web 設定是前端公開設定；資料權限由 Firebase Authentication 與 Firestore 規則控制。

下載的獨立 HTML 閃卡檔使用本機儲存，線上網址版本提供雲端同步。

## 驗證

`node --test tests/sync-model.test.mjs`

## 原始來源

[Gemini 公開分享](https://gemini.google.com/share/5d18371c23d0)。
