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

module.exports = { esc, fmtDate, ROLE_LABEL };
