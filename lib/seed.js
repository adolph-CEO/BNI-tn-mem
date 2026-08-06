// lib/seed.js — 建立 Demo 資料
// 1 區域執董、5 位董顧、4 個分會、20 名會員、10 種專業別、5 個行業別
'use strict';

const db = require('./db');
const { hashPassword } = require('./auth');
const { ensureAdmin } = require('./bootstrap');

async function main() {
  await db.ensureSchema();
  await ensureAdmin();

  console.log('清除既有示範資料（保留 admin 帳號）...');
  await db.exec('DELETE FROM chapter_advisors');
  await db.exec(`DELETE FROM users WHERE role != 'admin'`);
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
  for (const name of chapterNames) {
    const info = await db.run('INSERT INTO chapters (region_id, name) VALUES (?, ?) RETURNING id', [regionId, name]);
    chapterIds.push(info.rows[0].id);
  }
  const [c1, c2, c3, c4] = chapterIds;

  // ---------- 專業別 / 行業標籤 ----------
  const professionNames = [
    '會計記帳',
    '保險規劃',
    '室內設計',
    '不動產仲介',
    '法律服務',
    '婚禮攝影',
    '網頁設計',
    '印刷設計',
    '營養諮詢',
    '汽車保養',
  ];
  const professionIds = {};
  for (const name of professionNames) {
    const info = await db.run('INSERT INTO professions (name) VALUES (?) RETURNING id', [name]);
    professionIds[name] = info.rows[0].id;
  }

  const industryTagNames = ['專業服務', '建築空間', '數位科技', '健康生活', '生活服務'];
  const tagIds = {};
  for (const name of industryTagNames) {
    const info = await db.run('INSERT INTO industry_tags (name) VALUES (?) RETURNING id', [name]);
    tagIds[name] = info.rows[0].id;
  }

  const professionTagMap = {
    會計記帳: ['專業服務'],
    保險規劃: ['專業服務', '健康生活'],
    室內設計: ['建築空間'],
    不動產仲介: ['建築空間', '專業服務'],
    法律服務: ['專業服務'],
    婚禮攝影: ['生活服務'],
    網頁設計: ['數位科技'],
    印刷設計: ['數位科技'],
    營養諮詢: ['健康生活'],
    汽車保養: ['生活服務'],
  };
  for (const [pName, tags] of Object.entries(professionTagMap)) {
    for (const tName of tags) {
      await db.run('INSERT INTO profession_industry_tags (profession_id, industry_tag_id) VALUES (?, ?)', [
        professionIds[pName],
        tagIds[tName],
      ]);
    }
  }

  // ---------- 會員（20 名，含 5 位董顧 + 1 位執董 的會籍身分） ----------
  async function addMember(chapterId, name, professionName, status = 'active') {
    const leftAt = status === 'left' ? new Date() : null;
    const info = await db.run(
      `INSERT INTO members (chapter_id, name, profession_id, status, left_at) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [chapterId, name, professionIds[professionName], status, leftAt]
    );
    return info.rows[0].id;
  }

  const M = {}; // 記錄關鍵會員 id，供後續建立帳號連結

  // 台南信義分會
  M.chenZhiming = await addMember(c1, '陳志明', '保險規劃'); // 董顧：管理信義分會（本會）
  await addMember(c1, '林雅婷', '會計記帳');
  M.wangJianhong = await addMember(c1, '王建宏', '室內設計'); // 董顧：管理安平分會（跨分會案例）
  await addMember(c1, '張淑芬', '不動產仲介');
  await addMember(c1, '李昆霖', '法律服務');

  // 台南永華分會
  M.huangGuanyu = await addMember(c2, '黃冠宇', '網頁設計'); // 董顧：管理永華分會（本會）
  await addMember(c2, '吳佩珊', '婚禮攝影');
  await addMember(c2, '許志偉', '印刷設計');
  M.caiMingzhe = await addMember(c2, '蔡明哲', '營養諮詢'); // 執董：管理台南區
  await addMember(c2, '鄭雅文', '汽車保養');

  // 台南安平分會
  await addMember(c3, '劉俊傑', '保險規劃');
  M.yangShuhui = await addMember(c3, '楊淑惠', '會計記帳'); // 董顧：管理安平分會（本會，與王建宏共同管理）
  await addMember(c3, '謝博安', '室內設計');
  await addMember(c3, '周慧玲', '不動產仲介', 'left'); // 離會示範
  await addMember(c3, '洪彥廷', '法律服務');

  // 台南新營分會
  await addMember(c4, '曾秀娟', '婚禮攝影');
  M.laiJunliang = await addMember(c4, '賴俊良', '網頁設計'); // 董顧：管理新營分會（本會）
  await addMember(c4, '潘怡君', '印刷設計', 'left'); // 離會示範
  await addMember(c4, '邱柏翰', '營養諮詢');
  await addMember(c4, '盧思穎', '汽車保養');

  // ---------- 帳號：1 位執董 + 5 位董顧 ----------
  async function createUser({ username, password, displayName, role, regionId = null, memberId = null }) {
    const { hash, salt } = hashPassword(password);
    const info = await db.run(
      `INSERT INTO users (username, password_hash, salt, display_name, role, region_id, member_id, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE) RETURNING id`,
      [username, hash, salt, displayName, role, regionId, memberId]
    );
    return info.rows[0].id;
  }

  async function assignAdvisor(chapterId, userId) {
    await db.run('INSERT INTO chapter_advisors (chapter_id, user_id) VALUES (?, ?)', [chapterId, userId]);
  }

  // 執行董事：管理整個台南區
  await createUser({
    username: 'director01',
    password: 'director123',
    displayName: '蔡明哲',
    role: 'executive',
    regionId,
    memberId: M.caiMingzhe,
  });

  // 董顧 1：陳志明，管理台南信義分會（本會）
  let advId = await createUser({
    username: 'advisor01',
    password: 'advisor123',
    displayName: '陳志明',
    role: 'advisor',
    memberId: M.chenZhiming,
  });
  await assignAdvisor(c1, advId);

  // 董顧 2：黃冠宇，管理台南永華分會（本會）
  advId = await createUser({
    username: 'advisor02',
    password: 'advisor123',
    displayName: '黃冠宇',
    role: 'advisor',
    memberId: M.huangGuanyu,
  });
  await assignAdvisor(c2, advId);

  // 董顧 3：王建宏（會籍在信義分會），管理台南安平分會 —— 跨分會管理示範
  advId = await createUser({
    username: 'advisor03',
    password: 'advisor123',
    displayName: '王建宏',
    role: 'advisor',
    memberId: M.wangJianhong,
  });
  await assignAdvisor(c3, advId);

  // 董顧 4：楊淑惠，管理台南安平分會（本會，與王建宏共同管理，示範一分會 2 位董顧）
  advId = await createUser({
    username: 'advisor04',
    password: 'advisor123',
    displayName: '楊淑惠',
    role: 'advisor',
    memberId: M.yangShuhui,
  });
  await assignAdvisor(c3, advId);

  // 董顧 5：賴俊良，管理台南新營分會（本會）
  advId = await createUser({
    username: 'advisor05',
    password: 'advisor123',
    displayName: '賴俊良',
    role: 'advisor',
    memberId: M.laiJunliang,
  });
  await assignAdvisor(c4, advId);

  console.log('----------------------------------------------------');
  console.log('Demo 資料建立完成：');
  console.log('  1 區域（台南區）、4 分會、20 會員、10 專業別、5 行業標籤');
  console.log('  1 執行董事帳號：director01 / director123');
  console.log('  5 位董事顧問帳號：advisor01~advisor05 / advisor123');
  console.log('  （王建宏 advisor03 為跨分會管理示範：會籍在信義分會，管理安平分會）');
  console.log('----------------------------------------------------');

  await db.pool.end();
}

main().catch((err) => {
  console.error('Seed 失敗：', err);
  process.exitCode = 1;
});
