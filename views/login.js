// views/login.js — 登入頁（紙雕視覺：藏青紙質底 + 米白挖空品牌字 + 米白卡片 + 黃色按鈕）
'use strict';

const { esc } = require('../lib/util');

function loginPage({ error, username } = {}) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>登入 — BNI CRM 會員管理</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="login-wrap" id="login-wrap">
  <div class="login-rain-layer" id="rain-layer">
    <canvas id="rain-canvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
  </div>
  <div style="position:relative;width:100%;max-width:400px;padding:0 20px">
    <div style="position:relative;z-index:1">
      <div style="text-align:center;margin-bottom:28px">
        <div class="login-brand">BNI CRM 會員管理</div>
        <div class="text-muted" style="margin-top:8px;font-size:13px">請登入以繼續</div>
      </div>

      <form class="login-card" style="display:flex;flex-direction:column;gap:16px;padding:28px 24px;border-radius:4px" method="post" action="/login">
        <div class="field">
          <label for="username">帳號</label>
          <input class="input" id="username" name="username" type="text" placeholder="輸入帳號" value="${esc(username || '')}" autofocus autocomplete="username">
        </div>

        <div class="field">
          <label for="password">密碼</label>
          <input class="input" id="password" name="password" type="password" placeholder="輸入密碼" autocomplete="current-password">
        </div>

        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
          <input type="checkbox" name="remember">
          記住我
        </label>

        <button type="submit" class="btn btn-login-gold btn-block">登入</button>

        ${error ? `<div class="tag tag-outline" style="width:fit-content;border-color:var(--paper-gold-deep);color:var(--paper-navy-900)">${esc(error)}</div>` : ''}
      </form>

      <div style="text-align:center;margin-top:16px">
        <a href="#" onclick="return false;" style="font-size:13px">忘記密碼？</a>
      </div>
    </div>
  </div>
</div>
<script src="/login.js"></script>
</body>
</html>`;
}

module.exports = { loginPage };
