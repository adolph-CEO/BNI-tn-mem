# BNI 會員管理系統

區域 → 分會 → 會員三層式資料管理平台。Node.js + Express 伺服器端渲染，資料庫使用 PostgreSQL，可直接部署到 Vercel（搭配 Neon / Vercel Postgres 等雲端資料庫），也可部署到任何支援 Node.js 的平台。

## 系統架構

- **區域（Region）**：最上層，由「執行董事（執董）」管理。
- **分會（Chapter）**：隸屬於區域，每個分會由 1~2 位「董事顧問（董顧）」管理。
- **會員（Member）**：隸屬於唯一一個分會，具有姓名、專業別、在籍狀態。會員本人也可能同時是另一個分會的董顧，或是區域執董——系統會即時運算顯示「目前管理職務」，不需手動同步。
- **帳號角色**：
  - `admin` 超級管理員：系統初始帳號，可停用，擁有全部權限。
  - `executive` 執行董事：管理所屬區域內所有分會與會員，可建立/停用該區域的董顧帳號。
  - `advisor` 董事顧問：僅能管理被指派的 1~2 個分會之會員資料。

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

首次啟動（未執行過 `npm run seed`）也會自動建立資料表與一組超級管理帳號，帳密預設 `admin` / `admin1234`（可用環境變數 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 覆寫）。**正式上線前請務必登入後於「職務設定」建立正式執董/董顧帳號，再將 admin 帳號停用。**

## Demo 帳號（執行 `npm run seed` 後）

| 角色 | 帳號 | 密碼 | 說明 |
|---|---|---|---|
| 超級管理員 | admin | admin1234 | 初始帳號，可停用 |
| 執行董事 | director01 | director123 | 管理台南區全部 4 個分會 |
| 董事顧問 | advisor01 | advisor123 | 管理台南信義分會 |
| 董事顧問 | advisor02 | advisor123 | 管理台南永華分會 |
| 董事顧問 | advisor03 | advisor123 | 會籍在信義分會，管理台南**安平**分會（跨分會管理示範） |
| 董事顧問 | advisor04 | advisor123 | 管理台南安平分會（與 advisor03 共同管理，示範一分會 2 位董顧） |
| 董事顧問 | advisor05 | advisor123 | 管理台南新營分會 |

## 功能總覽

- **會員資料**：清單依分會（勾選複選）、專業別（勾選複選）篩選，預設不顯示已離會會員；可搜尋姓名；「離會」「恢復在籍」一鍵切換。
- **Excel 匯入**：支援 `.xlsx` / `.xls` / `.csv`，自動辨識「姓名／分會／專業別」欄位標題，分會需與現有分會名稱相符，專業別若不存在會自動建立；同分會同姓名視為既有會員並更新其專業別。匯入結果會列出未成功的資料列與原因。
- **專業別 / 行業標籤**：列出各分會的專業別分佈，並可將專業別歸屬到多個行業標籤（例如「會計記帳」「不動產仲介」同時屬於「專業服務」）。
- **職務設定**：新增區域、分會；建立執董／董顧帳號並指派管理範圍；帳號啟用／停用；一個分會最多可指派 2 位董顧（超過會擋下並提示）。

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
git commit -m "Initial commit: BNI 會員管理系統"
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
   | `SESSION_SECRET` | 一組隨機字串，例如用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 產生 |
   | `ADMIN_USERNAME` | 選填，預設 `admin` |
   | `ADMIN_PASSWORD` | 建議自行設定，避免使用預設密碼 |

4. 點 Deploy。完成後 Vercel 會給您一個 `https://xxxx.vercel.app` 網址。
5. 第一次開啟網站時，系統會自動建立資料表結構與超級管理帳號（訊息會印在 Vercel 的 Function Logs 裡，或直接用您設定的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登入）。若要載入 Demo 資料，需在本機（或任何能連到同一個 `DATABASE_URL` 的環境）執行一次 `DATABASE_URL=... npm run seed`。

### 為什麼不能用原本的 SQLite？

Vercel 是無伺服器（serverless）架構，函式執行完就會被回收，檔案系統除了 `/tmp` 以外都是唯讀，且 `/tmp` 也不會在多次呼叫之間保留。這代表任何寫入本機檔案的資料庫（例如 SQLite）在 Vercel 上**每次都會被清空或不同執行個體看到不同的資料**。因此這個版本已經把資料層改為 PostgreSQL（透過 `DATABASE_URL` 連線），資料保存在雲端資料庫，與函式本身的生命週期無關。

若您之後不想用 Vercel，改用 Railway / Render / 自架主機等支援長駐程序與持久磁碟的平台，一樣可以直接使用同一份程式碼，只要提供 `DATABASE_URL`（可以是這些平台自帶的 Postgres 附加元件）即可，不需要額外修改。

## 環境變數

| 變數 | 說明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 連線字串（必填） |
| `SESSION_SECRET` | Session 簽章密鑰（正式環境必填，否則每次冷啟動會讓所有人被登出） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 初始超級管理帳號，僅在資料庫中尚無任何 admin 帳號時生效 |
| `PORT` | 本機執行時的埠號，預設 3000（Vercel 上不需要） |

## 目錄結構

```
bni/
├── server.js            # Express app 定義（本機直接執行會呼叫 app.listen）
├── api/index.js         # Vercel Serverless 進入點（匯出同一個 app，不呼叫 listen）
├── vercel.json           # 將所有路徑導向 api/index.js（style.css 例外，走靜態檔案）
├── lib/                  # 資料庫連線、權限範圍、認證、匯入、Demo 資料等核心邏輯
├── routes/                # Express 路由（auth / members / professions / org）
├── views/                 # 伺服器端渲染的 HTML 樣板（純字串樣板，無框架依賴）
├── public/style.css       # 金 + 淺湖水綠配色主題（卡片式／藥丸元件風格）
└── data/                  # 僅用於本機開發時暫存 session 密鑰檔案（非資料庫）
```

## 技術選型說明

刻意不使用 Next.js / React 等前端框架，改採 Express + 伺服器端字串樣板：頁面皆為傳統表單送出（無需 JavaScript 建置流程），部署與維運更單純。資料層改用 PostgreSQL 是為了相容 Vercel 等 serverless 平台的無狀態特性；若未來不考慮 serverless 部署，這套程式碼同樣能跑在任何一般 Node.js 主機上。
