// routes/auth.js
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { verifyPassword, setSessionCookie, clearSessionCookie } = require('../lib/auth');
const { loginPage } = require('../views/login');
const { ah } = require('../lib/async-handler');

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.send(loginPage({}));
});

router.post(
  '/login',
  ah(async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [String(username || '').trim()]);
    if (!user || !user.active) {
      return res.status(401).send(loginPage({ error: '帳號不存在或已被停用。', username }));
    }
    if (!verifyPassword(password || '', user.salt, user.password_hash)) {
      return res.status(401).send(loginPage({ error: '帳號或密碼錯誤。', username }));
    }
    setSessionCookie(res, user.id);
    res.redirect('/');
  })
);

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.redirect('/login');
});

module.exports = router;
