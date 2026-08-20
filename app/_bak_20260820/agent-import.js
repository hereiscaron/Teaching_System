#!/usr/bin/env node
/* ============================================================
 * 教师工作台 · Agent 数据导入工具（供 WorkBuddy/CodeBuddy/任何 AI agent 调用）
 *
 * 为什么需要它：
 *   系统有两套存储 —— 业务键（渲染/统计/查看读这里）和
 *   editable_tables_v2（前端可编辑表格的显示源）。直接写业务键，
 *   学生/选科/作业/考勤这 4 个模块的表格不会刷新（显示源不同）。
 *   本工具自动"双写"，保证 agent 导入的数据立即可见、统计联动。
 *
 * 用法：
 *   node agent-import.js <表名> <csv文件> [--class cX] [--append|--replace]
 *   node agent-import.js <表名> <json文件> [--class cX] [--append|--replace]
 *   node agent-import.js list                         列出所有可用表
 *   node agent-import.js template <表名>              打印该表 CSV 模板
 *   node agent-import.js export <表名> [--class cX]   导出当前数据为 CSV
 *
 * 说明：
 *   --append  追加（默认，不覆盖现有数据）
 *   --replace 整体替换（先自动备份到 data/backup/，可恢复）
 *   --class   班级 id（默认 c1；学校/教务全局表忽略此参数）
 *   导入前自动快照到 data/backup/pre-import-*.json，导入失败自动回滚。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const store = require('./lib/store.js');

const ROOT = __dirname;
const CFG = store.loadConfig(ROOT);

/* ---------------- 表定义：字段顺序 = CSV 列顺序 ---------------- */
const CLASS_TABLES = {
  students:    { key: 'students',      module: 'students',   editable: true,  fields: [['姓名','name'],['学籍号','id'],['性别','gender'],['学籍状态','status'],['宿舍','dorm'],['家长','parent'],['联系电话','phone'],['重点标记','focusMark']] },
  attendance:  { key: 'attendance',    module: 'attendance', editable: true,  fields: [['日期','date'],['学生','name'],['类型','type'],['备注','note']] },
  homework:    { key: 'homework',      module: 'homework',   editable: true,  fields: [['学科','subject'],['日期','date'],['内容','content'],['时长(分)','minutes'],['难度','difficulty']] },
  selection:   { key: 'selection',     module: 'selection',  editable: true,  fields: [['姓名','name'],['首选','first'],['再选组合','combos']] },
  exams:       { key: 'exams',         module: 'scores',     editable: false, special: 'exams', fields: [['考试名','name'],['考试日期','date']] },
  affairs:     { key: 'affairs',       module: 'affairs',    editable: false, fields: [['日期','date'],['标题','title'],['类型','kind'],['备注','note']] },
  tasks:       { key: 'tasks',         module: 'dashboard',  editable: false, fields: [['标题','title'],['截止','due'],['类型','kind'],['状态','status']] },
  meetings:    { key: 'meetings',      module: 'meeting',    editable: false, fields: [['日期','date'],['主题','topic'],['内容','content'],['状态','status']] },
  meeting_plan:{ key: 'meeting_plan',  module: 'meeting',    editable: false, fields: [['日期','date'],['主题','topic'],['目标','goal']] },
  family:      { key: 'family',        module: 'family',     editable: false, fields: [['日期','date'],['方式','type'],['对象','target'],['沟通内容','content'],['家长反馈','feedback'],['状态','status']] },
  parent_meetings:{ key: 'parent_meetings', module: 'family', editable: false, fields: [['日期','date'],['主题','topic'],['出勤','attendance'],['内容','content'],['状态','status']] },
  family_plan: { key: 'family_plan',   module: 'family',     editable: false, fields: [['日期','date'],['对象','target'],['原因','reason']] },
  dorm:        { key: 'dorm',          module: 'dorm',       editable: false, fields: [['宿舍号','room'],['成员名单','members'],['舍长','leader'],['备注','note']] },
  dorm_visits: { key: 'dorm_visits',   module: 'dorm',       editable: false, fields: [['日期','date'],['宿舍','room'],['备注','note']] },
  mental:      { key: 'mental',        module: 'mental',     editable: false, fields: [['学生','name'],['等级','level'],['关注原因','reason']] },
  quality:     { key: 'quality',       module: 'quality',    editable: false, fields: [['姓名','name'],['道德','moral'],['学业','academic'],['健康','health'],['艺术','art'],['劳动','labor']] },
  cleaning:    { key: 'cleaning',      module: 'cleaning',   editable: false, fields: [['星期','week'],['值日学生','members'],['值日内容','task']] },
  points:      { key: 'points',        module: 'points',     editable: false, special: 'points', fields: [['姓名','name'],['变动分','delta'],['原因','reason'],['时间','time']] }
};
const GLOBAL_TABLES = {
  grade:     { key: 'grade_matters',  fields: [['日期','date'],['事项','title'],['负责','owner'],['状态','status']] },
  notice:    { key: 'notices',        fields: [['日期','date'],['标题','title'],['来源','from'],['重要度','status']] },
  duty:      { key: 'duty_schedule',  fields: [['日期','date'],['类型','type'],['人员','person'],['地点','location'],['状态','status']] },
  awards:    { key: 'awards',         fields: [['学生','name'],['荣誉','honor'],['级别','level'],['状态','status']] },
  safety:    { key: 'safety',         fields: [['事项','item'],['对象/范围','scope'],['状态','status']] },
  hygiene:   { key: 'hygiene',        fields: [['事项','item'],['对象/范围','scope'],['状态','status']] },
  personal:  { key: 'personal',       fields: [['事项','item'],['状态','status']] },
  forms:     { key: 'form_tasks',     fields: [['任务','title'],['来源单位','source'],['截止时间','due'],['字段数','fields'],['预计耗时','time'],['网址/位置','url'],['状态','status']] },
  weekly:    { key: 'weekly_homework', fields: [['班级','cls'],['班主任','head'],['班主任学科','subject'],['政治课代表','rep'],['第X周','week'],['周一','mon'],['周二','tue'],['周三','wed'],['周四','thu'],['周五','fri']], special: 'weekly' }
};
const ALL = Object.assign({}, CLASS_TABLES, GLOBAL_TABLES);
/* ---------------- 工具 ---------------- */
function err(msg) { console.error('✗ ' + msg); process.exitCode = 1; }
function out(o) { console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 2)); }
function ck(base, classId) { return base + '_' + classId; }
function readKey(base, classId, fallback) {
  const k = classId ? ck(base, classId) : base;
  const v = store.readEnvelope(CFG, k);
  return v && v.data !== undefined ? v.data : fallback;
}
function writeKey(base, classId, data) {
  const k = classId ? ck(base, classId) : base;
  store.writeEnvelope(CFG, k, { version: store.SCHEMA_VERSION, updatedAt: new Date().toISOString(), data });
}
/* 导入前快照 + 失败回滚 */
function withSnapshot(fn) {
  const pre = store.apiExport(CFG);
  const snap = 'pre-import-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  try { fs.writeFileSync(path.join(CFG.BACKUP_DIR, snap), JSON.stringify(pre, null, 2), 'utf8'); } catch (e) {}
  try {
    const result = fn();
    console.log('已自动快照: data/backup/' + snap + ' （导入出问题可从这里恢复）');
    return result;
  } catch (e) {
    // 回滚：恢复快照前的状态
    try { store.apiImport(CFG, pre, true); } catch (e2) {}
    throw e;
  }
}
/* CSV 解析（支持引号/换行/逗号） */
function parseCSV(input) {
  const source = String(input || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (quoted && ch === '"' && next === '"') { cur += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ',') { row.push(cur); cur = ''; }
    else if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cur); cur = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur); if (row.some(x => x.trim() !== '')) rows.push(row);
  if (quoted) throw new Error('CSV 引号未闭合');
  return rows;
}
function toCSV(headers, rows) {
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  return '\uFEFF' + [headers].concat(rows).map(r => r.map(esc).join(',')).join('\n');
}
/* 行数组 -> 业务对象（students 等有默认值/类型转换） */
function rowToObj(def, row, targetClass) {
  const o = {};
  def.fields.forEach((f, i) => { o[f[1]] = (row[i] == null ? '' : String(row[i]).trim()); });
  if (def.key === 'students') {
    o.focus = /关注/.test(o.focusMark) ? 2 : 0;
    o.focusReason = '';
    delete o.focusMark;
    // 全局班级代码：导入时按目标班级标记（多班级管理时跨模块区分学生）
    o.classId = targetClass || 'c1';
  }
  if (def.key === 'attendance') {
    const type = String(o.type || '').replace(/（已销假）|\(已销假\)/g, '').trim();
    o.settled = /销假/.test(String(o.type || '')) || /已销假/.test(String(row[2] || ''));
    o.type = type;
  }
  if (def.key === 'homework') o.minutes = Number(o.minutes) || 0;
  if (def.key === 'mental') o.level = /L?2/.test(o.level) ? 2 : 1;
  if (def.key === 'quality') { o.comment = ''; }
  if (def.key === 'forms') {
    o.fields = Number(o.fields) || 0;
    o.white = true;
    o.done = /已完成/.test(o.status || '');
    delete o.status;
  }
  return o;
}
/* 同步 editable_tables_v2（学生/选科/作业/考勤的表格显示源） */
function syncEditable(def, classId, objs) {
  if (!def.editable) return;
  const context = (def.module === 'selection' ? 'teaching' : 'teaching') + '|' + classId + '|' + def.module;
  const tableKey = context + '::table_0';
  const rows = objs.map(o => def.fields.map(f => o[f[1]] == null ? '' : String(o[f[1]])));
  store.updateEditable(CFG, tableKey, rows);
}

