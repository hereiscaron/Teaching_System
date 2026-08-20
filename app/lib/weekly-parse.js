/* ============================================================
 * 教师工作台 · 周作业模板解析器（零依赖：Node 标准库）
 * 支持两种布局：
 *   A. 简化模板（templates/27-周作业跟踪.csv）：
 *      表头 班级,班主任,班主任学科,政治课代表,第X周,周一~周五
 *   B. 原 excel「高一各班记录跟踪」布局：
 *      行1=周次表头（合并单元格），行2=日期（9.1一），行3起=每班一行
 * ============================================================ */
'use strict';
const zlib = require('zlib');

/* zip 中央目录定位（xlsx 为 zip 容器） */
function zipEntry(buf, wanted) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    if (name === wanted || name === '/' + wanted) {
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) return data; // stored
      if (method === 8) { try { return zlib.inflateRawSync(data); } catch (e) { return null; } }
      return null;
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
function xmlTexts(xml) {
  const out = [];
  const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}
function xlsxGrid(buf) {
  const ssRaw = zipEntry(buf, 'xl/sharedStrings.xml');
  const shRaw = zipEntry(buf, 'xl/worksheets/sheet1.xml');
  if (!shRaw) return null;
  const ssXml = ssRaw ? ssRaw.toString('utf8') : '';
  const sst = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let sm;
  while ((sm = siRe.exec(ssXml))) sst.push(xmlTexts(sm[1]).join(''));
  const dec = (s) => String(s == null ? '' : s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&#10;/g, '\n').replace(/&#13;/g, '');
  const shXml = shRaw.toString('utf8');
  const cells = {};
  const cRe = /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let cm;
  while ((cm = cRe.exec(shXml))) {
    const ref = cm[1], attrs = cm[2], body = cm[3] || '';
    let val = '';
    if (/t="s"/.test(attrs)) {
      const vm = body.match(/<v>(\d+)<\/v>/);
      if (vm) val = sst[Number(vm[1])] != null ? sst[Number(vm[1])] : '';
    } else if (/t="inlineStr"/.test(attrs)) {
      val = xmlTexts(body).join('');
    } else {
      const vm = body.match(/<v>([\s\S]*?)<\/v>/);
      if (vm) val = vm[1];
    }
    cells[ref] = dec(val);
  }
  const colIdx = (ref) => {
    let n = 0;
    for (const ch of ref.replace(/\d/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const rows = {};
  for (const ref of Object.keys(cells)) {
    const r = Number(ref.replace(/[A-Z]/g, ''));
    const c = colIdx(ref);
    if (!rows[r]) rows[r] = [];
    rows[r][c] = cells[ref];
  }
  const maxR = Math.max.apply(null, Object.keys(rows).map(Number));
  const grid = [];
  for (let r = 1; r <= maxR; r++) {
    const row = rows[r] || [];
    const len = row.length;
    for (let i = 0; i < len; i++) if (row[i] == null) row[i] = '';
    grid.push(row);
  }
  return grid;
}
function csvGrid(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (quoted && ch === '"' && next === '"') { cur += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ',') { row.push(cur); cur = ''; }
    else if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => String(x).trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((x) => String(x).trim() !== '')) rows.push(row);
  return rows;
}
function gridRowText(row) { return (row || []).map((c) => String(c == null ? '' : c).trim()).join('|'); }
function colAt(row, names) {
  for (let i = 0; i < (row || []).length; i++) {
    const v = String(row[i] == null ? '' : row[i]).trim();
    if (names.indexOf(v) >= 0) return i;
  }
  return -1;
}
function parseWeeklyGrid(grid) {
  const rows = grid || [];
  if (!rows.length) return { rows: [], format: 'none' };
  let headIdx = -1;
  for (let i = 0; i < Math.min(4, rows.length); i++) {
    if (colAt(rows[i], ['班级', '教学班级']) >= 0) { headIdx = i; break; }
  }
  if (headIdx >= 0) {
    const head = rows[headIdx].map((c) => String(c == null ? '' : c).trim());
    const idx = {
      cls: colAt(head, ['班级', '教学班级']),
      head: colAt(head, ['班主任']),
      subject: colAt(head, ['班主任学科', '学科']),
      rep: colAt(head, ['政治课代表', '科代表']),
      week: colAt(head, ['第X周', '周次']),
      days: {}
    };
    const dayNames = ['周一', '周二', '周三', '周四', '周五'];
    dayNames.forEach((d) => { idx.days[d] = colAt(head, [d]); });
    if (idx.cls < 0) return { rows: [], format: 'none' };
    const out = [];
    for (let i = headIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!gridRowText(r)) continue;
      const cls = String(r[idx.cls] == null ? '' : r[idx.cls]).trim();
      if (!cls) continue;
      const rec = {
        cls,
        head: idx.head >= 0 ? String(r[idx.head] == null ? '' : r[idx.head]).trim() : '',
        subject: idx.subject >= 0 ? String(r[idx.subject] == null ? '' : r[idx.subject]).trim() : '',
        rep: idx.rep >= 0 ? String(r[idx.rep] == null ? '' : r[idx.rep]).trim() : '',
        week: idx.week >= 0 ? String(r[idx.week] == null ? '' : r[idx.week]).trim() : '',
        days: {}
      };
      Object.keys(idx.days).forEach((d) => {
        const c = idx.days[d];
        rec.days[d] = c >= 0 ? String(r[c] == null ? '' : r[c]).trim() : '';
      });
      out.push(rec);
    }
    return { rows: out, format: 'template' };
  }
  const weekRow = rows[0] || [];
  const dateRow = rows[1] || [];
  const isDateLike = dateRow.some((c) => /^\d{1,2}\.\d{1,2}/.test(String(c).trim()));
  const firstClassRow = rows[2] || [];
  const hasWeekHead = weekRow.some((c) => /周|考|补班|未完成/.test(String(c).trim()));
  const hasClassData = firstClassRow.length > 0 && /班$/.test(String(firstClassRow[0] || '').trim());
  if (isDateLike && hasWeekHead && hasClassData) {
    const weekStarts = [];
    weekRow.forEach((v, i) => { const t = String(v == null ? '' : v).trim(); if (t && /周|考|补班|未完成/.test(t)) weekStarts.push({ col: i, name: t }); });
    const out = [];
    for (let r = 2; r < rows.length; r++) {
      const line = rows[r];
      if (!gridRowText(line)) continue;
      const cls = String(line[0] == null ? '' : line[0]).trim();
      if (!cls) continue;
      const base = { cls, head: String(line[1] == null ? '' : line[1]).trim(), subject: String(line[2] == null ? '' : line[2]).trim(), rep: String(line[3] == null ? '' : line[3]).trim() };
      weekStarts.forEach((ws, wi) => {
        const end = wi + 1 < weekStarts.length ? weekStarts[wi + 1].col : line.length;
        const rec = Object.assign({ week: ws.name, days: { 周一: '', 周二: '', 周三: '', 周四: '', 周五: '' } }, base);
        const dayMap = { 一: '周一', 二: '周二', 三: '周三', 四: '周四', 五: '周五' };
        for (let c = ws.col; c < end && c < line.length; c++) {
          const dt = String(dateRow[c] == null ? '' : dateRow[c]).trim();
          const dm = dt.match(/([一二三四五])$/);
          if (dm && dayMap[dm[1]]) {
            const v = String(line[c] == null ? '' : line[c]).trim();
            if (v && !rec.days[dayMap[dm[1]]]) rec.days[dayMap[dm[1]]] = v;
          }
        }
        out.push(rec);
      });
    }
    if (out.length) return { rows: out, format: 'original' };
  }
  return { rows: [], format: 'none' };
}

module.exports = { zipEntry, xlsxGrid, csvGrid, parseWeeklyGrid };
