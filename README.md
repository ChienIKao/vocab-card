# vocab-card

從 Gemini Canvas 還原的英文學習閃卡，支援分類、翻面、英文朗讀、新增與編輯卡片、批次匯入及 JSON 備份。

## 執行

以靜態網站伺服器提供 `index.html`，或直接用瀏覽器開啟檔案。樣式、圖示及字型使用外部 CDN，需要網路連線。

## GitHub Pages

[線上版本](https://chienikao.github.io/vocab-card/) · [GitHub repository](https://github.com/ChienIKao/vocab-card)

GitHub Pages 的發布來源為 **main / (root)**，推送至 `main` 後會自動部署。

## 資料儲存

目前使用 `localStorage`，卡片只保存在同一個瀏覽器與網站來源中。雲端資料庫、Google 登入及跨裝置同步尚未接入。

Gemini 上的自訂卡片可使用「詞庫 → 匯出備份」匯出，再於本 app 使用「還原備份」匯入。

## 原始來源

[Gemini 公開分享](https://gemini.google.com/share/5d18371c23d0)。