/* ---------------- 命令 ---------------- */
function cmdList() {
  out('班级级表格（需 --class cX，默认 c1）：');
  Object.keys(CLASS_TABLES).forEach(k => out('  ' + k.padEnd(16) + '= ' + CLASS_TABLES[k].fields.map(f => f[0]).join(' / ')));
  out('学校/教务全局表格（跨班级共享）：');
  Object.keys(GLOBAL_TABLES).forEach(k => out('  ' + k.padEnd(16) + '= ' + GLOBAL_TABLES[k].fields.map(f => f[0]).join(' / ')));
}
function cmdTemplate(name) {
  const def = ALL[name];
  if (!def) return err('未知表：' + name + '（用 list 查看）');
  out(def.fields.map(f => f[0]).join(','));
}
function cmdExport(name, classId) {
  const def = ALL[name];
  if (!def) return err('未知表：' + name);
  const data = readKey(def.key, CLASS_TABLES[name] ? classId : null, []);
  if (def.special === 'points') {
    // points 嵌套 logs，展平成"一行一条记录"
    const rows = [];
    (Array.isArray(data) ? data : []).forEach((p) => {
      (p.logs || []).forEach((l) => { rows.push([p.name, l.delta, l.reason, l.time]); });
    });
    process.stdout.write(toCSV(def.fields.map(f => f[0]), rows));
    return;
  }
  if (def.special === 'weekly') {
    // weekly 是 [{cls,head,subject,rep,week,days:{周一..周五}}]，展平成一行
    const rows = (Array.isArray(data) ? data : []).map((o) => {
      const d = o.days || {};
      return [o.cls, o.head, o.subject, o.rep, o.week, d['周一'], d['周二'], d['周三'], d['周四'], d['周五']];
    });
    process.stdout.write(toCSV(def.fields.map(f => f[0]), rows));
    return;
  }
  const rows = Array.isArray(data) ? data.map(o => def.fields.map(f => o[f[1]] == null ? '' : o[f[1]])) : [];
  process.stdout.write(toCSV(def.fields.map(f => f[0]), rows));
}
function cmdImport(name, file, classId, mode) {
  const def = ALL[name];
  if (!def) return err('未知表：' + name + '（用 list 查看）');
  const isClass = !!CLASS_TABLES[name];
  const targetClass = isClass ? (classId || 'c1') : null;
  if (!fs.existsSync(file)) return err('文件不存在：' + file);

  withSnapshot(() => {
    let parsed;
    if (/\.csv$/i.test(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const rows = parseCSV(raw);
      // 首行匹配表头则跳过
      const headers = def.fields.map(f => f[0]);
      const first = rows[0] || [];
      const match = first.filter((v, i) => v === headers[i]).length >= Math.max(1, Math.floor(headers.length / 2));
      const body = match ? rows.slice(1) : rows;
      parsed = body.map(r => rowToObj(def, r, targetClass));
    } else {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(parsed)) parsed = [parsed];
      parsed = parsed.map(o => {
        const out = {};
        def.fields.forEach(f => { out[f[1]] = o[f[1]] != null ? o[f[1]] : ''; });
        if (def.key === 'students') {
          out.focus = /关注/.test(out.focusMark) ? 2 : 0;
          out.focusReason = '';
          delete out.focusMark;
          out.classId = targetClass || 'c1';
        }
        return out;
      });
    }
    if (!parsed.length) throw new Error('文件没有有效数据');

    let existing = readKey(def.key, targetClass, []);
    if (!Array.isArray(existing)) existing = [];
    let next = mode === 'replace' ? parsed : existing.concat(parsed);

    if (def.special === 'exams') {
      // exams 是 [{id,name,date,scores:[...]}]，CSV 只导考试框架；成绩用 JSON
      const now = Date.now().toString(36);
      next.forEach((e, i) => { if (!e.id) e.id = 'ex_' + now + '_' + i; e.scores = e.scores || []; });
    }
    if (def.special === 'points') {
      // points 是 [{name, logs:[{delta,reason,time}]}]；CSV 一行 = 一条加减分记录，按学生聚合
      const byName = {};
      parsed.forEach((r) => {
        const delta = Number(r.delta) || 0;
        if (!delta || !r.name) return;
        const name = String(r.name).trim();
        if (!byName[name]) byName[name] = { name: name, logs: [] };
        byName[name].logs.push({ delta: delta, reason: r.reason || '', time: r.time || '' });
      });
      const merged = Object.keys(byName).map((k) => byName[k]);
      const existingMap = {};
      (mode === 'replace' ? [] : existing).forEach((p) => { if (p && p.name) existingMap[p.name] = p; });
      Object.keys(existingMap).forEach((k) => { if (byName[k]) existingMap[k].logs = existingMap[k].logs.concat(byName[k].logs); });
      Object.keys(byName).forEach((k) => { if (!existingMap[k]) existingMap[k] = byName[k]; });
      next = Object.keys(existingMap).map((k) => existingMap[k]);
    }
    if (def.special === 'weekly') {
      // weekly 是 [{cls,head,subject,rep,week,days:{周一..周五}}]；CSV 一行 = 一个班一周
      const DAYS = ['周一', '周二', '周三', '周四', '周五'];
      const MAP = { 周一: 'mon', 周二: 'tue', 周三: 'wed', 周四: 'thu', 周五: 'fri' };
      next = next.map((o) => {
        const days = {};
        DAYS.forEach((d) => { days[d] = o[MAP[d]] != null ? String(o[MAP[d]]).trim() : ''; });
        return { cls: o.cls, head: o.head, subject: o.subject, rep: o.rep, week: o.week, days };
      });
    }
    writeKey(def.key, targetClass, next);
    if (def.editable) syncEditable(def, targetClass, next);
    out({ ok: true, table: name, classId: targetClass || '全局', mode: mode, imported: parsed.length, total: next.length });
  });
}

/* ---------------- main ---------------- */
(async () => {
  const [cmd, a1, a2, a3, a4] = process.argv.slice(2);
  const argVal = (flag) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
  };
  const has = (flag) => process.argv.indexOf(flag) >= 0;
  store.ensureDirs(CFG);
  switch (cmd) {
    case 'list': cmdList(); break;
    case 'template': cmdTemplate(a1); break;
    case 'export': cmdExport(a1, argVal('--class')); break;
    case 'import':
      if (!a1 || !a2) return err('用法: node agent-import.js import <表名> <csv|json文件> [--class cX] [--append|--replace]');
      cmdImport(a1, a2, argVal('--class'), has('--replace') ? 'replace' : 'append');
      break;
    default:
      console.log('教师工作台 Agent 数据导入工具\n用法:\n  node agent-import.js list\n  node agent-import.js template <表名>\n  node agent-import.js export <表名> [--class cX]\n  node agent-import.js import <表名> <文件> [--class cX] [--append|--replace]\n运行 "node agent-import.js list" 查看全部表。');
  }
})();
