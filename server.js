// server.js — CRM 會員管理系統
// 同時支援：本機/傳統伺服器（node server.js 直接監聽埠號）
//          與 Vercel Serverless（由 api/index.js 匯出 app，不呼叫 app.listen）
//
// 登入：預設 admin 帳號 + 職董／董顧示範帳號皆可登入（見 lib/bootstrap.js）。
// 登入後所有角色目前看到同一份完整畫面，尚未依角色限制可視範圍／可操作項目
// （這部分之後會再補上，目前僅需求「先能登入」）。
'use strict';

const express = require('express');
const path = require('path');
const db = require('./lib/db');
const crm = require('./lib/crm-data');
const { attachUser, requireAuth } = require('./lib/auth');
const { ensureBootstrapAccounts } = require('./lib/bootstrap');
const { shellPage } = require('./views/shell');
const { ah } = require('./lib/async-handler');

const app = express();
app.set('trust proxy', 1);

// 首次冷啟動時要等資料庫 schema（含遷移）與預設帳號建立完成才處理請求；
// 之後同一個執行個體（warm）會直接沿用已完成的 promise。
const readyPromise = db
  .ensureSchema()
  .then(() => ensureBootstrapAccounts())
  .catch((err) => {
    console.error('系統初始化失敗（請確認 DATABASE_URL 是否正確設定）：', err);
    throw err;
  });

app.use((req, res, next) => {
  readyPromise.then(() => next()).catch((err) => {
    res
      .status(500)
      .send('系統初始化失敗，請確認伺服器環境變數 DATABASE_URL 是否已正確設定為可用的 PostgreSQL 連線字串。');
  });
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(attachUser);

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/api'));

app.get(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const data = await crm.getAppData();
    res.send(shellPage({ data, user: req.user }));
  })
);

app.use((req, res) => {
  res.status(404).send('找不到頁面 (404)');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const esc = (s) => String(s).replace(/</g, '&lt;');
  res.status(500).send('系統發生錯誤：' + esc(err.message || String(err)));
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`CRM 會員管理系統已啟動： http://localhost:${PORT}`);
  });
}

module.exports = app;
