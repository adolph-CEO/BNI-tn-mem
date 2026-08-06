// views/org.js
'use strict';

const { esc, OFFICER_ROLES, OFFICER_ROLE_LABEL } = require('../lib/util');

function officerAssignForm(chapterId, role, roleLabel, chapterMembers, current) {
  const options = chapterMembers
    .map(
      (m) =>
        `<option value="${m.id}" ${current && current.member_id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`
    )
    .join('');
  return `
  <form method="post" action="/org/chapters/${chapterId}/officers" class="officer-row">
    <input type="hidden" name="role" value="${role}" />
    <span class="officer-label">${roleLabel}</span>
    <select name="member_id" style="width:auto;flex:1;">
      <option value="">（未指派）</option>
      ${options}
    </select>
    <button class="btn btn-outline btn-sm" type="submit">設定</button>
  </form>`;
}

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
          const memberRows = (ch.members || [])
            .map((m) => `<div class="tree-member">${esc(m.name)}</div>`)
            .join('');
          const officerSummary = OFFICER_ROLES.map((role) => {
            const o = ch.officers && ch.officers[role];
            return `<span class="tag muted">${OFFICER_ROLE_LABEL[role]}：${o ? esc(o.name) : '未指派'}</span>`;
          }).join('');
          const officerForms = OFFICER_ROLES.map((role) =>
            officerAssignForm(ch.id, role, OFFICER_ROLE_LABEL[role], ch.members || [], ch.officers && ch.officers[role])
          ).join('');
          return `
        <div class="tree-chapter" draggable="true" data-chapter-id="${ch.id}">
          <div class="tree-chapter-row">
            <span class="drag-handle" title="拖曳排序">⠿</span>
            <button type="button" class="tree-toggle" aria-expanded="false">▸</button>
            <span class="tree-chapter-name">${esc(ch.name)}</span>
            <span class="tree-advisors">董顧：${advisorTags || '<span class="small">尚未指派</span>'}</span>
            <span class="small tree-meta">${ch.advisors.length}/2 位董顧 · ${(ch.members || []).length} 位在籍會員</span>
          </div>
          <div class="tree-members" hidden>
            <div class="officer-summary">${officerSummary}</div>
            <div class="officer-forms">${officerForms}</div>
            <div class="tree-member-list-title small">在籍會員名單</div>
            ${memberRows || '<div class="small" style="padding:6px 0;">尚無在籍會員</div>'}
          </div>
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
        <p class="small mt-0">拖曳 ⠿ 可調整分會顯示順序；點選 ▸ 可展開／收合該分會的在籍會員清單。</p>
        <div class="tree" data-region-id="${region.id}">
          ${chapterBlocks || '<p class="small">尚未建立分會</p>'}
        </div>

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

  <script>
  (function () {
    // 展開／收合分會會員清單
    document.querySelectorAll('.tree-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var chapterEl = btn.closest('.tree-chapter');
        var membersEl = chapterEl.querySelector('.tree-members');
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.textContent = expanded ? '▸' : '▾';
        if (expanded) {
          membersEl.setAttribute('hidden', '');
        } else {
          membersEl.removeAttribute('hidden');
        }
      });
    });

    // 拖曳排序分會（同一區域內）
    function getDragAfterElement(container, y) {
      var items = Array.prototype.slice.call(container.querySelectorAll('.tree-chapter:not(.dragging)'));
      return items.reduce(
        function (closest, child) {
          var box = child.getBoundingClientRect();
          var offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
          }
          return closest;
        },
        { offset: -Infinity, element: null }
      ).element;
    }

    document.querySelectorAll('.tree').forEach(function (tree) {
      var regionId = tree.getAttribute('data-region-id');
      var dragEl = null;

      tree.querySelectorAll('.tree-chapter').forEach(function (item) {
        item.addEventListener('dragstart', function (e) {
          dragEl = item;
          item.classList.add('dragging');
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', function () {
          item.classList.remove('dragging');
          dragEl = null;
          var order = Array.prototype.map.call(tree.querySelectorAll('.tree-chapter'), function (el) {
            return el.getAttribute('data-chapter-id');
          });
          fetch('/org/chapters/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ region_id: regionId, order: order }),
          }).catch(function () {});
        });
      });

      tree.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (!dragEl) return;
        var after = getDragAfterElement(tree, e.clientY);
        if (after == null) {
          tree.appendChild(dragEl);
        } else {
          tree.insertBefore(dragEl, after);
        }
      });
    });
  })();
  </script>
  `;
}

module.exports = { orgPage };
