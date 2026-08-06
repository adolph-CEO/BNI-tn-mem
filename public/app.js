// public/app.js — CRM 會員管理 單頁應用（無登入，前端 vanilla JS）
(function () {
  'use strict';

  const MEMBER_ROLES = ['主席', '副主席', '秘財'];

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let DATA = JSON.parse(document.getElementById('initial-data').textContent);

  const state = {
    view: 'dashboard',
    statusMode: 'active', // 'active' | 'all'
    filterIndustries: new Set(),
    filterChapters: new Set(),
    expandedChapters: new Set(),
    isEditingRegion: false,
    regionNameDraft: '',
    memberSearch: '',
    memberPage: 1,
    editingChapterId: null,
    chapterNameDraft: '',
    importMessage: '',
  };

  async function refreshData() {
    const res = await fetch('/api/data');
    DATA = await res.json();
  }

  // ---------- 衍生資料（比照參考檔案的 renderVals 邏輯） ----------
  function computeVals() {
    const industries = DATA.industries || [];
    const professions = DATA.professions || [];
    const chapters = DATA.chapters || [];
    const members = DATA.members || [];
    const region = DATA.region || { name: '' };

    const profMap = {}; professions.forEach((p) => { profMap[p.id] = p; });
    const indMap = {}; industries.forEach((i) => { indMap[i.id] = i; });
    const chMap = {}; chapters.forEach((c) => { chMap[c.id] = c; });
    const profToInd = {}; professions.forEach((p) => { profToInd[p.id] = p.industryId; });

    const passStatus = (m) => (state.statusMode === 'active' ? m.status === 'active' : true);
    const passChapter = (m) => !state.filterChapters.size || state.filterChapters.has(m.chapterId);
    const passIndustry = (m) => !state.filterIndustries.size || state.filterIndustries.has(profToInd[m.professionId]);

    const filtered = members.filter((m) => passStatus(m) && passChapter(m) && passIndustry(m));

    const kpiTotalMembers = filtered.length;
    const kpiChapterCount = chapters.length;
    const kpiIndustryCount = new Set(filtered.map((m) => profToInd[m.professionId]).filter((x) => x != null)).size;
    const rolesTotal = chapters.length * 3;
    const kpiRolesFilled = members.filter((m) => m.role).length;

    const execDirectors = members
      .filter((m) => m.execDirector)
      .map((m) => ({ name: m.name, chapterName: chMap[m.chapterId] ? chMap[m.chapterId].name : '' }));
    const execDirectorNames = execDirectors.map((e) => e.name).join('、') || '—';

    const chapterCounts = chapters.map((ch) => ({ id: ch.id, name: ch.name, count: filtered.filter((m) => m.chapterId === ch.id).length }));
    const maxChapterCount = Math.max(1, ...chapterCounts.map((c) => c.count));
    const chapterBars = chapterCounts.map((c) => ({ ...c, pct: Math.round((c.count / maxChapterCount) * 100) }));

    const professionCounts = professions.map((p) => ({
      id: p.id, name: p.name, industryName: indMap[p.industryId] ? indMap[p.industryId].name : '未分類',
      count: filtered.filter((m) => m.professionId === p.id).length,
    }));
    professionCounts.sort((a, b) => b.count - a.count);
    const maxProfCount = Math.max(1, ...professionCounts.map((c) => c.count));
    const professionBars = professionCounts.map((c) => ({ ...c, pct: Math.round((c.count / maxProfCount) * 100) }));

    const industryFilterRows = industries.map((ind) => ({
      id: ind.id, name: ind.name,
      count: members.filter((m) => passStatus(m) && passChapter(m) && profToInd[m.professionId] === ind.id).length,
      checked: state.filterIndustries.has(ind.id),
    }));
    const chapterFilterRows = chapters.map((ch) => ({
      id: ch.id, name: ch.name,
      count: members.filter((m) => passStatus(m) && passIndustry(m) && m.chapterId === ch.id).length,
      checked: state.filterChapters.has(ch.id),
    }));

    function roleHolders(chId) {
      const chMembers = members.filter((m) => m.chapterId === chId);
      return {
        chairman: chMembers.find((m) => m.role === '主席'),
        vice: chMembers.find((m) => m.role === '副主席'),
        secretary: chMembers.find((m) => m.role === '秘財'),
        active: chMembers.filter((m) => m.status === 'active').length,
        total: chMembers.length,
        chMembers,
      };
    }

    const rosterRows = chapters.map((ch) => {
      const r = roleHolders(ch.id);
      return {
        chapterName: ch.name,
        chairman: r.chairman ? r.chairman.name : '—',
        vice: r.vice ? r.vice.name : '—',
        secretary: r.secretary ? r.secretary.name : '—',
        activeTotal: `${r.active} / ${r.total}`,
      };
    });

    const treeChapters = chapters.map((ch) => {
      const r = roleHolders(ch.id);
      const expanded = state.expandedChapters.has(ch.id);
      return {
        id: ch.id, name: ch.name, total: r.total, active: r.active, inactive: r.total - r.active,
        chairman: r.chairman ? r.chairman.name : '—', vice: r.vice ? r.vice.name : '—', secretary: r.secretary ? r.secretary.name : '—',
        expanded, arrow: expanded ? '▾' : '▸',
      };
    });

    const searchLower = state.memberSearch.trim();
    const searched = searchLower ? filtered.filter((m) => m.name.includes(searchLower)) : filtered;
    const pageSize = 20;
    const memberTotalCount = searched.length;
    const memberTotalPages = Math.max(1, Math.ceil(memberTotalCount / pageSize));
    const page = Math.min(state.memberPage, memberTotalPages);
    const memberRows = searched.slice((page - 1) * pageSize, page * pageSize).map((m) => {
      const prof = profMap[m.professionId];
      const ind = prof ? indMap[prof.industryId] : null;
      return {
        id: m.id, name: m.name, chapterName: chMap[m.chapterId] ? chMap[m.chapterId].name : '',
        professionName: prof ? prof.name : '', industryName: ind ? ind.name : '未分類',
        roleLabel: m.execDirector ? `執董${m.role ? '／' + m.role : ''}` : (m.role || '一般會員'),
        status: m.status,
        statusLabel: m.status === 'active' ? '在會' : '離會',
        statusTagClass: m.status === 'active' ? 'tag tag-accent' : 'tag tag-neutral',
      };
    });

    const chapterCards = chapters.map((ch) => {
      const r = roleHolders(ch.id);
      const isEditing = state.editingChapterId === ch.id;
      return {
        id: ch.id, name: ch.name, isEditing,
        chairman: r.chairman, vice: r.vice, secretary: r.secretary,
        active: r.active, total: r.total, inactive: r.total - r.active,
        chMembers: r.chMembers,
      };
    });

    const filterSummary = [
      state.statusMode === 'active' ? '僅在會' : '含離會',
      state.filterIndustries.size ? `${state.filterIndustries.size} 個行業別` : null,
      state.filterChapters.size ? `${state.filterChapters.size} 個分會` : null,
    ].filter(Boolean).join(' · ');

    return {
      region, industries, professions, chapters, members, chMap,
      isDashboard: state.view === 'dashboard', isMembers: state.view === 'members', isChapters: state.view === 'chapters',
      showSidebar: state.view === 'dashboard' || state.view === 'members',
      filterSummary, kpiTotalMembers, kpiChapterCount, kpiIndustryCount, kpiRolesFilled, kpiRolesTotal: rolesTotal,
      execDirectors, execDirectorNames,
      chapterBars, professionBars, industryFilterRows, chapterFilterRows, rosterRows, treeChapters,
      memberRows, memberTotalCount, memberPage: page, memberTotalPages,
      isFirstPage: page <= 1, isLastPage: page >= memberTotalPages,
      chapterCards,
    };
  }

  // ---------- 渲染 ----------
  function renderNav(v) {
    const dot = (view) => (state.view === view ? ' aria-current="page"' : '');
    document.getElementById('nav').innerHTML = `
      <div class="nav-brand">CRM 會員管理</div>
      ${state.isEditingRegion
        ? `<input class="input" style="width:140px" id="region-input" value="${esc(state.regionNameDraft)}">
           <button class="btn btn-primary" style="font-size:12px" data-action="region-save">儲存</button>`
        : `<span class="tag tag-outline">${esc(v.region.name)}</span>
           <button class="btn btn-ghost" style="font-size:12px" data-action="region-edit-start">重新命名</button>`
      }
      <a href="#" data-action="goto" data-view="dashboard"${dot('dashboard')} style="margin-left:24px">儀表板</a>
      <a href="#" data-action="goto" data-view="members"${dot('members')}>會員列表</a>
      <a href="#" data-action="goto" data-view="chapters"${dot('chapters')}>分會管理</a>
    `;
    const input = document.getElementById('region-input');
    if (input) {
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }

  function renderSidebar(v) {
    const el = document.getElementById('sidebar');
    if (!v.showSidebar) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = `
      <div style="margin-bottom:24px">
        <h6 style="margin-bottom:10px">會員狀態</h6>
        <div class="seg" style="width:100%">
          <label class="seg-opt" style="flex:1;justify-content:center">
            <input type="radio" name="statusMode" data-action="set-status" value="active" ${state.statusMode === 'active' ? 'checked' : ''}>僅在會
          </label>
          <label class="seg-opt" style="flex:1;justify-content:center">
            <input type="radio" name="statusMode" data-action="set-status" value="all" ${state.statusMode === 'all' ? 'checked' : ''}>含離會
          </label>
        </div>
      </div>
      <div style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
          <h6 style="margin:0">行業別</h6>
          <button class="btn btn-ghost" style="font-size:11px;padding:2px 6px" data-action="clear-industry-filter">清除</button>
        </div>
        ${v.industryFilterRows.map((row) => `
          <label style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;cursor:pointer;font-size:13px">
            <span style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" data-action="toggle-industry" data-id="${row.id}" ${row.checked ? 'checked' : ''}>
              ${esc(row.name)}
            </span>
            <span class="tag tag-neutral">${row.count}</span>
          </label>`).join('')}
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
          <h6 style="margin:0">分會</h6>
          <button class="btn btn-ghost" style="font-size:11px;padding:2px 6px" data-action="clear-chapter-filter">清除</button>
        </div>
        ${v.chapterFilterRows.map((row) => `
          <label style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;cursor:pointer;font-size:13px">
            <span style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" data-action="toggle-chapter" data-id="${row.id}" ${row.checked ? 'checked' : ''}>
              ${esc(row.name)}
            </span>
            <span class="tag tag-neutral">${row.count}</span>
          </label>`).join('')}
      </div>
    `;
  }

  function corners() {
    return `<i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>`;
  }

  function renderDashboard(v) {
    return `
    <div style="display:flex;flex-direction:column;gap:20px">
      <div>
        <h2 style="margin:0 0 4px">儀表板總覽</h2>
        <p class="text-muted" style="margin:0">篩選條件：${esc(v.filterSummary)}</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
        <div class="card blueprint elev-sm">${corners()}
          <div class="card-kicker">總會員數</div>
          <div style="font-family:var(--font-heading);font-size:40px;font-weight:600">${v.kpiTotalMembers}</div>
          <div class="card-meta">${state.statusMode === 'active' ? '僅計算在會會員' : '含在會與離會'}</div>
        </div>
        <div class="card blueprint elev-sm">${corners()}
          <div class="card-kicker">分會數量</div>
          <div style="font-family:var(--font-heading);font-size:40px;font-weight:600">${v.kpiChapterCount}</div>
          <div class="card-meta">個分會</div>
        </div>
        <div class="card blueprint elev-sm">${corners()}
          <div class="card-kicker">涵蓋行業別</div>
          <div style="font-family:var(--font-heading);font-size:40px;font-weight:600">${v.kpiIndustryCount} / ${v.industries.length}</div>
          <div class="card-meta">目前篩選範圍內</div>
        </div>
        <div class="card blueprint elev-sm">${corners()}
          <div class="card-kicker">領導職務就位</div>
          <div style="font-family:var(--font-heading);font-size:40px;font-weight:600">${v.kpiRolesFilled} / ${v.kpiRolesTotal}</div>
          <div class="card-meta">主席／副主席／秘財</div>
        </div>
      </div>

      <div class="card blueprint elev-sm">${corners()}
        <div class="card-kicker">執行董事（執董）</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${v.execDirectors.map((ed) => `<span class="tag tag-accent">${esc(ed.name)} · ${esc(ed.chapterName)}</span>`).join('') || '<span class="text-muted" style="font-size:13px">尚未指派</span>'}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px;align-items:start">
        <div class="card blueprint elev-sm">${corners()}
          <div class="card-kicker">各分會人數比較</div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
            ${v.chapterBars.map((bar) => `
              <div style="display:grid;grid-template-columns:90px 1fr 36px;gap:10px;align-items:center;font-size:12px">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(bar.name)}</span>
                <div style="height:14px;background:var(--color-neutral-200)">
                  <div style="height:100%;background:var(--color-accent);width:${bar.pct}%"></div>
                </div>
                <span style="text-align:right">${bar.count}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="card blueprint elev-sm" style="max-height:440px;overflow:auto">${corners()}
          <div class="card-kicker">專業別分布</div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
            ${v.professionBars.map((bar) => `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
                  <span>${esc(bar.name)} <span class="text-muted">${esc(bar.industryName)}</span></span>
                  <span>${bar.count}</span>
                </div>
                <div style="height:8px;background:var(--color-neutral-200)">
                  <div style="height:100%;background:var(--color-accent-2-600);width:${bar.pct}%"></div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card blueprint elev-sm">${corners()}
        <div class="card-kicker">主席／副主席／秘財名冊總覽</div>
        <table class="table" style="margin-top:6px">
          <thead><tr><th>分會</th><th>主席</th><th>副主席</th><th>秘財</th><th>在會 / 總人數</th></tr></thead>
          <tbody>
            ${v.rosterRows.map((row) => `
              <tr>
                <td>${esc(row.chapterName)}</td><td>${esc(row.chairman)}</td><td>${esc(row.vice)}</td>
                <td>${esc(row.secretary)}</td><td>${esc(row.activeTotal)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="card blueprint elev-sm">${corners()}
        <div class="card-kicker">組織層級</div>
        <div style="margin-top:6px">
          <div style="font-family:var(--font-heading);font-weight:600;font-size:16px;padding:6px 0">
            ${esc(v.region.name)}（區域） — 執董：${esc(v.execDirectorNames)}
          </div>
          <div style="padding-left:16px;border-left:1px solid var(--color-divider);display:flex;flex-direction:column;gap:2px">
            ${v.treeChapters.map((node) => `
              <div>
                <div style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer" data-action="toggle-chapter-expand" data-id="${node.id}">
                  <span style="width:14px;text-align:center">${node.arrow}</span>
                  <span style="font-family:var(--font-heading);font-weight:600">${esc(node.name)}（分會）</span>
                  <span class="tag tag-neutral">${node.total} 人</span>
                </div>
                ${node.expanded ? `
                  <div style="padding:2px 0 12px 22px;font-size:13px;display:flex;flex-direction:column;gap:4px">
                    <div>主席：${esc(node.chairman)}　副主席：${esc(node.vice)}　秘財：${esc(node.secretary)}</div>
                    <div class="text-muted">在會 ${node.active} ／ 離會 ${node.inactive}</div>
                    <a href="#" data-action="view-chapter-members" data-id="${node.id}">查看會員列表 →</a>
                  </div>` : ''}
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderMembers(v) {
    return `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 style="margin:0">會員列表</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-secondary" data-action="add-member">+ 新增會員</button>
          <input class="input" style="width:220px" placeholder="搜尋姓名" id="member-search" value="${esc(state.memberSearch)}">
          <button class="btn btn-secondary" data-action="trigger-import">匯入 CSV</button>
          <input type="file" accept=".csv" id="file-input" style="display:none">
        </div>
      </div>
      ${state.importMessage ? `<div class="tag tag-accent" style="width:fit-content">${esc(state.importMessage)}</div>` : ''}
      <p class="text-muted" style="margin:0;font-size:12px">支援 CSV（可由 Excel 另存新檔為 CSV 後上傳）。欄位順序：姓名, 分會, 專業別, 狀態</p>

      <div class="card blueprint elev-sm" style="padding:0">${corners()}
        <table class="table">
          <thead><tr><th>姓名</th><th>分會</th><th>專業別</th><th>行業別</th><th>職務</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>
            ${v.memberRows.map((m) => `
              <tr>
                <td>${esc(m.name)}</td><td>${esc(m.chapterName)}</td><td>${esc(m.professionName)}</td>
                <td>${esc(m.industryName)}</td><td>${esc(m.roleLabel)}</td>
                <td><span class="${m.statusTagClass}">${esc(m.statusLabel)}</span></td>
                <td>${m.status === 'active'
                  ? `<button class="btn btn-ghost" style="font-size:11px;padding:2px 6px" data-action="member-leave" data-id="${m.id}">設為離會</button>`
                  : `<button class="btn btn-ghost" style="font-size:11px;padding:2px 6px" data-action="member-rejoin" data-id="${m.id}">恢復在會</button>`}</td>
              </tr>`).join('') || `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:24px">沒有符合條件的會員</td></tr>`}
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="text-muted" style="font-size:13px">共 ${v.memberTotalCount} 筆，第 ${v.memberPage} / ${v.memberTotalPages} 頁</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" data-action="prev-page" ${v.isFirstPage ? 'disabled' : ''}>上一頁</button>
          <button class="btn btn-secondary" data-action="next-page" ${v.isLastPage ? 'disabled' : ''}>下一頁</button>
        </div>
      </div>
    </div>`;
  }

  function roleAssignRow(chapterId, role, current, chMembers) {
    const activeMembers = chMembers.filter((m) => m.status === 'active');
    const options = activeMembers.map((m) => `<option value="${m.id}" ${current && current.id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    return `
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;font-weight:700;color:color-mix(in srgb, var(--color-text) 70%, transparent);width:52px;flex-shrink:0">${role}</span>
        <select class="input" style="font-size:12.5px;padding:5px 8px" data-action="assign-role" data-chapter="${chapterId}" data-role="${role}">
          <option value="">（未指派）</option>
          ${options}
        </select>
      </div>`;
  }

  function renderChapters(v) {
    return `
    <div style="display:flex;flex-direction:column;gap:16px">
      <h2 style="margin:0">分會管理</h2>
      <p class="text-muted" style="margin:0">共 ${v.chapters.length} 個分會</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${v.chapterCards.map((c) => `
          <div class="card blueprint elev-sm">${corners()}
            ${c.isEditing
              ? `<input class="input" id="chapter-input-${c.id}" value="${esc(state.chapterNameDraft)}">`
              : `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                   <div class="card-title">${esc(c.name)}</div>
                   <button class="btn btn-ghost" style="font-size:11px;padding:2px 6px" data-action="chapter-edit-start" data-id="${c.id}" data-name="${esc(c.name)}">重新命名</button>
                 </div>`}
            <div class="card-body">
              主席：${c.chairman ? esc(c.chairman.name) : '—'}<br>
              副主席：${c.vice ? esc(c.vice.name) : '—'}<br>
              秘財：${c.secretary ? esc(c.secretary.name) : '—'}
            </div>
            <div class="card-meta">在會 ${c.active} ／ 總計 ${c.total}（含離會 ${c.inactive}）</div>
            <details>
              <summary class="btn btn-ghost" style="font-size:11px;padding:2px 6px;display:inline-flex;width:fit-content">指派職務</summary>
              <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
                ${roleAssignRow(c.id, '主席', c.chairman, c.chMembers)}
                ${roleAssignRow(c.id, '副主席', c.vice, c.chMembers)}
                ${roleAssignRow(c.id, '秘財', c.secretary, c.chMembers)}
              </div>
            </details>
            <a href="#" data-action="view-chapter-members" data-id="${c.id}" class="btn btn-ghost" style="align-self:flex-start;padding-inline:0">查看會員 →</a>
          </div>`).join('')}
      </div>
    </div>`;
  }

  function render() {
    const v = computeVals();
    renderNav(v);
    renderSidebar(v);
    const main = document.getElementById('main');
    if (v.isDashboard) main.innerHTML = renderDashboard(v);
    else if (v.isMembers) main.innerHTML = renderMembers(v);
    else main.innerHTML = renderChapters(v);
  }

  // ---------- 事件處理（事件委派，畫面每次都會整段重建） ----------
  async function handleClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'goto') {
      e.preventDefault();
      state.view = el.dataset.view;
      return render();
    }
    if (action === 'region-edit-start') {
      state.isEditingRegion = true;
      state.regionNameDraft = DATA.region.name;
      return render();
    }
    if (action === 'region-save') {
      const val = (document.getElementById('region-input') || {}).value || '';
      const name = val.trim();
      if (name) {
        await fetch('/api/region', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=' + encodeURIComponent(name) });
        await refreshData();
      }
      state.isEditingRegion = false;
      return render();
    }
    if (action === 'clear-industry-filter') { state.filterIndustries.clear(); return render(); }
    if (action === 'clear-chapter-filter') { state.filterChapters.clear(); return render(); }
    if (action === 'toggle-chapter-expand') {
      const id = Number(el.dataset.id);
      if (state.expandedChapters.has(id)) state.expandedChapters.delete(id); else state.expandedChapters.add(id);
      return render();
    }
    if (action === 'view-chapter-members') {
      e.preventDefault();
      const id = Number(el.dataset.id);
      state.view = 'members';
      state.filterChapters = new Set([id]);
      state.memberPage = 1;
      return render();
    }
    if (action === 'trigger-import') {
      document.getElementById('file-input').click();
      return;
    }
    if (action === 'add-member') {
      const chapters = DATA.chapters;
      const name = prompt('會員姓名？');
      if (!name || !name.trim()) return;
      const chapterNames = chapters.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      const pick = prompt('所屬分會（輸入編號）：\n' + chapterNames);
      const idx = Number(pick) - 1;
      if (!chapters[idx]) { alert('未選擇有效分會，已取消'); return; }
      await fetch('/api/members', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'name=' + encodeURIComponent(name.trim()) + '&chapterId=' + chapters[idx].id,
      });
      await refreshData();
      return render();
    }
    if (action === 'member-leave' || action === 'member-rejoin') {
      const id = Number(el.dataset.id);
      const status = action === 'member-leave' ? 'left' : 'active';
      await fetch(`/api/members/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'status=' + status });
      await refreshData();
      return render();
    }
    if (action === 'prev-page') { state.memberPage = Math.max(1, state.memberPage - 1); return render(); }
    if (action === 'next-page') { state.memberPage = state.memberPage + 1; return render(); }
    if (action === 'chapter-edit-start') {
      state.editingChapterId = Number(el.dataset.id);
      state.chapterNameDraft = el.dataset.name;
      render();
      const input = document.getElementById('chapter-input-' + state.editingChapterId);
      if (input) { input.focus(); input.select(); }
      return;
    }
  }

  async function saveChapterName() {
    if (state.editingChapterId == null) return;
    const input = document.getElementById('chapter-input-' + state.editingChapterId);
    const name = input ? input.value.trim() : '';
    if (name) {
      await fetch(`/api/chapters/${state.editingChapterId}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=' + encodeURIComponent(name) });
      await refreshData();
    }
    state.editingChapterId = null;
    render();
  }

  async function handleChange(e) {
    if (e.target.id === 'file-input') {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/members/import', { method: 'POST', body: form });
      const result = await res.json();
      state.importMessage = result.error ? result.error : `已匯入 ${result.added} 筆會員資料${result.errors ? '，' + result.errors + ' 筆略過' : ''}`;
      await refreshData();
      e.target.value = '';
      return render();
    }
    if (e.target.dataset && e.target.dataset.action === 'set-status') {
      state.statusMode = e.target.value;
      return render();
    }
    if (e.target.dataset && e.target.dataset.action === 'toggle-industry') {
      const id = Number(e.target.dataset.id);
      if (state.filterIndustries.has(id)) state.filterIndustries.delete(id); else state.filterIndustries.add(id);
      state.memberPage = 1;
      return render();
    }
    if (e.target.dataset && e.target.dataset.action === 'toggle-chapter') {
      const id = Number(e.target.dataset.id);
      if (state.filterChapters.has(id)) state.filterChapters.delete(id); else state.filterChapters.add(id);
      state.memberPage = 1;
      return render();
    }
    if (e.target.dataset && e.target.dataset.action === 'assign-role') {
      const chapterId = Number(e.target.dataset.chapter);
      const role = e.target.dataset.role;
      const memberId = e.target.value;
      // 先清空同分會同職務的舊持有人，再指派給新選的會員（role 欄位在後端是單一值，直接覆蓋即可）
      if (memberId) {
        await fetch(`/api/members/${memberId}/role`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'role=' + encodeURIComponent(role) });
      } else {
        const chMembers = DATA.members.filter((m) => m.chapterId === chapterId && m.role === role);
        for (const m of chMembers) {
          await fetch(`/api/members/${m.id}/role`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'role=' });
        }
      }
      await refreshData();
      return render();
    }
  }

  function handleKeydown(e) {
    if (e.target.id === 'region-input') {
      if (e.key === 'Enter') document.querySelector('[data-action="region-save"]').click();
      if (e.key === 'Escape') { state.isEditingRegion = false; render(); }
    }
    if (e.target.id && e.target.id.startsWith('chapter-input-')) {
      if (e.key === 'Enter') saveChapterName();
      if (e.key === 'Escape') { state.editingChapterId = null; render(); }
    }
  }

  function handleBlur(e) {
    if (e.target.id && e.target.id.startsWith('chapter-input-')) {
      // 延遲一點，避免點擊同一張卡片內其他按鈕時搶先把輸入框收掉
      setTimeout(saveChapterName, 120);
    }
  }

  let searchDebounce = null;
  function handleInput(e) {
    if (e.target.id === 'member-search') {
      state.memberSearch = e.target.value;
      state.memberPage = 1;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        const main = document.getElementById('main');
        main.innerHTML = renderMembers(computeVals());
      }, 150);
    }
  }

  document.getElementById('app').addEventListener('click', handleClick);
  document.getElementById('app').addEventListener('change', handleChange);
  document.getElementById('app').addEventListener('keydown', handleKeydown);
  document.getElementById('app').addEventListener('blur', handleBlur, true);
  document.getElementById('app').addEventListener('input', handleInput);

  render();
})();
