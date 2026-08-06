// views/members.js
'use strict';

const { esc, fmtDate } = require('../lib/util');
const { managementRoleLabel } = require('../lib/members-repo');

function checklist(name, items, selectedIds) {
  const sel = new Set((selectedIds || []).map(String));
  return `<div class="checkbox-list">${items
    .map(
      (it) =>
        `<label class="pill-check"><input type="checkbox" name="${name}" value="${it.id}" ${
          sel.has(String(it.id)) ? 'checked' : ''
        } /> ${esc(it.name)}</label>`
    )
    .join('')}</div>`;
}

function initials(name) {
  if (!name) return '?';
  return String(name).trim().slice(0, 1);
}

function helloCard({ user, summary }) {
  return `
  <div class="hello-card">
    <div class="top-row">
      <div class="greet">
        <div class="avatar-lg">${esc(initials(user.display_name))}</div>
        <div>
          <div class="sub">Hello ...</div>
          <h1>${esc(user.display_name)}</h1>
        </div>
      </div>
    </div>
    <div class="stat-pills">
      <div class="stat-pill"><div class="k">在籍會員</div><div class="v accent-teal">${summary.active}</div></div>
      <div class="stat-pill"><div class="k">已離會</div><div class="v">${summary.left}</div></div>
      <div class="stat-pill"><div class="k">分會數</div><div class="v accent-gold">${summary.chapters}</div></div>
      <div class="stat-pill"><div class="k">專業別種類</div><div class="v">${summary.professions}</div></div>
    </div>
  </div>`;
}

function membersPage({ members, chapters, professions, filters, canEdit, canImport, user, summary }) {
  const rows = members
    .map((m) => {
      const roleLabel = managementRoleLabel(m);
      const roleCls = m.account_role === 'executive' ? 'gold' : m.account_role === 'advisor' ? '' : 'muted';
      const statusTag =
        m.status === 'left'
          ? `<span class="tag danger">已離會${m.left_at ? ' ' + fmtDate(m.left_at) : ''}</span>`
          : `<span class="tag">在籍</span>`;
      return `<tr class="${m.status === 'left' ? 'status-left' : ''}">
        <td>${esc(m.name)}</td>
        <td>${esc(m.chapter_name)}</td>
        <td>${m.profession_name ? esc(m.profession_name) : '<span class="small">未設定</span>'}</td>
        <td><span class="tag ${roleCls}">${esc(roleLabel)}</span></td>
        <td>${statusTag}</td>
        <td>
          ${canEdit ? `<a class="btn btn-outline btn-sm" href="/members/${m.id}/edit">編輯</a> ` : ''}
          ${
            canEdit && m.status === 'active'
              ? `<form class="inline" method="post" action="/members/${m.id}/leave" onsubmit="return confirm('確定將「${esc(
                  m.name
                )}」設定為離會？');"><button class="btn btn-danger btn-sm" type="submit">離會</button></form>`
              : ''
          }
          ${
            canEdit && m.status === 'left'
              ? `<form class="inline" method="post" action="/members/${m.id}/rejoin"><button class="btn btn-outline btn-sm" type="submit">恢復在籍</button></form>`
              : ''
          }
        </td>
      </tr>`;
    })
    .join('');

  const q = filters.q || '';

  return `
  ${summary ? helloCard({ user, summary }) : ''}
  <div class="page-header">
    <div>
      <h1>會員資料</h1>
      <div class="sub">共 ${members.length} 筆資料${filters.showLeft ? '（含已離會）' : '（不含已離會）'}</div>
    </div>
    <div class="toolbar">
      ${canEdit ? `<a class="btn btn-primary" href="/members/new">+ 新增會員</a>` : ''}
      ${canImport ? `<a class="btn btn-gold" href="/members/import">匯入 Excel</a>` : ''}
    </div>
  </div>

  <form method="get" action="/members">
    <div class="filter-bar">
      <div class="filter-group" style="flex:1; min-width:260px;">
        <div class="title">搜尋姓名</div>
        <input type="text" name="q" value="${esc(q)}" placeholder="輸入會員姓名關鍵字" />
      </div>
      <div class="filter-group" style="flex:2;">
        <div class="title">依分會篩選</div>
        ${checklist('chapter', chapters, filters.chapterIds)}
      </div>
      <div class="filter-group" style="flex:2;">
        <div class="title">依專業別篩選</div>
        ${checklist('profession', professions, filters.professionIds)}
      </div>
      <div class="filter-group">
        <div class="title">顯示選項</div>
        <label class="pill-check"><input type="checkbox" name="show_left" value="1" ${
          filters.showLeft ? 'checked' : ''
        } /> 顯示已離會會員</label>
      </div>
    </div>
    <div class="toolbar">
      <button class="btn btn-primary" type="submit">套用篩選</button>
      <a class="btn btn-outline" href="/members">清除篩選</a>
    </div>
  </form>

  <div class="card">
    ${
      members.length === 0
        ? `<div class="empty-state">沒有符合條件的會員資料</div>`
        : `<table>
      <thead><tr><th>姓名</th><th>分會</th><th>專業別</th><th>目前管理職務</th><th>狀態</th><th>操作</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
    }
  </div>
  `;
}

function memberFormPage({ member, chapters, professions, error }) {
  const isEdit = !!member;
  return `
  <div class="breadcrumb"><a href="/members">會員資料</a> / ${isEdit ? '編輯會員' : '新增會員'}</div>
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
                `<option value="${c.id}" ${isEdit && member.chapter_id === c.id ? 'selected' : ''}>${esc(
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
      <a class="btn btn-outline" href="/members">取消</a>
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
