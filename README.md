# vocab-card

個人使用的英文單字卡網頁。透過分類、翻面與英文朗讀練習單字，也能建立自己的詞庫，登入 Google 後在手機與電腦之間同步。

**[開啟單字卡](https://chienikao.github.io/vocab-card/)** · [GitHub repository](https://github.com/ChienIKao/vocab-card)

`vocab-card` 是目前的專案名稱；網頁顯示名稱暫為「日常英文學習閃卡」。

## 功能

- 內建 25 張日常英文單字卡，依行程、飲食、居家、職場與人際主題分類。
- 正面顯示單字、音標與中文意思，背面顯示英文例句、翻譯與補充提示。
- 支援英文朗讀、翻面、切換卡片與隨機洗牌；電腦可用空白鍵翻面，手機可左右滑動切換卡片。
- 新增、編輯、刪除、搜尋與批次匯入單字卡。
- Google OIDC 登入與 Firestore 雲端同步。
- 匯出／還原 JSON 備份，以及下載包含目前詞庫的獨立 HTML 閃卡檔。

## 開始使用

1. 開啟[線上版本](https://chienikao.github.io/vocab-card/)，點選「使用 Google 帳戶登入」。目前的雲端詞庫只開放擁有者帳號存取。
2. 等待頁面上方顯示「雲端詞庫已同步」，即可開始使用或修改卡片。
3. 在另一台裝置開啟相同網址，登入同一個 Google 帳號，即可讀取同一份詞庫。

未登入時，卡片保存在目前瀏覽器的本機詞庫。登入後會切換至帳號的雲端詞庫；登出後回到本機詞庫。

### 匯入與備份

點選「匯入」可一次建立多張卡片，每行一筆，以 `|` 分隔欄位：

```text
單字 | 音標 | 詞性與中文意思 | 英文例句 | 繁體中文翻譯 | 補充提示
commute | /kəˈmjuːt/ | (v.) 通勤 | I commute by train. | 我搭火車通勤。 | commute to work
```

單字、中文意思與英文例句為必填；其他欄位可留空，保留分隔符號即可。匯入視窗可為這批卡片指定分類。

在「詞庫」中使用「匯出備份」下載 JSON，再透過「還原備份」取代目前詞庫。若 Gemini 原版中有自訂卡片，也可用這個方式搬移。登入狀態下還原的詞庫會同步至雲端。

「下載閃卡檔」會產生包含目前詞庫的獨立 HTML 檔，使用本機儲存。需要跨裝置同步時，請使用線上版本。

## 儲存與同步

網頁由 GitHub Pages 提供，Google Identity Services 取得 Google OIDC ID token，Firebase Authentication 驗證登入身分，Cloud Firestore 儲存詞庫。

| 資料 | Firestore 路徑 |
| --- | --- |
| 卡片排序 | `users/{uid}` 的 `order` 欄位 |
| 每張卡片 | `users/{uid}/cards/{cardId}` |

每次只上傳變更的卡片。不同卡片的更新會合併；若兩台裝置同時修改同一張卡片，以最後成功寫入的版本為準。尚未成功同步的變更會保存在該帳號的本機待同步清單，連線恢復後再送出。

本機詞庫與各帳號的快取分開保存。帳號首次建立雲端詞庫時，會帶入當前頁面的卡片；之後登入會直接載入已有的雲端詞庫。

`firestore.rules` 以 Firebase 使用者 UID 限制存取，只有指定擁有者能讀寫自己的詞庫。前端使用公開的 Firebase Web 設定與 OAuth client ID，資料權限由登入身分與 Firestore 規則控制。

## 本機開發

需安裝 Node.js。在專案目錄執行：

```sh
node scripts/serve.mjs
```

開啟 `http://localhost:4173/vocab-card/`。前端直接使用 HTML、JavaScript 與 ES modules，不需要安裝 npm 套件或執行建置。

樣式、圖示、字型、Google 登入服務與 Firebase SDK 透過外部 CDN 載入，開啟網頁時需要網路連線。英文朗讀使用瀏覽器的 Web Speech API，可用聲音依裝置與瀏覽器而異。

### 專案檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 閃卡介面、詞庫操作與本機儲存 |
| `cloud.js` | Google 登入、Firestore 訂閱與待同步變更處理 |
| `firebase-config.js` | Firebase Web 設定與 Google OAuth client ID |
| `sync-model.mjs` | 卡片資料驗證、變更比對與合併 |
| `firestore.rules` | 個人詞庫存取規則 |
| `firebase.json` | Firebase CLI 的規則檔設定 |
| `scripts/serve.mjs` | 本機預覽伺服器 |
| `tests/sync-model.test.mjs` | 同步資料模型測試 |

### 測試

```sh
node --test tests/sync-model.test.mjs
```

測試涵蓋不同卡片的同時更新、待同步刪除、備份還原時的合併、空詞庫與無效卡片資料。

## 部署

### GitHub Pages

目前發布來源為 **`main` 分支的 `/ (root)`**，推送至 `main` 後由 GitHub Pages 自動部署。根目錄的 `.nojekyll` 保留靜態檔案的直接發布方式。

固定網址：`https://chienikao.github.io/vocab-card/`

### Firebase 設定

1. 建立 Firebase 專案及 Web app，在 `firebase-config.js` 填入該專案的 `firebaseConfig` 與 Google OAuth Web 用戶端的 `googleClientId`。
2. 在 Firebase Authentication 啟用 Google 登入，加入網站與本機開發使用的授權網域。
3. 在 Google Cloud 的 OAuth Web 用戶端設定中，加入授權 JavaScript 來源。兩處設定的格式如下：

   | 設定位置 | 範例 |
   | --- | --- |
   | Firebase Authentication → 授權網域 | `<github-user>.github.io`、`localhost` |
   | Google Cloud OAuth → 授權 JavaScript 來源 | `https://<github-user>.github.io`、`http://localhost:4173` |

4. 建立 Cloud Firestore，先採用正式環境的封閉規則。
5. 在 app 登入一次，到 Firebase Authentication 的使用者列表取得自己的 UID，替換 `firestore.rules` 中 `isOwner` 的擁有者 UID，再於 Firestore 控制台發布規則。
6. 發布更新後重新登入，確認頁面顯示「雲端詞庫已同步」。

使用 Firebase CLI 時，可在登入並確認目標專案後部署規則：

```sh
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

GitHub Pages 部署與 Firestore 規則發布分別執行；修改規則檔後需另行發布到 Firebase。

