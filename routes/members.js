// routes/members.js
'use strict';

const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const router = express.Router();

const db = require('../lib/db');
const { requireAuth, requireRole } = require('../lib/auth');
const { chapterIdsForUser, canAccessChapter } = require('../lib/scope');
const { listMembers, getChapterOfficers } = require('../lib/members-repo');
const { layout } = require('../views/layout');
const { membersPage, memberFormPage, importPage } = require('../views/members');
const { ah } = require('../lib/async-handler');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function accessibleChapters(scopeChapterIds) {
  if (!scopeChapterIds.length) return [];
  return db.all(
    `SELECT id, name, region_id FROM chapters WHERE id IN (${scopeChapterIds.map(() => '?').join(',')}) ORDER BY sort_order NULLS LAST, name`,
    scopeChapterIds
  );
}

// 建立左側「區域 > 分會」樹狀導覽資料，僅包含使用者權限範圍內的分會
async function buildChapterTree(user, scopeChapterIds) {
  if (!scopeChapterIds.length) return [];

  let regionRows;
  if (user.role === 'admin') {
    regionRows = await db.all('SELECT * FROM regions ORDER BY id');
  } else if (user.role === 'executive') {
    regionRows = await db.all('SELECT * FROM regions WHERE id = ?', [user.region_id]);
  } else {
    regionRows = await db.all(
      `SELECT DISTINCT r.* FROM regions r
       JOIN chapters c ON c.region_id = r.id
       WHERE c.id IN (${scopeChapterIds.map(() => '?').join(',')})
       ORDER BY r.id`,
      scopeChapterIds
    );
  }

  const tree = [];
  for (const region of regionRows) {
    const chapters = await db.all(
      `SELECT c.*,
        (SELECT STRING_AGG(u.display_name, '、') FROM chapter_advisors ca JOIN users u ON u.id = ca.user_id WHERE ca.chapter_id = c.id) AS advisor_names
       FROM chapters c
       WHERE c.region_id = ? AND c.id IN (${scopeChapterIds.map(() => '?').join(',')})
       ORDER BY c.sort_order NULLS LAST, c.name`,
      [region.id, ...scopeChapterIds]
    );
    if (chapters.length) {
      tree.push({ ...region, chapters });
    }
  }
  return tree;
}

// ---------- 主頁：區域/分會樹狀導覽 + 選定分會明細 ----------

router.get(
  '/members',
  requireAuth,
  ah(async (req, res) => {
    const scopeChapterIds = await chapterIdsForUser(req.user);
    const tree = await buildChapterTree(req.user, scopeChapterIds);
    const allChapters = tree.flatMap((r) => r.chapters);
    const allChapterIds = allChapters.map((c) => c.id);

    let selectedChapterId = req.query.chapter ? Number(req.query.chapter) : null;
    if (!selectedChapterId || !allChapterIds.includes(selectedChapterId)) {
      selectedChapterId = allChapterIds[0] || null;
    }

    let selectedChapter = null;
    let officers = {};
    let members = [];
    if (selectedChapterId) {
      selectedChapter = allChapters.find((c) => c.id === selectedChapterId) || null;
      officers = await getChapterOfficers(selectedChapterId);
      members = await listMembers({
        chapterIds: [selectedChapterId],
        scopeChapterIds,
        showLeft: false,
      });
    }

    const canEdit = ['admin', 'executive', 'advisor'].includes(req.user.role);
    const canImport = ['admin', 'executive'].includes(req.user.role);

    res.send(
      layout({
        title: '會員資料 — BNI 會員管理系統',
        user: req.user,
        path: '/members',
        body: membersPage({
          tree,
          selectedChapterId,
          selectedChapter,
          officers,
          members,
          canEdit,
          canImport,
        }),
      })
    );
  })
);

// ---------- 新增（注意：/members/new 與 /members/import 必須定義在 /members/:id 系列路由之前，避免被誤判為 :id） ----------

router.get(
  '/members/new',
  requireAuth,
  ah(async (req, res) => {
    const scopeChapterIds = await chapterIdsForUser(req.user);
    const chapters = await accessibleChapters(scopeChapterIds);
    const professions = await db.all('SELECT id, name FROM professions ORDER BY name');
    const defaultChapterId = req.query.chapter ? Number(req.query.chapter) : null;
    res.send(
      layout({
        title: '新增會員',
        user: req.user,
        path: '/members',
        body: memberFormPage({ member: null, chapters, professions, defaultChapterId }),
      })
    );
  })
);

