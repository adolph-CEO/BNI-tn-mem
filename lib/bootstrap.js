// lib/bootstrap.js — 確保系統一定存在一個超級管理帳號 admin
'use strict';

const db = require('./db');
const { hashPassword } = require('./auth');

let bootstrapped = false;

async function ensureAdmin() {
  await db.ensureSchema();

  const existing = await db.get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (existing) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin1234';
  const { hash, salt } = hashPassword(password);

  await db.run(
    `INSERT INTO users (username, password_hash, salt, display_name, role, active)
     VALUES (?, ?, ?, '超級管理員', 'admin', TRUE)`,
    [username, hash, salt]
  );

  if (!bootstrapped) {
    bootstrapped = true;
    console.log('----------------------------------------------------');
    console.log('已建立初始超級管理帳號（admin）：');
    console.log(`  帳號：${username}`);
    console.log(`  密碼：${password}`);
    console.log('請登入後立即於「職務設定」建立正式帳號，並可將此帳號停用。');
    console.log('----------------------------------------------------');
  }
}

module.exports = { ensureAdmin };
