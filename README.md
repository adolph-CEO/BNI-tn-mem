# CRM 會員管理系統

區域 → 分會 → 會員的會員管理平台。單一公開頁面（無登入、無帳號權限），前端為 vanilla JS 單頁應用，後端 Node.js + Express 提供 JSON API，資料庫使用 PostgreSQL，可直接部署到 Vercel（搭配 Neon / Vercel Postgres 等雲端資料庫），也可部署到任何支援 Node.js 的平台。

## 系統架構

- **區域（Region）**：最上層，僅一個，名稱可於畫面上直接重新命名。
- **分會（Chapter）**：隸屬於區域，名稱可直接重新命名。
- **會員（Member）**：隸屬於唯一一個分會，具有姓名、專業別、在籍狀態；可指派「主席／副主席／秘財」職務（每項職務同一分會僅一人），並可標記是否為「執行董事」——職務直接掛在會員身上，不需另外開帳號。
- **行業別 / 專業別**：專業別一對一歸屬於某個行業別（例如「會計記帳」屬於「專業服務」）。
- **無登入**：全站公開，所有人看到並操作同一份資料，沒有角色分層權限。

## 快速開始（本機開發）

需要一個可連線的 PostgreSQL（本機安裝、Docker、或免費的 [Neon](https://neon.tech) 皆可）。

```bash
cd bni
npm install
cp .env.example .env
# 編輯 .env，填入 DATABASE_URL（本機 Postgres 未啟用 SSL 時記得加上 ?sslmode=disable）

npm run seed          # 建立資料表結構 + Demo 資料
npm run start:env     # 啟動伺服器，預設 http://localhost:3000
```

首次啟動會自動建立/遷移資料表結構（`db.ensureSchema()`），不需要額外的帳號設定步驟。

## Demo 資料（執行 `npm run seed` 後）

1 區域（台南區）、4 分會、20 位會員、10 種專業別、5 個行業別；每個分會都有主席／副主席／秘財，2 位會員標記為執行董事，2 位會員標記為離會（示範篩選）。

## 功能總覽

- **儀表板**：KPI 卡片（總會員數／分會數量／涵蓋行業別／領導職務就位比例）、各分會人數與專業別分布長條圖、主席／副主席／秘財名冊總覽、可展開的組織層級樹。
- **會員列表**：依會員狀態（僅在會／含離會）、行業別、分會篩選（左側欄，帶即時計數）；姓名搜尋；分頁；CSV 匯入（欄位順序：姓名, 分會, 專業別, 狀態）；一鍵設為離會／恢復在會。
- **分會管理**：卡片式呈現各分會，可行內重新命名；可展開指派主席／副主席／秘財（僅能指派該分會的在籍會員）。
- 區域名稱可在頂部導覽列直接重新命名。

## 資料模型遷移說明

這個版本把資料模型從「帳號登入 + 分層權限（admin/執董/董顧帳號、分會幹部另開關聯表）」簡化為「職務直接掛在會員身上、專業別一對一歸屬行業別」。遷移是**加欄位、不刪資料**：`members` 新增 `role` / `exec_director` 欄位並自動從舊版 `chapter_officers` / `users` 表回填；`professions` 新增 `industry_id` 欄位並自動從舊版多對多的 `profession_industry_tags` 回填（一個專業別若舊版掛了多個行業標籤，遷移後只保留其中一個）。舊表格本身目前仍保留在資料庫中未刪除，供之後確認新版穩定運作後再清理。

## 部署到 Vercel + GitHub

這個專案已經內建 Vercel 適配（`api/index.js` + `vercel.json`），但**推送到 GitHub、在 Vercel 建立專案、設定資料庫，這幾步需要您自己的帳號授權，Claude 無法代為操作**。步驟如下：

### 1. 建立雲端 Postgres（建議 Neon，免費額度足夠此系統使用）

1. 到 [neon.tech](https://neon.tech) 註冊並建立一個新專案（Project）。
2. 建立完成後複製「Connection string」，格式類似：
   `postgresql://USER:PASSWORD@ep-xxxx.aws.neon.tech/neondb?sslmode=require`

（若您比較熟悉 Vercel 內建的 Vercel Postgres / Supabase，同樣可以，取得連線字串即可。）

### 2. 推送到 GitHub

```bash
cd bni
git init
git add .
git commit -m "Initial commit: CRM 會員管理系統"
git branch -M main
git remote add origin https://github.com/<您的帳號>/<repo名稱>.git
git push -u origin main
```

（需先在 GitHub 網站上建立一個空的 repository，並確認本機已設定好 GitHub 登入憑證。）

### 3. 在 Vercel 匯入專案

1. 到 [vercel.com/new](https://vercel.com/new)，選擇剛剛推送的 GitHub repo 並匯入。
2. Framework Preset 選 **Other**（不需要 build command，Vercel 會自動偵測 `api/` 目錄）。
3. 在 Environment Variables 設定以下變數（Production 與 Preview 都要設定）：

   | 變數 | 值 |
   |---|---|
   | `DATABASE_URL` | 步驟 1 取得的 Postgres 連線字串 |

4. 點 Deploy。完成後 Vercel 會給您一個 `https://xxxx.vercel.app` 網址。
5. 第一次開啟網站時，系統會自動建立/遷移資料表結構。若要載入 Demo 資料，需在本機（或任何能連到同一個 `DATABASE_URL` 的環境）執行一次 `DATABASE_URL=... npm run seed`。

### 為什麼不能用原本的 SQLite？

Vercel 是無伺服器（serverless）架構，函式執行完就會被回收，檔案系統除了 `/tmp` 以外都是唯讀，且 `/tmp` 也不會在多次呼叫之間保留。這代表任何寫入本機檔案的資料庫（例如 SQLite）在 Vercel 上**每次都會被清空或不同執行個體看到不同的資料**。因此這個版本已經把資料層改為 PostgreSQL（透過 `DATABASE_URL` 連線），資料保存在雲端資料庫，與函式本身的生命週期無關。

若您之後不想用 Vercel，改用 Railway / Render / 自架主機等支援長駐程序與持久磁碟的平台，一樣可以直接使用同一份程式碼，只要提供 `DATABASE_URL`（可以是這些平台自帶的 Postgres 附加元件）即可，不需要額外修改。

## 環境變數

| 變數 | 說明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 連線字串（必填） |
| `PORT` | 本機執行時的埠號，預設 3000（Vercel 上不需要） |

## 目錄結構

```
bni/
├── server.js            # Express app 定義（本機直接執行會呼叫 app.listen）
├── api/index.js         # Vercel Serverless 進入點（匯出同一個 app，不呼叫 listen）
├── vercel.json           # 將所有路徑導向 api/index.js（style.css / app.js 例外，走靜態檔案）
├── lib/                  # 資料庫連線、資料存取（crm-data.js）、Demo 資料
├── routes/api.js          # JSON API（無登入，全站公開）
├── views/shell.js         # 單頁應用的 HTML 殼層（內嵌初始資料）
├── public/app.js          # 前端 vanilla JS（畫面渲染、篩選、分頁、CSV 匯入等互動）
├── public/style.css       # 藍圖／工程圖風格設計系統
└── data/                  # 本機開發用暫存目錄（非資料庫）
```

`lib/`、`routes/`、`views/` 底下仍留有舊版（登入 + 伺服器端渲染多頁）的檔案未刪除，但 `server.js` 已不再引用，屬於未使用的死碼，之後確認新版穩定後可以清理。

## 技術選型說明

前端刻意不使用 React / Vue 等框架，改採 vanilla JS 直接操作 DOM（單一 `public/app.js`，資料量小，全部載入前端做篩選/搜尋/分頁即可，不需要框架的複雜度）。後端維持 Express + PostgreSQL，資料層改用 PostgreSQL 是為了相容 Vercel 等 serverless 平台的無狀態特性；若未來不考慮 serverless 部署，這套程式碼同樣能跑在任何一般 Node.js 主機上。
