// routes/professions.js
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { chapterIdsForUser } = require('../lib/scope');
const { layout } = require('../views/layout');
const { professionsPage } = require('../views/professions');
const { ah } = require('../lib/async-handler');

router.get(
  '/professions',
  requireAuth,
  ah(async (req, res) => {
    const scopeChapterIds = await chapterIdsForUser(req.user);

    const chapters = scopeChapterIds.length
      ? await db.all(
          `SELECT id, name FROM chapters WHERE id IN (${scopeChapterIds.map(() => '?').join(',')}) ORDER BY name`,
          scopeChapterIds
        )
      : [];

    const byChapter = [];
    for (const ch of chapters) {
      const rows = await db.all(
        `SELECT p.name AS name, COUNT(*) AS count
         FROM members m LEFT JOIN professions p ON p.id = m.profession_id
         WHERE m.chapter_id = ? AND m.status = 'active' AND m.profession_id IS NOT NULL
         GROUP BY p.name ORDER BY count DESC`,
        [ch.id]
      );
      const totalRow = await db.get(
        `SELECT COUNT(*) AS c FROM members WHERE chapter_id = ? AND status = 'active'`,
        [ch.id]
      );
      byChapter.push({ name: ch.name, professions: rows, total: totalRow.c });
    }

    const professions = await db.all(
      `SELECT p.id, p.name,
        (SELECT COUNT(*) FROM members m WHERE m.profession_id = p.id AND m.status = 'active') AS active_count,
        (SELECT STRING_AGG(pit.industry_tag_id::text, ',') FROM profession_industry_tags pit WHERE pit.profession_id = p.id) AS tag_ids,
        (SELECT STRING_AGG(t.name, '、') FROM profession_industry_tags pit JOIN industry_tags t ON t.id = pit.industry_tag_id WHERE pit.profession_id = p.id) AS tag_names
       FROM professions p ORDER BY p.name`
    );

    const tags = await db.all(
      `SELECT t.id, t.name,
        (SELECT COUNT(*) FROM profession_industry_tags pit WHERE pit.industry_tag_id = t.id) AS usage_count
       FROM industry_tags t ORDER BY t.name`
    );

    const canManage = ['admin', 'executive'].includes(req.user.role);

    res.send(
      layout({
        title: '專業別 / 行業標籤',
        user: req.user,
        path: '/professions',
        body: professionsPage({ byChapter, professions, tags, canManage }),
      })
    );
  })
);

router.post(
  '/professions',
  requireAuth,
  ah(async (req, res) => {
    if (!['admin', 'executive'].includes(req.user.role)) return res.status(403).send('權限不足');
    const name = String(req.body.name || '').trim();
    if (!name) return res.redirect('/professions');
    try {
      await db.run('INSERT INTO professions (name) VALUES (?)', [name]);
    } catch (e) {
      // 已存在則忽略（UNIQUE 衝突）
    }
    res.redirect('/professions');
  })
);

router.post(
  '/professions/:id/tags',
  requireAuth,
  ah(async (req, res) => {
    if (!['admin', 'executive'].includes(req.user.role)) return res.status(403).send('權限不足');
    const professionId = Number(req.params.id);
    const tagIds = [].concat(req.body.tag_id || []).map(Number).filter(Boolean);

    await db.withTransaction(async (tx) => {
      await tx.run('DELETE FROM profession_industry_tags WHERE profession_id = ?', [professionId]);
      for (const tid of tagIds) {
        await tx.run('INSERT INTO profession_industry_tags (profession_id, industry_tag_id) VALUES (?, ?)', [
          professionId,
          tid,
        ]);
      }
    });

    res.redirect('/professions');
  })
);

router.post(
  '/industry-tags',
  requireAuth,
  ah(async (req, res) => {
    if (!['admin', 'executive'].includes(req.user.role)) return res.status(403).send('權限不足');
    const name = String(req.body.name || '').trim();
    if (!name) return res.redirect('/professions');
    try {
      await db.run('INSERT INTO industry_tags (name) VALUES (?)', [name]);
    } catch (e) {
      // 已存在則忽略
    }
    res.redirect('/professions');
  })
);

module.exports = router;
