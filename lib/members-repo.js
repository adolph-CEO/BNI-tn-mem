// lib/members-repo.js — 會員資料存取與「目前管理職務」計算
'use strict';

const db = require('./db');

// 取得會員清單（含篩選）。roles 資訊會即時從 users / chapter_advisors 運算，避免資料不同步。
async function listMembers({ chapterIds, professionIds, showLeft, search, scopeChapterIds }) {
  const clauses = [];
  const params = [];

  // 權限範圍：一定要限制在使用者可存取的分會內
  if (scopeChapterIds) {
    if (scopeChapterIds.length === 0) {
      return [];
    }
    clauses.push(`m.chapter_id IN (${scopeChapterIds.map(() => '?').join(',')})`);
    params.push(...scopeChapterIds);
  }

  if (chapterIds && chapterIds.length) {
    clauses.push(`m.chapter_id IN (${chapterIds.map(() => '?').join(',')})`);
    params.push(...chapterIds);
  }

  if (professionIds && professionIds.length) {
    clauses.push(`m.profession_id IN (${professionIds.map(() => '?').join(',')})`);
    params.push(...professionIds);
  }

  if (!showLeft) {
    clauses.push(`m.status = 'active'`);
  }

  if (search) {
    clauses.push(`m.name LIKE ?`);
    params.push(`%${search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      m.id, m.name, m.status, m.left_at, m.notes, m.chapter_id,
      c.name AS chapter_name,
      m.profession_id, p.name AS profession_name,
      u.id AS user_id, u.role AS account_role, u.active AS account_active, u.username AS account_username,
      reg.name AS executive_region_name,
      (
        SELECT STRING_AGG(ch2.name, '、')
        FROM chapter_advisors ca JOIN chapters ch2 ON ch2.id = ca.chapter_id
        WHERE ca.user_id = u.id
      ) AS advisor_chapters
    FROM members m
    JOIN chapters c ON c.id = m.chapter_id
    LEFT JOIN professions p ON p.id = m.profession_id
    LEFT JOIN users u ON u.member_id = m.id
    LEFT JOIN regions reg ON reg.id = u.region_id AND u.role = 'executive'
    ${where}
    ORDER BY c.name, m.name
  `;

  return db.all(sql, params);
}

function managementRoleLabel(row) {
  if (row.account_role === 'executive') {
    const suffix = row.account_active ? '' : '（帳號已停用）';
    return `執行董事${row.executive_region_name ? '｜' + row.executive_region_name : ''}${suffix}`;
  }
  if (row.account_role === 'advisor') {
    const suffix = row.account_active ? '' : '（帳號已停用）';
    return `董事顧問｜${row.advisor_chapters || '尚未指派分會'}${suffix}`;
  }
  return '一般會員';
}

module.exports = { listMembers, managementRoleLabel };
