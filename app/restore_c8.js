/* 从桌面教务系统测试 CSV 重建高一(8)班 c8 数据（CLI 直写磁盘仓库） */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = 'C:\\Users\\Administrator\\Desktop\\教务系统测试';
const store = require(path.join(__dirname, 'lib', 'store.js'));
const CFG = store.loadConfig(__dirname);
store.ensureDirs(CFG);

function parseCSV(file) {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8').replace(/^\uFEFF/, '');
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i], next = raw[i + 1];
    if (quoted && ch === '"' && next === '"') { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ',') { row.push(value); value = ''; }
    else if (!quoted && (ch === '\n' || ch === '\r')) { if (ch === '\r' && next === '\n') i++; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
    else value += ch;
  }
  row.push(value); if (row.some(Boolean)) rows.push(row);
  return rows;
}

const students = parseCSV('01_学生名单_高一8班.csv').slice(1); // 去表头
const attendance = parseCSV('02_异常考勤_高一8班.csv').slice(1);
const dorm = parseCSV('03_宿舍信息_高一8班.csv').slice(1);
const quality = parseCSV('04_综合素质评价_高一8班.csv').slice(1);
const selection = parseCSV('05_选科意向_高一8班.csv').slice(1);

store.writeEnvelope(CFG, 'classes', { version: 2, updatedAt: new Date().toISOString(), data: [{ id: 'c1', name: '高一(1)班' }, { id: 'c8', name: '高一(8)班' }] });
store.writeEnvelope(CFG, 'editable_tables_v2', { version: 2, updatedAt: new Date().toISOString(), data: {
  'teaching|c8|students::table_0': students,
  'teaching|c8|attendance::table_0': attendance,
  'teaching|c8|dorm::table_0': dorm,
  'teaching|c8|dorm::table_1': [],
  'teaching|c8|quality::table_0': quality,
  'teaching|c8|selection::table_0': selection
} });
const studentObjects = students.map((r) => ({
  name: r[0], id: r[1], gender: r[2], status: r[3], dorm: r[4], parent: r[5], phone: r[6],
  focus: /关注/.test(r[7] || '') ? 2 : 0, focusReason: ''
}));
store.writeEnvelope(CFG, 'students_c8', { version: 2, updatedAt: new Date().toISOString(), data: studentObjects });

const out = {
  students: studentObjects.length,
  hasRecordPoint: studentObjects.some((s) => s.name === '谭悦瑶'),
  attendance: attendance.length, dorm: dorm.length, quality: quality.length, selection: selection.length,
  editableKeys: Object.keys(store.readEnvelope(CFG, 'editable_tables_v2').data)
};
console.log(JSON.stringify(out, null, 2));
