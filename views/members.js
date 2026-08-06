// views/members.js
'use strict';

const { esc, fmtDate, OFFICER_ROLES, OFFICER_ROLE_LABEL } = require('../lib/util');

function chapterNav(tree, selectedChapterId) {
  const blocks = tree
    .map((region) => {
      const items = region.chapters
        .map((ch) => {
          const active = ch.id === selectedChapterId;
          return `<a class="chapter-nav-item${active ? ' active' : ''}" href="/members?chapter=${ch.id}">
            <span>${esc(ch.name)}</span>
            <span class="cn-advisor">${ch.advisor_names ? esc(ch.advisor_names) : '未指派'}</span>
          </a>`;
        })
        .join('');
      return `
      <div>
        <div class="region-label">${esc(region.name)}</div>
        ${items}
      </div>`;
    })
    .join('');

  return `<div class="chapter-nav">${blocks || '<div class="empty-state small">尚無分會資料</div>'}</div>`;
}

function officerBar(selectedChapter, officers) {
  if (!selectedChapter) return '';
  const cells = OFFICER_ROLES.map((role) => {
    const o = officers[role];
    return `
    <div class="officer-item">
      ${OFFICER_ROLE_LABEL[role]}：<b>${o ? esc(o.name) : '未指派'}</b>
      ${o && o.profession_name ? `<span class="prof">（${esc(o.profession_name)}）</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="officer-bar">${cells}</div>`;
}

function memberTable(members, canEdit) {
  if (!members.length) {
    return `<div class="empty-state">此分會目前沒有在籍會員</div>`;
  }
  const rows = members
    .map(
      (m) => `<tr>
        <td>${esc(m.name)}</td>
        <td>${m.profession_name ? esc(m.profession_name) : '<span class="small">未設定</span>'}</td>
        <td>${
          m.tag_names
            ? m.tag_names
                .split('、')
                .map((t) => `<span class="tag muted">${esc(t)}</span>`)
                .join(' ')
            : '<span class="small">—</span>'
        }</td>
        <td>
          ${canEdit ? `<a class="btn btn-outline btn-sm" href="/members/${m.id}/edit">編輯</a> ` : ''}
          ${
            canEdit
              ? `<form class="inline" method="post" action="/members/${m.id}/leave" onsubmit="return confirm('確定將「${esc(
                  m.name
                )}」設定為離會？');"><button class="btn btn-danger btn-sm" type="submit">離會</button></form>`
              : ''
          }
        </td>
      </tr>`
    )
    .join('');

  return `<table>
    <thead><tr><th>會員姓名</th><th>專業別</th><th>行業標籤</th><th>操作</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function membersPage({ tree, selectedChapterId, selectedChapter, officers, members, canEdit, canImport }) {
  const nav = chapterNav(tree, selectedChapterId);

  const content = selectedChapter
    ? `
    <div class="page-header">
      <div>
        <h1>${esc(selectedChapter.name)}</h1>
        <div class="sub">在籍會員 ${members.length} 位</div>
      </div>
      <div class="toolbar">
        ${canEdit ? `<a class="btn btn-primary" href="/members/new?chapter=${selectedChapter.id}">+ 新增會員</a>` : ''}
        ${canImport ? `<a class="btn btn-gold" href="/members/import">匯入 Excel</a>` : ''}
      </div>
    </div>
    ${officerBar(selectedChapter, officers)}
    <div class="card">${memberTable(members, canEdit)}</div>
  `
    : `
    <div class="page-header"><h1>會員資料</h1></div>
    <div class="empty-state">請先在左側選擇一個分會</div>
  `;

  return `
  <div class="members-shell">
    <div>${nav}</div>
    <div>${content}</div>
  </div>
  `;
}

function memberFormPage({ member, chapters, professions, error, defaultChapterId }) {
  const isEdit = !!member;
  const selectedChapterId = isEdit ? member.chapter_id : defaultChapterId;
  const backHref = selectedChapterId ? `/members?chapter=${selectedChapterId}` : '/members';
  return `
  <div class="breadcrumb"><a href="${backHref}">會員資料</a> / ${isEdit ? '編輯會員' : '新增會員'}</div>
  <div class="page-header"><h1>${isEdit ? '編輯會員' : '新增會員'}</h1></div>
  ${error ? `<div class="alert alert-error">${esc(error)}</div>` : ''}
  <div class="card" style="max-width:520px;">
    <form method="post" action="${isEdit ? `/members/${member.id}` : '/members'}">
      <div class="form-row">
        <label>姓名</label>
        <input type="text" name="name" required value="${isEdit ? esc(member.name) : ''}" />
      </div>
      <div class="form-row">
        <label>所屬分會</label>
        <select name="chapter_id" required>
          <option value="">請選擇分會</option>
          ${chapters
            .map(
              (c) =>
                `<option value="${c.id}" ${String(selectedChapterId) === String(c.id) ? 'selected' : ''}>${esc(
                  c.name
                )}</option>`
            )
            .join('')}
        </select>
        <div class="hint">一個會員只會歸屬於一個分會。</div>
      </div>
      <div class="form-row">
        <label>專業別</label>
        <select name="profession_id">
          <option value="">未設定</option>
          ${professions
            .map(
              (p) =>
                `<option value="${p.id}" ${
                  isEdit && member.profession_id === p.id ? 'selected' : ''
                }>${esc(p.name)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="form-row">
        <label>備註</label>
        <textarea name="notes" rows="2">${isEdit ? esc(member.notes || '') : ''}</textarea>
      </div>
      <button class="btn btn-primary" type="submit">${isEdit ? '儲存變更' : '新增會員'}</button>
      <a class="btn btn-outline" href="${backHref}">取消</a>
    </form>
  </div>
  `;
}

function importPage({ result, error, chapters } = {}) {
  let resultHtml = '';
  if (result) {
    resultHtml = `
    <div class="alert ${result.errors.length ? 'alert-info' : 'alert-success'}">
      匯入完成：新增 ${result.created} 筆、更新 ${result.updated} 筆、略過/錯誤 ${result.errors.length} 筆。
    </div>
    ${
      result.errors.length
        ? `<div class="card"><h3 class="mt-0">未成功匯入的資料列</h3><table>
      <thead><tr><th>列號</th><th>原始資料</th><th>原因</th></tr></thead>
      <tbody>${result.errors
        .map(
          (e) =>
            `<tr><td>${e.row}</td><td>${esc(JSON.stringify(e.data))}</td><td>${esc(e.reason)}</td></tr>`
        )
        .join('')}</tbody>
      </table></div>`
        : ''
    }
    `;
  }

  return `
  <div class="breadcrumb"><a href="/members">會員資料</a> / 匯入 Excel</div>
  <div class="page-header"><h1>匯入會員 Excel</h1></div>
  ${error ? `<div class="alert alert-error">${esc(error)}</div>` : ''}
  ${resultHtml}
  <div class="two-col">
    <div class="card">
      <h2>上傳檔案</h2>
      <form method="post" action="/members/import" enctype="multipart/form-data">
        <div class="form-row">
          <label>Excel 檔案（.xlsx / .xls / .csv）</label>
          <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
        </div>
        <button class="btn btn-primary" type="submit">開始匯入</button>
      </form>
    </div>
    <div class="card">
      <h2>欄位格式說明</h2>
      <p class="small">Excel 第一列請放欄位標題，系統會自動辨識以下欄位名稱（大小寫不拘）：</p>
      <table>
        <thead><tr><th>欄位</th><th>可辨識標題</th><th>必填</th></tr></thead>
        <tbody>
          <tr><td>姓名</td><td>姓名 / 會員姓名 / Name</td><td>是</td></tr>
          <tr><td>分會</td><td>分會 / 所屬分會 / Chapter</td><td>是（需與現有分會名稱相符）</td></tr>
          <tr><td>專業別</td><td>專業別 / 專業 / Profession</td><td>否（若不存在會自動建立）</td></tr>
        </tbody>
      </table>
      <p class="small">同一分會內姓名相同者視為同一位會員，重複匯入將更新專業別。</p>
      <p class="small">目前系統中的分會：${chapters ? chapters.map((c) => esc(c.name)).join('、') : ''}</p>
    </div>
  </div>
  `;
}

module.exports = { membersPage, memberFormPage, importPage };
