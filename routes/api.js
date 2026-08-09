// routes/api.js — 單頁應用的 JSON API（需登入；角色權限限制尚未實作，後補）
'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();

const { ah } = require('../lib/async-handler');
const { requireAuthJson } = require('../lib/auth');
const crm = require('../lib/crm-data');
const db = require('../lib/db');

const ROLE_LABEL = { admin: '超級管理員', executive: '職董', advisor: '董顧' };

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use('/api', requireAuthJson);

router.get(
  '/api/data',
  ah(async (req, res) => {
    const data = await crm.getAppData();
    res.json({
      ...data,
      currentUser: { displayName: req.user.display_name, role: req.user.role, roleLabel: ROLE_LABEL[req.user.role] || req.user.role },
    });
  })
);

router.post(
  '/api/region',
  ah(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: '名稱不可為空' });
    await crm.renameRegion(name);
    res.json({ ok: true });
  })
);

router.post(
  '/api/chapters',
  ah(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: '名稱不可為空' });
    const id = await crm.addChapter(name);
    res.json({ ok: true, id });
  })
);

router.post(
  '/api/chapters/:id',
  ah(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: '名稱不可為空' });
    await crm.renameChapter(Number(req.params.id), name);
    res.json({ ok: true });
  })
);

router.post(
  '/api/chapters/:id/advisor',
  ah(async (req, res) => {
    const memberId = req.body.memberId ? Number(req.body.memberId) : null;
    await crm.setChapterAdvisor(Number(req.params.id), memberId);
    res.json({ ok: true });
  })
);

router.post(
  '/api/members/:id/role',
  ah(async (req, res) => {
    const role = req.body.role ? String(req.body.role) : null;
    const execDirector = !!req.body.execDirector;
    try {
      await crm.setMemberRole(Number(req.params.id), role, execDirector);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    res.json({ ok: true });
  })
);

router.post(
  '/api/members/:id/status',
  ah(async (req, res) => {
    const status = req.body.status === 'left' ? 'left' : 'active';
    await crm.setMemberStatus(Number(req.params.id), status);
    res.json({ ok: true });
  })
);

router.post(
  '/api/members',
  ah(async (req, res) => {
    const { name, chapterId, professionId } = req.body;
    if (!name || !chapterId) return res.status(400).json({ error: '姓名與分會為必填' });
    await db.run('INSERT INTO members (chapter_id, name, profession_id) VALUES (?, ?, ?)', [
      Number(chapterId),
      String(name).trim(),
      professionId ? Number(professionId) : null,
    ]);
    res.json({ ok: true });
  })
);

router.post(
  '/api/members/import',
  upload.single('file'),
  ah(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '請選擇要上傳的 CSV 檔案' });
    const text = req.file.buffer.toString('utf8');
    const result = await crm.importMembersCsv(text);
    res.json(result);
  })
);

module.exports = router;
