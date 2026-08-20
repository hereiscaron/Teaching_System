/* 教务系统测试数据生成器：模拟 50 人高一新生入学班级（含记录点：谭悦瑶）
 * 输出 CSV 严格匹配工作台可编辑表格的导入格式：
 *   - UTF-8 带 BOM
 *   - 首行表头与表格列名一致（≥半数匹配即识别为表头）
 *   - 列数 = 表格可编辑列数
 * 用法：node gen_test_csv.js <输出目录>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || path.join(__dirname, 'out');

// ---------- 50 名学生（确定性生成，包含谭悦瑶） ----------
const SUR = ['王','李','张','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','罗','郑','梁','谢','宋','唐','韩','冯','曹','彭','许','邓','沈','蒋','袁','蔡','吕','方','苏','叶','贺','董','魏','邱','任','白','程','江','谭','欧阳','夏','钟','潘','田','杜','丁','姜','范','石','姚','邹','熊','金','陆','郝','孔','白','崔','康','毛','邱','秦','江','史','顾','侯','邵','孟','龙','万','段','雷','钱','汤','尹','黎','易','常','武','乔','贺','赖','龚','文'];
const GIVEN = ['雨桐','明轩','子涵','思远','诗涵','梓涵','晨曦','紫宸','欣怡','俊杰','嘉怡','浩然','思睿','婉清','宇航','芷晴','沐阳','书瑶','逸辰','雅文','博文','安琪','泽宇','可欣','一诺','子墨','语嫣','睿哲','佳宁','皓文','佳宜','承恩','诗琪','承泽','欣妍','俊熙','若琳','梓宸','语桐','浩宇','欣然','梓恒','嘉树','若曦','子昂','雨桐','晓峰','悦瑶','思彤','奕辰','梦琪','天佑','静怡','欣悦','嘉豪','雨泽','子轩','欣妍','若彤','铭泽','思颖','俊宇','心怡','梓萱','昊然','佳琪','雨欣','子睿','诗雨','俊哲','梦瑶','晨曦','宇轩','欣怡','浩然','静雯','泽楷','思远','雨薇','嘉懿','梓涵','舒婷','天宇','欣妍','明宇','慧敏','家豪','可欣','子墨','诗涵','俊豪','雨彤','静怡','志远','梦洁','一帆','紫萱','子安','思源','晓彤','乐瑶','靖宇','文静','嘉欣','宇航','雨欣','泽洋','梦婷','俊辉','思彤','婉婷','子豪','佳欣','明轩','雅琪','皓轩','欣妍','博文','雨萌','铭浩','诗婷','亦辰','雨桐','思琪','天翊','佳慧','子恒','梦琪','俊楠','悦宁','静姝','嘉豪','雨航','晨曦','梓萌','浩然','思雨','宇阳','心语','泽宇','雨晴','俊熙','文博','欣瑶','明达','佳怡','思远','子萱','乐欣','昊宇','语嫣','志豪','可欣','雨涵','俊贤','诗雯','亦凡','欣怡','泽瑞','梦洁','天乐','紫彤','宇晨','静怡','浩然','欣妍','梓豪','雨桐','俊豪','思颖','婉茹','嘉懿','明轩','语晴','子墨','佳宁','欣悦','俊凯','诗涵','雨泽','思彤','一诺','欣怡','泽宇','文静','天佑','梦琪','雅萱','浩宇','雨欣','铭泽','俊杰','思颖','紫怡','子昂','可欣','奕辰','雨彤','静怡','志远','欣妍','宇轩','嘉豪','诗雨','俊熙','雨欣','晨曦','思源','婉婷','子睿','欣悦','浩然','梦洁','嘉欣','明宇','雨薇','俊豪','思彤','泽楷','一凡','欣妍','紫萱','俊楠','雨桐','文博','静姝','天翊','佳慧','亦辰','心语','雨晴','欣瑶','宇阳','乐欣','昊宇','文静','子恒','嘉懿','俊贤','语晴','梦婷','泽瑞','雅萱','明达','诗雯','思雨','婉茹','天乐','紫彤','俊凯','欣怡','子安','雨萌','诗婷','皓轩','靖宇','语桐','俊辉','若彤','一诺','泽洋','欣悦','明轩','雨泽','俊杰','静怡','子墨','嘉欣','思源','雨欣','铭浩','俊熙','佳慧','晨曦','宇晨','诗雨','天佑','婉婷','欣妍','子睿','浩然','梦洁','嘉豪','文静','欣悦','志远','雨薇','俊豪','思彤','泽楷','一凡','紫萱','俊楠','雨桐','文博','静姝','天翊','佳宁','亦辰','心语','雨晴','欣瑶','宇阳','乐欣','昊宇','文博','静怡','子恒','嘉懿','俊贤','语晴','梦婷','泽瑞','雅萱','明达','诗雯','思雨','婉茹','天乐','紫彤','俊凯','欣怡','子安','雨萌','诗婷','皓轩','靖宇','语桐','俊辉','若彤','一诺','泽洋','欣悦'];

function rng(seed){ let s = seed >>> 0; return function(){ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function makeStudents(){
  const r = rng(20260901);
  const used = new Set(['谭悦瑶']);
  const list = [];
  function pick(){
    for (let i = 0; i < 200; i++) {
      const name = SUR[Math.floor(r() * SUR.length)] + GIVEN[Math.floor(r() * GIVEN.length)];
      if (!used.has(name)) { used.add(name); return name; }
    }
    return '学生' + list.length;
  }
  // 49 名 + 谭悦瑶，共 50
  for (let i = 0; i < 49; i++) list.push(pick());
  list.push('谭悦瑶');
  // 打乱但固定谭悦瑶位置为 1（记录点醒目）
  const shuffled = list.slice(0, 49).sort(() => r() - 0.5);
  const ordered = ['谭悦瑶'].concat(shuffled);
  // 性别与宿舍：女生 24（A101-A106 各4），男生 26（B201-B205）
  const students = ordered.map((name, idx) => {
    const isGirl = idx < 24;
    const room0 = isGirl ? 'A10' + (Math.floor(idx / 4) + 1) : 'B20' + (Math.floor((idx - 24) / 5) + 1);
    const boarding = (name === '谭悦瑶') ? true : (r() < 0.82);
    const room = (name === '谭悦瑶') ? 'A101' : room0;
    return {
      name,
      id: 'G2026' + String(100000000 + idx),
      gender: isGirl ? '女' : '男',
      status: boarding ? '住宿' : '在籍',
      dorm: boarding ? room : '',
      parent: name.slice(0, 1) + '家长',
      phone: '13' + String(7 + Math.floor(r() * 2)) + String(Math.floor(r() * 100000000)).padStart(8, '0'),
      focus: name === '谭悦瑶' ? '重点关注' : (r() < 0.06 ? '重点关注' : '')
    };
  });
  return students;
}

// ---------- CSV 工具 ----------
function csv(rows){
  const esc = (v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '\ufeff' + rows.map((row) => row.map(esc).join(',')).join('\r\n') + '\r\n';
}

// ---------- 生成 ----------
function main(){
  fs.mkdirSync(outDir, { recursive: true });
  const students = makeStudents();
  const ty = students.find((s) => s.name === '谭悦瑶');

  // 1) 学生名单（学生档案表：姓名,学籍号,性别,学籍状态,宿舍,家长,联系电话,重点标记）
  fs.writeFileSync(path.join(outDir, '01_学生名单_高一8班.csv'), csv([
    ['姓名','学籍号','性别','学籍状态','宿舍','家长','联系电话','重点标记'],
    ...students.map((s) => [s.name, s.id, s.gender, s.status, s.dorm, s.parent, s.phone, s.focus])
  ]), 'utf8');

  // 2) 异常考勤（考勤管理表：日期,学生,类型,备注）
  const absents = [
    ['2026-09-02', '谭悦瑶', '迟到', '07:41 到校，已谈话提醒'],
    ['2026-09-02', students[12].name, '缺勤', '未到校，家长电话未接通，已短信留言'],
    ['2026-09-03', students[20].name, '请假', '急性肠胃炎，需销假'],
    ['2026-09-04', students[31].name, '请假', '体育特长生区级选拔赛，需销假'],
    ['2026-09-05', students[7].name, '迟到', '08:02 到校'],
    ['2026-09-05', students[40].name, '缺勤', '病假无假条，已联系家长补交']
  ];
  fs.writeFileSync(path.join(outDir, '02_异常考勤_高一8班.csv'), csv([
    ['日期','学生','类型','备注'], ...absents
  ]), 'utf8');

  // 3) 宿舍信息（宿舍管理表：宿舍号,成员名单,舍长,备注）
  const rooms = [];
  const byRoom = {};
  students.filter((s) => s.dorm).forEach((s) => { (byRoom[s.dorm] = byRoom[s.dorm] || []).push(s.name); });
  const rng2 = rng(20260902);
  Object.keys(byRoom).sort().forEach((room, i) => {
    const members = byRoom[room];
    rooms.push([room, members.join('、'), members[0], i === 0 ? '新生入住首周，重点关注' : (rng2() < 0.25 ? '卫生待提升' : '')]);
  });
  fs.writeFileSync(path.join(outDir, '03_宿舍信息_高一8班.csv'), csv([
    ['宿舍号','成员名单','舍长','备注'], ...rooms
  ]), 'utf8');

  // 4) 综合素质评价（评价档案表：姓名,道德,学业,健康,艺术,劳动）
  const rng3 = rng(20260903);
  const levels = ['优','良','中'];
  const quality = students.map((s) => {
    if (s.name === '谭悦瑶') return ['谭悦瑶', '优', '优', '优', '良', '优'];
    const r1 = levels[Math.floor(rng3() * 3)], r2 = levels[Math.floor(rng3() * 3)], r3 = levels[Math.floor(rng3() * 3)], r4 = levels[Math.floor(rng3() * 3)], r5 = levels[Math.floor(rng3() * 3)];
    return [s.name, r1, r2, r3, r4, r5];
  });
  fs.writeFileSync(path.join(outDir, '04_综合素质评价_高一8班.csv'), csv([
    ['姓名','道德','学业','健康','艺术','劳动'], ...quality
  ]), 'utf8');

  // 5) 选科意向（意向名单表：姓名,首选,再选组合）
  const rng4 = rng(20260904);
  const COMBOS = ['物理+化学+生物','物理+化学+地理','物理+生物+地理','物理+政治+地理','历史+政治+地理','历史+化学+生物','历史+政治+生物'];
  const sel = students.map((s) => {
    if (s.name === '谭悦瑶') return ['谭悦瑶', '物理', '物理+化学+生物'];
    const first = rng4() < 0.54 ? '物理' : '历史';
    const pool = first === '物理' ? COMBOS.slice(0, 4) : COMBOS.slice(4);
    return [s.name, first, pool[Math.floor(rng4() * pool.length)]];
  });
  fs.writeFileSync(path.join(outDir, '05_选科意向_高一8班.csv'), csv([
    ['姓名','首选','再选组合'], ...sel
  ]), 'utf8');

  // 说明
  fs.writeFileSync(path.join(outDir, '说明.txt'),
    '教务系统测试数据（高一(8)班 · 50 人新生班级）\n' +
    '记录点：谭悦瑶（学生名单第 1 行；宿舍 A101 舍长；考勤含迟到记录；综评 优优优良优；选科 物理+化学+生物）\n' +
    '文件均按工作台可编辑表格的导入格式生成（UTF-8 + BOM、表头一致、列数一致），\n' +
    '在工作台对应模块点击"导入 CSV"后选择"替换导入"即可。\n' +
    '生成脚本：gen_test_csv.js（可重复运行，数据确定性）。\n',
    'utf8');

  console.log(JSON.stringify({ ok: true, dir: outDir, students: students.length, rooms: rooms.length, hasRecordPoint: !!ty }, null, 2));
}

main();
