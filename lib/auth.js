// lib/auth.js
// 密碼雜湊（scrypt，Node 內建 crypto，無需第三方套件）與簽章式 Session Cookie。
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECRET_PATH = path.join(DATA_DIR, '.session-secret');

function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  // 本機開發時把密鑰存到 data/.session-secret，方便重啟後 session 不失效。
  // 在 Vercel 等唯讀檔案系統（僅 /tmp 可寫，且不持久）的環境中，寫入會失敗，
  // 此時退回產生一組僅存於記憶體中的密鑰 —— 正式環境務必改用 SESSION_SECRET
  // 環境變數，否則每次冷啟動都會讓已登入的使用者被登出。
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(SECRET_PATH)) return fs.readFileSync(SECRET_PATH, 'utf8').trim();
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 });
    return secret;
  } catch (e) {
    console.warn(
      '警告：無法寫入 data/.session-secret（唯讀檔案系統，如 Vercel），改用僅存於記憶體的暫時密鑰。' +
        '正式環境請務必設定 SESSION_SECRET 環境變數。'
    );
    return crypto.randomBytes(32).toString('hex');
  }
}

const SECRET = getSecret();

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sign(value) {
  const h = crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
  return `${value}.${h}`;
}

function unsign(signed) {
  if (!signed || typeof signed !== 'string') return null;
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return value;
}

const COOKIE_NAME = 'bni_session';

function createSessionCookie(userId) {
  const payload = JSON.stringify({ uid: userId, t: Date.now() });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  return sign(encoded);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

async function getUserById(id) {
  const row = await db.get(
    `SELECT u.*, r.name AS region_name
     FROM users u LEFT JOIN regions r ON r.id = u.region_id
     WHERE u.id = ?`,
    [id]
  );
  return row || null;
}

async function attachUser(req, res, next) {
  req.user = null;
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  const encoded = unsign(raw);
  if (encoded) {
    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      const user = await getUserById(payload.uid);
      if (user && user.active) {
        req.user = user;
      }
    } catch (e) {
      // ignore malformed cookie 或資料庫暫時性錯誤，視為未登入
      console.error('attachUser error:', e.message);
    }
  }
  next();
}

function setSessionCookie(res, userId) {
  const value = createSessionCookie(userId);
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.role)) {
      return res.status(403).send('權限不足：您沒有存取此頁面的權限。');
    }
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  attachUser,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requireRole,
  getUserById,
};
