// views/shell.js — 單頁應用的 HTML 殼層（需登入）
'use strict';

const ROLE_LABEL = { admin: '超級管理員', executive: '職董', advisor: '董顧' };

function shellPage({ data, user }) {
  const payload = {
    ...data,
    currentUser: user ? { displayName: user.display_name, role: user.role, roleLabel: ROLE_LABEL[user.role] || user.role } : null,
  };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BNI CRM 會員管理</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div id="app">
  <div class="nav" id="nav"></div>
  <div class="layout">
    <aside class="sidebar" id="sidebar"></aside>
    <main class="main" id="main"></main>
  </div>
</div>
<script id="initial-data" type="application/json">${json}</script>
<script src="/app.js"></script>
</body>
</html>`;
}

module.exports = { shellPage };
