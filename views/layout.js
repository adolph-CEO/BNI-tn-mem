// views/layout.js
'use strict';

const { esc, ROLE_LABEL } = require('../lib/util');

const ICONS = {
  members:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  tags:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83Z"/><circle cx="7.5" cy="7.5" r="1"/></svg>',
  org:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
  logout:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

function initials(name) {
  if (!name) return '?';
  const s = String(name).trim();
  return s.slice(0, 1);
}

function navLink(href, label, icon, path, extraMatch) {
  const active = path === href || (extraMatch && path.startsWith(extraMatch));
  return `<a href="${href}" class="${active ? 'active' : ''}">${ICONS[icon] || ''}<span>${label}</span></a>`;
}

function layout({ title, user, path = '', body, flash }) {
  let flashHtml = '';
  if (flash) {
    const cls = flash.type === 'error' ? 'alert-error' : flash.type === 'info' ? 'alert-info' : 'alert-success';
    flashHtml = `<div class="alert ${cls}">${esc(flash.message)}</div>`;
  }

  if (!user) {
    return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title || 'BNI 會員管理系統')}</title>
<link rel="stylesheet" href="/style.css" />
</head>
<body>
${body}
</body>
</html>`;
  }

  let nav = '';
  nav += navLink('/members', '會員資料', 'members', path, '/members');
  nav += navLink('/professions', '專業別 / 行業標籤', 'tags', path, '/professions');
  if (user.role === 'admin' || user.role === 'executive') {
    nav += navLink('/org', '職務設定', 'org', path, '/org');
  }

  const roleBadge = `<span class="badge-role badge-${user.role}">${ROLE_LABEL[user.role] || user.role}</span>`;

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title || 'BNI 會員管理系統')}</title>
<link rel="stylesheet" href="/style.css" />
</head>
<body>
<div class="app-shell">
  <aside class="sidebar">
    <div class="brand"><span class="dot"></span> BNI 會員管理系統</div>
    <nav>${nav}</nav>
    <div class="user-card">
      <div class="avatar">${esc(initials(user.display_name))}</div>
      <div class="info">
        <div class="name">${esc(user.display_name)}</div>
        <div class="role">${ROLE_LABEL[user.role] || user.role}</div>
      </div>
      <form method="post" action="/logout"><button class="btn-logout" type="submit" title="登出">${ICONS.logout}</button></form>
    </div>
  </aside>
  <div class="main-col">
    <div class="topbar-mini">
      <div class="crumb">歡迎回來，<b>${esc(user.display_name)}</b></div>
      ${roleBadge}
    </div>
    <div class="container">
      ${flashHtml}
      ${body}
    </div>
  </div>
</div>
</body>
</html>`;
}

module.exports = { layout, initials };
