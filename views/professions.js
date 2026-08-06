// views/professions.js
'use strict';

const { esc } = require('../lib/util');

function professionsPage({ byChapter, professions, tags, canManage }) {
  const chapterBlocks = byChapter
    .map(
      (ch) => `
    <div class="chapter-card">
      <div class="chapter-title">${esc(ch.name)} <span class="small">在籍會員 ${ch.total} 位</span></div>
      <div class="advisors">
        ${
          ch.professions.length
            ? ch.professions
                .map((p) => `<span class="tag">${esc(p.name)} × ${p.count}</span>`)
                .join('')
            : '<span class="small">尚無會員資料</span>'
        }
      </div>
    </div>`
    )
    .join('');

  const professionRows = professions
    .map((p) => {
      const tagIds = new Set((p.tag_ids || '').split(',').filter(Boolean));
      return `
      <tr>
        <td style="min-width:120px;">${esc(p.name)}</td>
        <td class="small">在籍會員 ${p.active_count} 位</td>
        <td>
          ${
            canManage
              ? `<form class="inline-tags" method="post" action="/professions/${p.id}/tags">
              <div class="checkbox-list">
                ${tags
                  .map(
                    (t) =>
                      `<label class="pill-check"><input type="checkbox" name="tag_id" value="${t.id}" ${
                        tagIds.has(String(t.id)) ? 'checked' : ''
                      } /> ${esc(t.name)}</label>`
                  )
                  .join('')}
              </div>
              <button class="btn btn-outline btn-sm" style="margin-top:8px;" type="submit">儲存行業標籤</button>
            </form>`
              : (p.tag_names || '未設定').split('、').map((n) => `<span class="tag gold">${esc(n)}</span>`).join('')
          }
        </td>
      </tr>`;
    })
    .join('');

  return `
  <div class="page-header">
    <div>
      <h1>專業別 / 行業標籤</h1>
      <div class="sub">列出所有會員的專業別，並可設定行業標籤歸屬</div>
    </div>
  </div>

  <div class="card">
    <h2>各分會專業別分佈</h2>
    ${chapterBlocks || '<div class="empty-state">尚無分會資料</div>'}
  </div>

  <div class="card">
    <h2>專業別清單與行業標籤設定</h2>
    <p class="small">一個專業別可以對應多個行業標籤，勾選後按「儲存行業標籤」即可更新。</p>
    <table>
      <thead><tr><th>專業別</th><th>會員數</th><th>行業標籤</th></tr></thead>
      <tbody>${professionRows}</tbody>
    </table>

    ${
      canManage
        ? `<h3>新增專業別</h3>
    <form method="post" action="/professions" class="toolbar">
      <input type="text" name="name" placeholder="輸入新的專業別名稱" required style="max-width:260px;" />
      <button class="btn btn-primary" type="submit">新增</button>
    </form>`
        : ''
    }
  </div>

  <div class="card">
    <h2>行業標籤管理</h2>
    <div>${
      tags.length
        ? tags
            .map(
              (t) => `<span class="tag gold">${esc(t.name)} <span class="small">(${t.usage_count})</span></span>`
            )
            .join('')
        : '<span class="small">尚未建立任何行業標籤</span>'
    }</div>
    ${
      canManage
        ? `<h3>新增行業標籤</h3>
    <form method="post" action="/industry-tags" class="toolbar">
      <input type="text" name="name" placeholder="輸入新的行業標籤名稱" required style="max-width:260px;" />
      <button class="btn btn-primary" type="submit">新增</button>
    </form>`
        : ''
    }
  </div>
  `;
}

module.exports = { professionsPage };
