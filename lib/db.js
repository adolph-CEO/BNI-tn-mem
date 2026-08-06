// lib/db.js
// 資料庫層：PostgreSQL（透過 `pg` 套件）。設計為可直接對接 Neon / Vercel Postgres / Supabase
// 等雲端 Postgres，也可指向本機或 Railway / Render 等平台的 Postgres 服務。
//
// 為了讓上層程式碼維持簡潔，這裡提供三個主要方法：
//   db.all(sql, params) -> Promise<rows[]>
//   db.get(sql, params) -> Promise<row|undefined>
//   db.run(sql, params) -> Promise<{ rows, rowCount }>
// SQL 字串一律使用 `?` 作為參數佔位符（與呼叫端參數陣列順序一致），
// 內部會自動轉換成 PostgreSQL 的 $1, $2 ... 語法。
'use strict';

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('缺少環境變數 DATABASE_URL，請設定為您的 PostgreSQL 連線字串（例如 Neon / Vercel Postgres）。');
}

const pool = new Pool({
  connectionString,
  // Neon / Vercel Postgres / 多數雲端 Postgres 皆需要 SSL；本機開發 Postgres 通常不需要，
  // 若連線字串包含 sslmode=disable 則尊重該設定。
  ssl:
    connectionString && /sslmode=disable/.test(connectionString)
      ? false
      : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('PostgreSQL 連線池發生未預期錯誤：', err);
});

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function all(sql, params = []) {
  const res = await pool.query(toPg(sql), params);
  return res.rows;
}

async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0];
}

async function run(sql, params = []) {
  return pool.query(toPg(sql), params);
}

async function exec(sql) {
  await pool.query(sql);
}

// 執行一組需要交易保護的操作。fn 收到一個與 db 介面相同（all/get/run）但綁定同一連線的物件。
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txDb = {
      all: async (sql, params = []) => (await client.query(toPg(sql), params)).rows,
      get: async (sql, params = []) => {
        const res = await client.query(toPg(sql), params);
        return res.rows[0];
      },
      run: async (sql, params = []) => client.query(toPg(sql), params),
    };
    const result = await fn(txDb);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS industry_tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profession_industry_tags (
  profession_id INTEGER NOT NULL REFERENCES professions(id) ON DELETE CASCADE,
  industry_tag_id INTEGER NOT NULL REFERENCES industry_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (profession_id, industry_tag_id)
);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profession_id INTEGER REFERENCES professions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','left')),
  left_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','executive','advisor')),
  region_id INTEGER REFERENCES regions(id) ON DELETE SET NULL,
  member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapter_advisors (
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (chapter_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_chapter ON members(chapter_id);
CREATE INDEX IF NOT EXISTS idx_members_profession ON members(profession_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_chapters_region ON chapters(region_id);
`;

let schemaReadyPromise = null;
function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = exec(SCHEMA_SQL).catch((err) => {
      schemaReadyPromise = null; // 允許下一次請求重試
      throw err;
    });
  }
  return schemaReadyPromise;
}

module.exports = { pool, all, get, run, exec, withTransaction, ensureSchema };
