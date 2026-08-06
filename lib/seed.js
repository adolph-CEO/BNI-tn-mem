// lib/seed.js — 建立 Demo 資料（簡化資料模型：職務直接掛在會員身上，無登入帳號）
// 1 區域、4 個分會、20 名會員、10 種專業別、5 個行業別
'use strict';

const db = require('./db');

async function main() {
  await db.ensureSchema();

  console.log('清除既有示範資料...');
  await db.exec('DELETE FROM chapter_advisors');
  await db.exec('DELETE FROM chapter_officers');
  await db.exec('DELETE FROM users');
  await db.exec('DELETE FROM members');
  await db.exec('DELETE FROM profession_industry_tags');
  await db.exec('DELETE FROM professions');
  await db.exec('DELETE FROM industry_tags');
  await db.exec('DELETE FROM chapters');
  await db.exec('DELETE FROM regions');

  // ---------- 區域 / 分會 ----------
  const regionInfo = await db.run('INSERT INTO regions (name) VALUES (?) RETURNING id', ['台南區']);
  const regionId = regionInfo.rows[0].id;

  const chapterNames = ['台南信義分會', '台南永華分會', '台南安平分會', '台南新營分會'];
  const chapterIds = [];
  for (let i = 0; i < chapterNames.length; i++) {
    const info = await db.run('INSERT INTO chapters (region_id, name, sort_order) VALUES (?, ?, ?) RETURNING id', [
      regionId,
      chapterNames[i],
      i + 1,
    ]);
    chapterIds.push(info.rows[0].id);
  }
  const [c1, c2, c3, c4] = chapterIds;

  // ---------- 行業別 ----------
  const industryNames = ['專業服務', '建築空間', '數位科技', '健康生活', '生活服務'];
  const industryIds = {};
  for (const name of industryNames) {
    const info = await db.run('INSERT INTO industry_tags (name) VALUES (?) RETURNING id', [name]);
    industryIds[name] = info.rows[0].id;
  }

  // ---------- 專業別（一對一歸屬行業別） ----------
  const professionIndustryMap = {
    會計記帳: '專業服務',
    保險規劃: '專業服務',
    室內設計: '建築空間',
    不動產仲介: '建築空間',
    法律服務: '專業服務',
    婚禮攝影: '生活服務',
    網頁設計: '數位科技',
    印刷設計: '數位科技',
    營養諮詢: '健康生活',
    汽車保養: '生活服務',
  };
  const professionIds = {};
  for (const [name, industryName] of Object.entries(professionIndustryMap)) {
    const info = await db.run('INSERT INTO professions (name, industry_id) VALUES (?, ?) RETURNING id', [
      name,
      industryIds[industryName],
    ]);
    professionIds[name] = info.rows[0].id;
  }

  // ---------- 會員（20 名，職務直接掛在會員身上） ----------
  async function addMember(chapterId, name, professionName, opts = {}) {
    const { status = 'active', role = null, execDirector = false } = opts;
    const leftAt = status === 'left' ? new Date() : null;
    await db.run(
      `INSERT INTO members (chapter_id, name, profession_id, status, left_at, role, exec_director)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chapterId, name, professionIds[professionName], status, leftAt, role, execDirector]
    );
  }

  // 台南信義分會
  await addMember(c1, '陳志明', '保險規劃', { role: '主席', execDirector: true });
  await addMember(c1, '林雅婷', '會計記帳', { role: '副主席' });
  await addMember(c1, '王建宏', '室內設計');
  await addMember(c1, '張淑芬', '不動產仲介', { role: '秘財' });
  await addMember(c1, '李昆霖', '法律服務');

  // 台南永華分會
  await addMember(c2, '黃冠宇', '網頁設計', { role: '主席' });
  await addMember(c2, '吳佩珊', '婚禮攝影', { role: '副主席' });
  await addMember(c2, '許志偉', '印刷設計', { role: '秘財' });
  await addMember(c2, '蔡明哲', '營養諮詢', { execDirector: true });
  await addMember(c2, '鄭雅文', '汽車保養');

  // 台南安平分會
  await addMember(c3, '劉俊傑', '保險規劃');
  await addMember(c3, '楊淑惠', '會計記帳', { role: '主席' });
  await addMember(c3, '謝博安', '室內設計', { role: '副主席' });
  await addMember(c3, '周慧玲', '不動產仲介', { status: 'left' }); // 離會示範
  await addMember(c3, '洪彥廷', '法律服務', { role: '秘財' });

  // 台南新營分會
  await addMember(c4, '曾秀娟', '婚禮攝影', { role: '副主席' });
  await addMember(c4, '賴俊良', '網頁設計', { role: '主席' });
  await addMember(c4, '潘怡君', '印刷設計', { status: 'left' }); // 離會示範
  await addMember(c4, '邱柏翰', '營養諮詢', { role: '秘財' });
  await addMember(c4, '盧思穎', '汽車保養');

  console.log('----------------------------------------------------');
  console.log('Demo 資料建立完成：');
  console.log('  1 區域（台南區）、4 分會、20 會員、10 專業別、5 行業別');
  console.log('  無登入帳號 — 系統改為單一公開頁面。');
  console.log('----------------------------------------------------');

  await db.pool.end();
}

main().catch((err) => {
  console.error('Seed 失敗：', err);
  process.exitCode = 1;
});
