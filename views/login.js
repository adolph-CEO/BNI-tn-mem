// views/login.js
'use strict';

const { esc } = require('../lib/util');

function loginPage({ error } = {}) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>登入 — BNI 會員管理系統</title>
<link rel="stylesheet" href="/style.css" />
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <div class="logo">
      <div><span class="dot"></span><span>BNI 會員管理系統</span></div>
      <div class="sub">區域 · 分會 · 會員資料管理平台</div>
    </div>
    ${error ? `<div class="alert alert-error">${esc(error)}</div>` : ''}
    <form method="post" action="/login">
      <div class="form-row">
        <label>帳號</label>
        <input type="text" name="username" required autofocus />
      </div>
      <div class="form-row">
        <label>密碼</label>
        <input type="password" name="password" required />
      </div>
      <button class="btn btn-primary" type="submit">登入</button>
    </form>
  </div>
</div>
</body>
</html>`;
}

module.exports = { loginPage };
