// lib/async-handler.js — 包裝 async route handler，將 rejected promise 轉交給 Express 錯誤處理中介層
'use strict';

function ah(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { ah };
