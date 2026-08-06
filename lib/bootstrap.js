// lib/bootstrap.js — 確保系統一定有可登入的帳號
// 目前僅負責「建立帳號、讓登入能動」，尚未依角色限制可視範圍／可操作項目（後補）。
'use strict';

const db = require('./db');
const { hashPassword } = require('./auth');

let bootstrapped = false;

async function ensureUser({ username, password, displayName, role, regionId = null, memberId = null }) {
  const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return existing.id;
  const { hash, salt } = hashPassword(password);
  const info = await db.run(
    `INSERT INTO users (username, password_hash, salt, display_name, role, region_id, member_id, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE) RETURNING id`,
    [username, hash, salt, displayName, role, regionId, memberId]
  );
  return info.rows[0].id;
}

async function ensureBootstrapAccounts() {
  await db.ensureSchema();

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
  await ensureUser({ username: adminUsername, password: adminPassword, displayName: '超級管理員', role: 'admin' });

  const region = await db.get('SELECT id FROM regions ORDER BY id LIMIT 1');

  // 示範用職董／董顧帳號：若資料庫已存在同名帳號（例如舊版 seed 建立過的）則不會重複建立或覆蓋密碼。
  await ensureUser({
    username: 'director01',
    password: 'director123',
    displayName: '職董示範帳號',
    role: 'executive',
    regionId: region ? region.id : null,
  });
  await ensureUser({
    username: 'advisor01',
    password: 'advisor123',
    displayName: '董顧示範帳號',
    role: 'advisor',
  });

  if (!bootstrapped) {
    bootstrapped = true;
    console.log('----------------------------------------------------');
    console.log('可登入帳號已確認就緒：');
    console.log(`  超級管理員：${adminUsername} / ${adminPassword}`);
    console.log('  職董示範帳號：director01 / director123');
    console.log('  董顧示範帳號：advisor01 / advisor123');
    console.log('  （尚未依角色限制可視範圍，所有角色登入後看到同一份畫面）');
    console.log('----------------------------------------------------');
  }
}

module.exports = { ensureBootstrapAccounts };