router.post(
  '/members',
  requireAuth,
  ah(async (req, res) => {
    const { name, chapter_id, profession_id, notes } = req.body;
    if (!name || !chapter_id) {
      return res.status(400).send('姓名與分會為必填');
    }
    if (!(await canAccessChapter(req.user, chapter_id))) {
      return res.status(403).send('權限不足：您無法在此分會新增會員。');
    }
    await db.run(`INSERT INTO members (chapter_id, name, profession_id, notes) VALUES (?, ?, ?, ?)`, [
      Number(chapter_id),
      String(name).trim(),
      profession_id ? Number(profession_id) : null,
      notes || null,
    ]);
    res.redirect(`/members?chapter=${Number(chapter_id)}`);
  })
);

// ---------- Excel 匯入 ----------

router.get(
  '/members/import',
  requireAuth,
  requireRole('admin', 'executive'),
  ah(async (req, res) => {
    const scopeChapterIds = await chapterIdsForUser(req.user);
    const chapters = await accessibleChapters(scopeChapterIds);
    res.send(
      layout({
        title: '匯入會員 Excel',
        user: req.user,
        path: '/members',
        body: importPage({ chapters }),
      })
    );
  })
);

const HEADER_MAP = {
  name: ['姓名', '會員姓名', 'name', 'Name'],
  chapter: ['分會', '所屬分會', 'chapter', 'Chapter'],
  profession: ['專業別', '專業', 'profession', 'Profession'],
};

function normalizeHeader(h) {
  return String(h || '').trim();
}

function buildColumnIndex(headerRow) {
  const idx = {};
  headerRow.forEach((raw, i) => {
    const h = normalizeHeader(raw);
    for (const key of Object.keys(HEADER_MAP)) {
      if (HEADER_MAP[key].some((cand) => cand.toLowerCase() === h.toLowerCase())) {
        idx[key] = i;
      }
    }
  });
  return idx;
}

router.post(
  '/members/import',
  requireAuth,
  requireRole('admin', 'executive'),
  upload.single('file'),
  ah(async (req, res) => {
    const scopeChapterIds = await chapterIdsForUser(req.user);
    const chaptersForView = await accessibleChapters(scopeChapterIds);

    if (!req.file) {
      return res.send(
        layout({
          title: '匯入會員 Excel',
          user: req.user,
          path: '/members',
          body: importPage({ error: '請選擇要上傳的檔案。', chapters: chaptersForView }),
        })
      );
    }

    let rows;
    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    } catch (e) {
      return res.send(
        layout({
          title: '匯入會員 Excel',
          user: req.user,
          path: '/members',
          body: importPage({ error: '無法解析檔案，請確認為有效的 Excel/CSV 檔案。', chapters: chaptersForView }),
        })
      );
    }

    if (!rows || rows.length < 2) {
      return res.send(
        layout({
          title: '匯入會員 Excel',
          user: req.user,
          path: '/members',
          body: importPage({ error: '檔案內容為空，或缺少資料列。', chapters: chaptersForView }),
        })
      );
    }

    const colIdx = buildColumnIndex(rows[0]);
    if (colIdx.name === undefined || colIdx.chapter === undefined) {
      return res.send(
        layout({
          title: '匯入會員 Excel',
          user: req.user,
          path: '/members',
          body: importPage({
            error: '找不到「姓名」或「分會」欄位標題，請確認第一列為欄位標題。',
            chapters: chaptersForView,
          }),
        })
      );
    }

    const chapterByName = new Map(chaptersForView.map((c) => [c.name.trim(), c.id]));

    let created = 0;
    let updated = 0;
    const errors = [];

    const dataRows = rows.slice(1);
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // Excel 列號（含標題列）
      const name = normalizeHeader(row[colIdx.name]);
      const chapterName = normalizeHeader(row[colIdx.chapter]);
      const professionName =
        colIdx.profession !== undefined ? normalizeHeader(row[colIdx.profession]) : '';

      if (!name) {
        errors.push({ row: rowNum, data: row, reason: '姓名為空白' });
        continue;
      }
      if (!chapterName) {
        errors.push({ row: rowNum, data: row, reason: '分會為空白' });
        continue;
      }
      const chapterId = chapterByName.get(chapterName);
      if (!chapterId) {
        errors.push({ row: rowNum, data: row, reason: `找不到分會「${chapterName}」，或您沒有該分會的權限` });
        continue;
      }

      let professionId = null;
      if (professionName) {
        const existing = await db.get('SELECT id FROM professions WHERE name = ?', [professionName]);
        if (existing) {
          professionId = existing.id;
        } else {
          const info = await db.run('INSERT INTO professions (name) VALUES (?) RETURNING id', [professionName]);
          professionId = info.rows[0].id;
        }
      }

      const existingMember = await db.get('SELECT id FROM members WHERE chapter_id = ? AND name = ?', [
        chapterId,
        name,
      ]);
      if (existingMember) {
        await db.run(
          "UPDATE members SET profession_id = ?, status = 'active', left_at = NULL, updated_at = NOW() WHERE id = ?",
          [professionId, existingMember.id]
        );
        updated += 1;
      } else {
        await db.run('INSERT INTO members (chapter_id, name, profession_id) VALUES (?, ?, ?)', [
          chapterId,
          name,
          professionId,
        ]);
        created += 1;
      }
    }

    res.send(
      layout({
        title: '匯入會員 Excel',
        user: req.user,
        path: '/members',
        body: importPage({ result: { created, updated, errors }, chapters: chaptersForView }),
      })
    );
  })
);

