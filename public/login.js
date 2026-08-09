// public/login.js — 登入頁背景動畫：矩陣雨 + 滑鼠視差飄移（比照參考檔案邏輯，改寫為原生 JS）
(function () {
  'use strict';

  const canvas = document.getElementById('rain-canvas');
  const rainLayer = document.getElementById('rain-layer');
  const wrap = document.getElementById('login-wrap');
  if (!canvas || !rainLayer || !wrap) return;

  const glyphs = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789'.split('');
  // 顏色改配合新版紙雕視覺（藏青底＋米白／黃色強調），不再沿用舊版藍色調
  const rainColor = '#f6f1e6';
  const wordColor = '#e8a934';
  const words = ['BNI', 'ATTENDANCE', 'CEUS', '1-TO-1S', 'VISITORS', 'REFERRALS'];

  let ctx, w, h, charW, charH, columns;

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    charW = 20;
    charH = 22;
    const colCount = Math.ceil(w / charW);
    let wordCursor = 0;
    columns = [];
    for (let i = 0; i < colCount; i++) {
      const isWord = i % 5 === 0;
      let word = null;
      if (isWord) {
        word = wordCursor % 2 === 0 ? 'BNI' : words[1 + (wordCursor % (words.length - 1))];
        wordCursor++;
      }
      columns.push({
        x: i * charW + charW / 2,
        speed: 0.5 + Math.random() * 0.7,
        phase: Math.random() * 1000,
        word,
        trailLen: word ? word.length + 6 : 14 + Math.floor(Math.random() * 8),
      });
    }
  }

  function glyphFor(x, rowIndex) {
    const seed = Math.floor(x) * 131 + rowIndex;
    const idx = Math.abs((seed * 2654435761) % glyphs.length);
    return glyphs[idx];
  }

  function animate(ts) {
    if (!ctx || !columns) { requestAnimationFrame(animate); return; }
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    columns.forEach((col) => {
      const headRow = Math.floor((ts / 1000) * col.speed * 3 + col.phase);
      const cycleLen = col.word ? col.word.length + 6 : 0;
      const totalCyclePx = (h / charH + col.trailLen + 6) * charH;
      for (let i = 0; i < col.trailLen; i++) {
        const rowIndex = headRow - i;
        let ch;
        if (col.word) {
          const pos = ((rowIndex % cycleLen) + cycleLen) % cycleLen;
          ch = pos < col.word.length ? col.word[pos] : '';
        } else {
          ch = glyphFor(col.x, rowIndex);
        }
        if (!ch) continue;
        let y = (rowIndex * charH) % totalCyclePx;
        if (y < 0) y += totalCyclePx;
        y -= col.trailLen * charH;
        if (y < -charH || y > h + charH) continue;
        const fade = Math.max(0, 1 - i / col.trailLen);
        if (col.word) {
          ctx.globalAlpha = i === 0 ? 0.8 : fade * 0.5;
          ctx.fillStyle = wordColor;
          ctx.font = '700 15px "Barlow Condensed", sans-serif';
        } else {
          ctx.globalAlpha = fade * 0.32;
          ctx.fillStyle = rainColor;
          ctx.font = '400 15px monospace';
        }
        ctx.fillText(ch, col.x, y);
      }
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }

  function onMouseMove(e) {
    const rect = wrap.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    const drift = 26;
    rainLayer.style.transform = `translate(${-relX * 2 * drift}px, ${-relY * 2 * drift}px)`;
  }
  function onMouseLeave() {
    rainLayer.style.transform = 'translate(0px, 0px)';
  }

  setupCanvas();
  requestAnimationFrame(animate);
  window.addEventListener('resize', setupCanvas);
  wrap.addEventListener('mousemove', onMouseMove);
  wrap.addEventListener('mouseleave', onMouseLeave);
})();
