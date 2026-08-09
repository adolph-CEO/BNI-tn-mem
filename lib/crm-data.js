// lib/crm-data.js — 新版簡化資料模型的存取層（無登入、單一畫面）
'use strict';

const db = require('./db');
const { MEMBER_ROLES } = require('./util');

// 取得整包資料給前端單頁應用使用：區域（單一）、行業別、專業別、分會、會員
async function getAppData() {
  const region = (await db.get('SELECT * FROM regions ORDER BY id LIMIT 1')) || null;

  const industries = await db.all('SELECT id, name FROM industry_tags ORDER BY name');
  const professions = await db.all(
    'SELECT id, name, industry_id AS "industryId" FROM professions ORDER BY name'
  );
  const chapters = await db.all(
    'SELECT id, name, advisor_member_id AS "advisorMemberId" FROM chapters WHERE region_id = ? ORDER BY sort_order NULLS LAST, name',
    [region ? region.id : 0]
  );
  const members = await db.all(
    `SELECT id, name, chapter_id AS "chapterId", profession_id AS "professionId",
            status, role, exec_director AS "execDirector"
     FROM members
     WHERE chapter_id IN (SELECT id FROM chapters WHERE region_id = ?)
     ORDER BY name`,
    [region ? region.id : 0]
  );

  return {
    region: region ? { id: region.id, name: region.name } : { id: null, name: '' },
    industries,
    professions,
    chapters,
    members,
  };
}

async function renameRegion(name) {
  const region = await db.get('SELECT id FROM regions ORDER BY id LIMIT 1');
  if (!region) return null;
  await db.run('UPDATE regions SET name = ? WHERE id = ?', [name, region.id]);
  return region.id;
}

async function renameChapter(chapterId, name) {
  await db.run('UPDATE chapters SET name = ? WHERE id = ?', [name, chapterId]);
}

async function addChapter(name) {
  const region = await db.get('SELECT id FROM regions ORDER BY id LIMIT 1');
  if (!region) throw new Error('尚未設定區域');
  const maxRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) AS max FROM chapters WHERE region_id = ?', [region.id]);
  const nextOrder = (maxRow ? Number(maxRow.max) : 0) + 1;
  const info = await db.run('INSERT INTO chapters (region_id, name, sort_order) VALUES (?, ?, ?) RETURNING id', [
    region.id,
    name,
    nextOrder,
  ]);
  return info.rows[0].id;
}

async function setChapterAdvisor(chapterId, memberId) {
  await db.run('UPDATE chapters SET advisor_member_id = ? WHERE id = ?', [memberId || null, chapterId]);
}

async function setMemberRole(memberId, role, execDirector) {
  if (role !== null && !MEMBER_ROLES.includes(role)) {
    throw new Error('無效的職務');
  }
  await db.run('UPDATE members SET role = ?, exec_director = ?, updated_at = NOW() WHERE id = ?', [
    role,
    !!execDirector,
    memberId,
  ]);
}

async function setMemberStatus(memberId, status) {
  const leftAt = status === 'left' ? new Date() : null;
  await db.run('UPDATE members SET status = ?, left_at = ?, updated_at = NOW() WHERE id = ?', [
    status,
    leftAt,
    memberId,
  ]);
}

// CSV 匯入：姓名, 分會, 專業別, 狀態（比照參考檔案格式）。分會／專業別需與現有資料名稱相符，否則該列略過。
async function importMembersCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { added: 0, errors: 0 };

  const start = /姓名|name/i.test(lines[0]) ? 1 : 0;
  const region = await db.get('SELECT id FROM regions ORDER BY id LIMIT 1');
  const chapters = region
    ? await db.all('SELECT id, name FROM chapters WHERE region_id = ?', [region.id])
    : [];
  const professions = await db.all('SELECT id, name FROM professions');
  const chapterByName = new Map(chapters.map((c) => [c.name.trim(), c.id]));
  const profByName = new Map(professions.map((p) => [p.name.trim(), p.id]));

  let added = 0;
  let errors = 0;

  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.trim());
    const [name, chapterName, profName, statusText] = parts;
    if (!name) { errors++; continue; }
    const chapterId = chapterByName.get(chapterName);
    const professionId = profByName.get(profName);
    if (!chapterId || !professionId) { errors++; continue; }
    const status = (statusText || '').includes('離') ? 'left' : 'active';
    await db.run(
      'INSERT INTO members (chapter_id, name, profession_id, status, left_at) VALUES (?, ?, ?, ?, ?)',
      [chapterId, name, professionId, status, status === 'left' ? new Date() : null]
    );
    added++;
  }

  return { added, errors };
}

module.exports = {
  getAppData,
  renameRegion,
  renameChapter,
  addChapter,
  setChapterAdvisor,
  setMemberRole,
  setMemberStatus,
  importMembersCsv,
};