// ---------- 編輯 / 離會 / 恢復（含 :id 參數，需放在較明確的路由之後）----------

router.get(
  '/members/:id/edit',
  requireAuth,
  ah(async (req, res) => {
    const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!member) return res.status(404).send('找不到會員');
    if (!(await canAccessChapter(req.user, member.chapter_id))) {
      return res.status(403).send('權限不足：您無法編輯此會員。');
    }
    const scopeChapterIds = await chapterIdsForUser(req.user);
    const chapters = await accessibleChapters(scopeChapterIds);
    const professions = await db.all('SELECT id, name FROM professions ORDER BY name');
    res.send(
      layout({
        title: '編輯會員',
        user: req.user,
        path: '/members',
        body: memberFormPage({ member, chapters, professions }),
      })
    );
  })
);

router.post(
  '/members/:id',
  requireAuth,
  ah(async (req, res) => {
    const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!member) return res.status(404).send('找不到會員');
    if (!(await canAccessChapter(req.user, member.chapter_id))) {
      return res.status(403).send('權限不足：您無法編輯此會員。');
    }
    const { name, chapter_id, profession_id, notes } = req.body;
    if (!(await canAccessChapter(req.user, chapter_id))) {
      return res.status(403).send('權限不足：您無法將會員移至該分會。');
    }
    await db.run(
      `UPDATE members SET name = ?, chapter_id = ?, profession_id = ?, notes = ?, updated_at = NOW() WHERE id = ?`,
      [String(name).trim(), Number(chapter_id), profession_id ? Number(profession_id) : null, notes || null, member.id]
    );
    res.redirect(`/members?chapter=${Number(chapter_id)}`);
  })
);

router.post(
  '/members/:id/leave',
  requireAuth,
  ah(async (req, res) => {
    const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!member) return res.status(404).send('找不到會員');
    if (!(await canAccessChapter(req.user, member.chapter_id))) {
      return res.status(403).send('權限不足。');
    }
    await db.run(`UPDATE members SET status = 'left', left_at = NOW() WHERE id = ?`, [member.id]);
    res.redirect(`/members?chapter=${member.chapter_id}`);
  })
);

router.post(
  '/members/:id/rejoin',
  requireAuth,
  ah(async (req, res) => {
    const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!member) return res.status(404).send('找不到會員');
    if (!(await canAccessChapter(req.user, member.chapter_id))) {
      return res.status(403).send('權限不足。');
    }
    await db.run(`UPDATE members SET status = 'active', left_at = NULL WHERE id = ?`, [member.id]);
    res.redirect(`/members?chapter=${member.chapter_id}`);
  })
);

module.exports = router;
