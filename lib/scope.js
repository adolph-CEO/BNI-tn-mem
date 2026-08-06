// lib/scope.js
// 依角色計算可存取的分會範圍：
//   admin      -> 全部分會
//   executive  -> 自己區域內的所有分會
//   advisor    -> 自己被指派管理的分會（1~2個）
'use strict';

const db = require('./db');

async function chapterIdsForUser(user) {
  if (!user) return [];
  if (user.role === 'admin') {
    const rows = await db.all('SELECT id FROM chapters');
    return rows.map((r) => r.id);
  }
  if (user.role === 'executive') {
    const rows = await db.all('SELECT id FROM chapters WHERE region_id = ?', [user.region_id]);
    return rows.map((r) => r.id);
  }
  if (user.role === 'advisor') {
    const rows = await db.all('SELECT chapter_id AS id FROM chapter_advisors WHERE user_id = ?', [user.id]);
    return rows.map((r) => r.id);
  }
  return [];
}

async function canAccessChapter(user, chapterId) {
  const ids = await chapterIdsForUser(user);
  return ids.includes(Number(chapterId));
}

module.exports = { chapterIdsForUser, canAccessChapter };
