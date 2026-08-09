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
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS sort_order INTEGER;

CREATE TABLE IF NOT EXISTS industry_tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  industry_id INTEGER REFERENCES industry_tags(id) ON DELETE SET NULL
);

ALTER TABLE professions ADD COLUMN IF NOT EXISTS industry_id INTEGER REFERENCES industry_tags(id) ON DELETE SET NULL;

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT CHECK (role IN ('主席','副主席','秘財')),
  exec_director BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE members ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('主席','副主席','秘財'));
ALTER TABLE members ADD COLUMN IF NOT EXISTS exec_director BOOLEAN NOT NULL DEFAULT FALSE;

-- 分會董顧（指派某位會員擔任該分會的董顧）。因為要參照 members(id)，只能在 members 表
-- 建立之後用 ALTER TABLE 補上（chapters 表本身建立時 members 還不存在，會循環參照）。
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS advisor_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL;

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

-- 分會幹部（主席／副主席／秘書財務）：僅能指派該分會的在籍會員，每個分會每個職位限一人。
CREATE TABLE IF NOT EXISTS chapter_officers (
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('president','vice_president','secretary_treasurer')),
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chapter_id, role)
);

CREATE INDEX IF NOT EXISTS idx_members_chapter ON members(chapter_id);
CREATE INDEX IF NOT EXISTS idx_members_profession ON members(profession_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_chapters_region ON chapters(region_id);
`;

// 補齊尚未設定 sort_order 的分會（例如舊資料、或剛新增欄位時），依 id 順序給予初始排序值。
const BACKFILL_SORT_ORDER_SQL = `
UPDATE chapters c SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY region_id ORDER BY sort_order NULLS LAST, id) AS rn
  FROM chapters
) sub
WHERE c.id = sub.id AND c.sort_order IS DISTINCT FROM sub.rn;
`;

// 舊版資料模型（帳號指派董顧／分會幹部表、專業別多對多行業標籤）遷移到新版簡化模型：
// 職務直接掛在會員身上（role / exec_director），專業別對行業改成一對一（industry_id）。
// 只在欄位仍是 NULL／FALSE 時回填，不會覆蓋新版已直接寫入的資料，可安全重複執行。
const BACKFILL_SIMPLIFIED_MODEL_SQL = `
UPDATE members m SET role = CASE co.role
    WHEN 'president' THEN '主席'
    WHEN 'vice_president' THEN '副主席'
    WHEN 'secretary_treasurer' THEN '秘財'
  END
FROM chapter_officers co
WHERE co.member_id = m.id AND m.role IS NULL;

UPDATE members m SET exec_director = TRUE
FROM users u
WHERE u.member_id = m.id AND u.role = 'executive' AND m.exec_director = FALSE;

UPDATE professions p SET industry_id = sub.tag_id
FROM (
  SELECT profession_id, MIN(industry_tag_id) AS tag_id
  FROM profession_industry_tags
  GROUP BY profession_id
) sub
WHERE sub.profession_id = p.id AND p.industry_id IS NULL;
`;

let schemaReadyPromise = null;
function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = exec(SCHEMA_SQL)
      .then(() => exec(BACKFILL_SORT_ORDER_SQL))
      .then(() => exec(BACKFILL_SIMPLIFIED_MODEL_SQL))
      .catch((err) => {
        schemaReadyPromise = null; // 允許下一次請求重試
        throw err;
      });
  }
  return schemaReadyPromise;
}

module.exports = { pool, all, get, run, exec, withTransaction, ensureSchema };
