// lib/util.js
'use strict';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d) {
  if (!d) return '';
  // PostgreSQL 驅動會將 timestamp 欄位轉為 JS Date 物件，故一律經由 Date 轉換再取日期部分。
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

const ROLE_LABEL = {
  admin: '超級管理員',
  executive: '執行董事',
  advisor: '董事顧問',
};

// 舊版分會幹部職位代碼（保留供資料遷移對照，畫面已不使用）
const OFFICER_ROLES = ['president', 'vice_president', 'secretary_treasurer'];
const OFFICER_ROLE_LABEL = {
  president: '主席',
  vice_president: '副主席',
  secretary_treasurer: '秘書財務',
};

// 新版：職務直接掛在會員身上的三個分會幹部職位
const MEMBER_ROLES = ['主席', '副主席', '秘財'];

module.exports = { esc, fmtDate, ROLE_LABEL, OFFICER_ROLES, OFFICER_ROLE_LABEL, MEMBER_ROLES };
