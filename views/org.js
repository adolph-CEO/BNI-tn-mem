// views/org.js
'use strict';

const { esc } = require('../lib/util');

function memberOptions(members, selectedId) {
  const byChapter = new Map();
  members.forEach((m) => {
    if (!byChapter.has(m.chapter_name)) byChapter.set(m.chapter_name, []);
    byChapter.get(m.chapter_name).push(m);
  });
  let html = `<option value="">不連結會員資料</option>`;
  for (const [chapterName, list] of byChapter) {
    html += `<optgroup label="${esc(chapterName)}">`;
    html += list
      .map(
        (m) =>
          `<option value="${m.id}" ${String(selectedId) === String(m.id) ? 'selected' : ''}>${esc(m.name)}</option>`
      )
      .join('');
    html += `</optgroup>`;
  }
  return html;
}

function accountToggleForm(u) {
  return `<form class="inline" method="post" action="/org/users/${u.id}/toggle" onsubmit="return confirm('確定要${
    u.active ? '停用' : '啟用'
  }此帳號？');">
    <button class="btn btn-sm ${u.active ? 'btn-danger' : 'btn-outline'}" type="submit">${
    u.active ? '停用' : '啟用'
  }</button>
  </form>`;
}

function orgPage({ user, regions, allMembers, isAdmin }) {
  const regionBlocks = regions
    .map((region) => {
      const execRows = region.executives
        .map(
          (e) => `<tr>
        <td>${esc(e.display_name)}</td>
        <td>${esc(e.username)}</td>
        <td>${e.active ? '<span class="tag">啟用中</span>' : '<span class="tag danger">已停用</span>'}</td>
        <td>${accountToggleForm(e)}</td>
      </tr>`
        )
        .join('');

      const chapterBlocks = region.chapters
        .map((ch) => {
          const advisorTags = ch.advisors
            .map(
              (a) =>
                `<span class="tag ${a.active ? '' : 'muted'}">${esc(a.display_name)}${
                  a.active ? '' : '（停用）'
                } ${accountToggleForm(a)}</span>`
            )
            .join(' ');
          return `
        <div class="chapter-card">
          <div class="chapter-title">${esc(ch.name)}<span class="small">${ch.advisors.length}/2 位董顧</span></div>
          <div class="advisors">${advisorTags || '<span class="small">尚未指派董顧</span>'}</div>
        </div>`;
        })
        .join('');

      return `
      <div class="card">
        <h2>區域：${esc(region.name)}</h2>

        <h3>執行董事（執董）</h3>
        ${
          region.executives.length
            ? `<table><thead><tr><th>姓名</th><th>帳號</th><th>狀態</th><th>操作</th></tr></thead><tbody>${execRows}</tbody></table>`
            : '<p class="small">尚未設定執行董事</p>'
        }
        ${
          isAdmin
            ? `<details style="margin-top:10px;">
          <summary class="small" style="cursor:pointer;color:var(--teal-dark);font-weight:600;">+ 新增執行董事帳號</summary>
          <form method="post" action="/org/executives" style="margin-top:10px;max-width:420px;">
            <input type="hidden" name="region_id" value="${region.id}" />
            <div class="form-row"><label>姓名</label><input type="text" name="display_name" required /></div>
            <div class="form-row"><label>帳號</label><input type="text" name="username" required /></div>
            <div class="form-row"><label>密碼</label><input type="password" name="password" required /></div>
            <div class="form-row"><label>連結會員資料（選填）</label>
              <select name="member_id">${memberOptions(allMembers)}</select>
            </div>
            <button class="btn btn-primary btn-sm" type="submit">建立帳號</button>
          </form>
        </details>`
            : ''
        }

        <h3>分會與董事顧問（董顧）</h3>
        ${chapterBlocks || '<p class="small">尚未建立分會</p>'}

        <details style="margin-top:10px;">
          <summary class="small" style="cursor:pointer;color:var(--teal-dark);font-weight:600;">+ 新增分會</summary>
          <form method="post" action="/org/chapters" style="margin-top:10px;max-width:420px;">
            <input type="hidden" name="region_id" value="${region.id}" />
            <div class="form-row"><label>分會名稱</label><input type="text" name="name" required /></div>
            <button class="btn btn-primary btn-sm" type="submit">建立分會</button>
          </form>
        </details>

        <details style="margin-top:10px;">
          <summary class="small" style="cursor:pointer;color:var(--teal-dark);font-weight:600;">+ 新增董事顧問帳號並指派分會</summary>
          <form method="post" action="/org/advisors" style="margin-top:10px;max-width:480px;">
            <div class="form-row"><label>姓名</label><input type="text" name="display_name" required /></div>
            <div class="form-row"><label>帳號</label><input type="text" name="username" required /></div>
            <div class="form-row"><label>密碼</label><input type="password" name="password" required /></div>
            <div class="form-row"><label>連結會員資料（選填，此董顧本身所屬分會的會員身分）</label>
              <select name="member_id">${memberOptions(allMembers)}</select>
            </div>
            <div class="form-row">
              <label>負責管理的分會（可複選，建議 1~2 個）</label>
              <div class="checkbox-list">
                ${region.chapters
                  .map(
                    (ch) =>
                      `<label class="pill-check"><input type="checkbox" name="chapter_id" value="${ch.id}" /> ${esc(
                        ch.name
                      )}</label>`
                  )
                  .join('')}
              </div>
            </div>
            <button class="btn btn-primary btn-sm" type="submit">建立董顧帳號</button>
          </form>
        </details>
      </div>`;
    })
    .join('');

  return `
  <div class="page-header">
    <div>
      <h1>職務設定</h1>
      <div class="sub">設定區域、分會、執行董事與董事顧問帳號</div>
    </div>
  </div>

  ${
    isAdmin
      ? `<div class="card">
    <h2>新增區域</h2>
    <form method="post" action="/org/regions" class="toolbar">
      <input type="text" name="name" placeholder="輸入區域名稱" required style="max-width:260px;" />
      <button class="btn btn-primary" type="submit">建立區域</button>
    </form>
  </div>`
      : ''
  }

  ${regionBlocks || '<div class="empty-state">尚無區域資料</div>'}
  `;
}

module.exports = { orgPage };
