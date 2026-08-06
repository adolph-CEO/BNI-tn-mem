// server.js — BNI 會員管理系統
// 同時支援：本機/傳統伺服器（node server.js 直接監聽埠號）
//          與 Vercel Serverless（由 api/index.js 匯出 app，不呼叫 app.listen）
'use strict';

const express = require('express');
const path = require('path');
const { attachUser } = require('./lib/auth');
const { ensureAdmin } = require('./lib/bootstrap');

const app = express();
app.set('trust proxy', 1);

// 首次冷啟動時要等資料庫 schema 建立、初始 admin 帳號建立完成後才處理請求；
// 之後同一個執行個體（warm）會直接沿用已完成的 promise。
const readyPromise = ensureAdmin().catch((err) => {
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
app.use('/', require('./routes/members'));
app.use('/', require('./routes/professions'));
app.use('/', require('./routes/org'));

app.get('/', (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.redirect('/members');
});

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
    console.log(`BNI 會員管理系統已啟動： http://localhost:${PORT}`);
  });
}

module.exports = app;
