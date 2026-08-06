// routes/org.js — 職務設定：區域 / 分會 / 執董 / 董顧 帳號管理
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { requireAuth, requireRole, hashPassword } = require('../lib/auth');
const { layout } = require('../views/layout');
const { orgPage } = require('../views/org');
const { ah } = require('../lib/async-handler');

async function loadOrgData(user) {
  const isAdmin = user.role === 'admin';
  const regionRows = isAdmin
    ? await db.all('SELECT * FROM regions ORDER BY id')
    : await db.all('SELECT * FROM regions WHERE id = ?', [user.region_id]);

  const regions = [];
  for (const region of regionRows) {
    const executives = await db.all(
      `SELECT * FROM users WHERE role = 'executive' AND region_id = ? ORDER BY id`,
      [region.id]
    );
    const chapters = await db.all('SELECT * FROM chapters WHERE region_id = ? ORDER BY name', [region.id]);
    const chaptersWithAdvisors = [];
    for (const ch of chapters) {
      const advisors = await db.all(
        `SELECT u.* FROM users u
         JOIN chapter_advisors ca ON ca.user_id = u.id
         WHERE ca.chapter_id = ? ORDER BY u.id`,
        [ch.id]
      );
      chaptersWithAdvisors.push({ ...ch, advisors });
    }
    regions.push({ ...region, executives, chapters: chaptersWithAdvisors });
  }

  const allMembers = await db.all(
    `SELECT m.id, m.name, c.name AS chapter_name FROM members m
     JOIN chapters c ON c.id = m.chapter_id
     WHERE m.status = 'active' ORDER BY c.name, m.name`
  );

  return { regions, allMembers, isAdmin };
}

router.get(
  '/org',
  requireAuth,
  requireRole('admin', 'executive'),
  ah(async (req, res) => {
    const data = await loadOrgData(req.user);
    res.send(
      layout({
        title: '職務設定',
        user: req.user,
        path: '/org',
        body: orgPage({ user: req.user, ...data }),
      })
    );
  })
);

router.post(
  '/org/regions',
  requireAuth,
  requireRole('admin'),
  ah(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (name) await db.run('INSERT INTO regions (name) VALUES (?)', [name]);
    res.redirect('/org');
  })
);

router.post(
  '/org/chapters',
  requireAuth,
  requireRole('admin', 'executive'),
  ah(async (req, res) => {
    const regionId = Number(req.body.region_id);
    const name = String(req.body.name || '').trim();
    if (req.user.role === 'executive' && regionId !== req.user.region_id) {
      return res.status(403).send('權限不足：您只能在自己的區域新增分會。');
    }
    if (name && regionId) {
      await db.run('INSERT INTO chapters (region_id, name) VALUES (?, ?)', [regionId, name]);
    }
    res.redirect('/org');
  })
);

router.post(
  '/org/executives',
  requireAuth,
  requireRole('admin'),
  ah(async (req, res) => {
    const { display_name, username, password, region_id, member_id } = req.body;
    if (!display_name || !username || !password || !region_id) {
      return res.status(400).send('缺少必要欄位');
    }
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [String(username).trim()]);
    if (existing) return res.status(400).send('此帳號已存在，請使用其他帳號名稱。');

    const { hash, salt } = hashPassword(password);
    await db.run(
      `INSERT INTO users (username, password_hash, salt, display_name, role, region_id, member_id, active)
       VALUES (?, ?, ?, ?, 'executive', ?, ?, TRUE)`,
      [
        String(username).trim(),
        hash,
        salt,
        String(display_name).trim(),
        Number(region_id),
        member_id ? Number(member_id) : null,
      ]
    );
    res.redirect('/org');
  })
);

router.post(
  '/org/advisors',
  requireAuth,
  requireRole('admin', 'executive'),
  ah(async (req, res) => {
    const { display_name, username, password, member_id } = req.body;
    let chapterIds = [].concat(req.body.chapter_id || []).map(Number).filter(Boolean);

    if (!display_name || !username || !password) {
      return res.status(400).send('缺少必要欄位');
    }
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [String(username).trim()]);
    if (existing) return res.status(400).send('此帳號已存在，請使用其他帳號名稱。');

    if (req.user.role === 'executive') {
      const myChapters = await db.all('SELECT id FROM chapters WHERE region_id = ?', [req.user.region_id]);
      const myChapterIds = myChapters.map((r) => r.id);
      chapterIds = chapterIds.filter((id) => myChapterIds.includes(id));
    }

    // 每個分會最多 2 位董顧
    for (const chId of chapterIds) {
      const countRow = await db.get('SELECT COUNT(*) AS c FROM chapter_advisors WHERE chapter_id = ?', [chId]);
      if (Number(countRow.c) >= 2) {
        const ch = await db.get('SELECT name FROM chapters WHERE id = ?', [chId]);
        return res.status(400).send(`分會「${ch ? ch.name : chId}」已有 2 位董顧，無法再指派。`);
      }
    }

    const { hash, salt } = hashPassword(password);
    const info = await db.run(
      `INSERT INTO users (username, password_hash, salt, display_name, role, member_id, active)
       VALUES (?, ?, ?, ?, 'advisor', ?, TRUE) RETURNING id`,
      [String(username).trim(), hash, salt, String(display_name).trim(), member_id ? Number(member_id) : null]
    );

    const userId = info.rows[0].id;
    for (const chId of chapterIds) {
      await db.run('INSERT INTO chapter_advisors (chapter_id, user_id) VALUES (?, ?)', [chId, userId]);
    }

    res.redirect('/org');
  })
);

router.post(
  '/org/users/:id/toggle',
  requireAuth,
  requireRole('admin', 'executive'),
  ah(async (req, res) => {
    const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).send('找不到帳號');

    if (req.user.role === 'executive') {
      if (target.role !== 'advisor') return res.status(403).send('權限不足');
      const managedRows = await db.all('SELECT chapter_id FROM chapter_advisors WHERE user_id = ?', [target.id]);
      const managed = managedRows.map((r) => r.chapter_id);
      const myChapters = await db.all('SELECT id FROM chapters WHERE region_id = ?', [req.user.region_id]);
      const myChapterIds = myChapters.map((r) => r.id);
      const ok = managed.length === 0 || managed.some((id) => myChapterIds.includes(id));
      if (!ok) return res.status(403).send('權限不足：此董顧不屬於您的區域。');
    }

    await db.run('UPDATE users SET active = ? WHERE id = ?', [!target.active, target.id]);
    res.redirect('/org');
  })
);

module.exports = router;
