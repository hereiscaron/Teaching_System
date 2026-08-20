#!/usr/bin/env node
/* ============================================================
 * 教师工作台 · 本地服务（纯 Node 标准库，零 npm 依赖）
 * 职责：
 *   1. 静态托管 app/ 前端
 *   2. JSON 文件仓库（data/records/）：见 lib/store.js 的数据约定
 *   3. 附件仓库（data/attachments/）：真实文件 + 元数据
 *   4. REST API：store 读写/导出/导入/清空 + 附件 + 健康检查
 * 可迁移性：所有路径相对本文件所在目录解析；整个文件夹可整体拷贝。
 * 安全边界：仅绑定 127.0.0.1；键名校验；路径穿越防护；写入原子化。
 * ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store.js');
const weeklyParse = require('./lib/weekly-parse.js');

const ROOT = __dirname;
const VERSION = '1.0.0';
const CFG = store.loadConfig(ROOT);
const MAX_BODY = 200 * 1024 * 1024; // 200MB（含附件导入）

store.ensureDirs(CFG);

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg;
  try { fs.appendFileSync(CFG.LOG_FILE, line + '\n'); } catch (e) {}
  console.log(line);
}
function mimeFor(p) {
  const m = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf' };
  return m[path.extname(p).toLowerCase()] || 'application/octet-stream';
}
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('请求体超过 200MB 上限')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(Buffer.concat(chunks).toString('utf8')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://' + (req.headers.host || '127.0.0.1'));
  const p = decodeURIComponent(url.pathname);
  const q = url.searchParams;
  const method = req.method.toUpperCase();

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // --- API ---
  if (p === '/api/health' && method === 'GET') {
    sendJSON(res, 200, { ok: true, name: '教师工作台', version: VERSION, schemaVersion: store.SCHEMA_VERSION, format: store.BACKUP_FORMAT, host: CFG.host, port: CFG.port, dataDir: CFG.DATA, time: new Date().toISOString() });
    return;
  }
  if (p === '/api/store' && method === 'GET') {
    const keys = store.allKeys(CFG).map((k) => { const e = store.readEnvelope(CFG, k); return { key: k, bytes: fs.statSync(store.fileFor(CFG, k)).size, version: e ? e.version : null, updatedAt: e ? e.updatedAt : null }; });
    sendJSON(res, 200, { ok: true, count: keys.length, keys });
    return;
  }
  const storeMatch = p.match(/^\/api\/store\/([^/]+)$/);
  if (storeMatch) {
    const key = store.safeKey(storeMatch[1]);
    if (!key) { sendJSON(res, 400, { ok: false, error: '非法键名' }); return; }
    if (method === 'GET') {
      const e = store.readEnvelope(CFG, key);
      if (!e) { sendJSON(res, 404, { ok: false, error: '键不存在', key }); return; }
      sendJSON(res, 200, e);
      return;
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      let payload;
      try { payload = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: '请求体不是有效 JSON' }); return; }
      // 防御：只接受带 data 字段的信封；缺少 data 说明调用方写入了无效值（如 undefined），拒绝而不是把请求体当数据
      if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
        sendJSON(res, 400, { ok: false, error: '请求体必须包含 data 字段' });
        return;
      }
      const data = payload.data;
      try { store.writeEnvelope(CFG, key, { version: payload && payload.version ? Number(payload.version) : store.SCHEMA_VERSION, updatedAt: new Date().toISOString(), data }); }
      catch (e) { sendJSON(res, 500, { ok: false, error: '写入失败：' + String(e.message || e) }); return; }
      log('PUT store/' + key);
      sendJSON(res, 200, { ok: true, key });
      return;
    }
    if (method === 'DELETE') {
      store.deleteKey(CFG, key);
      log('DELETE store/' + key);
      sendJSON(res, 200, { ok: true, key });
      return;
    }
  }
  if (p === '/api/export' && method === 'GET') {
    const payload = store.apiExport(CFG);
    log('export keys=' + Object.keys(payload.records).length);
    sendJSON(res, 200, payload);
    return;
  }
  if (p === '/api/import' && method === 'POST') {
    const body = await readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: '请求体不是有效 JSON' }); return; }
    // 数据保护：任何导入（合并/替换）前先自动生成带时间戳的备份快照，供误操作一键恢复
    const pre = store.apiExport(CFG);
    const snapName = 'pre-import-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    try { fs.writeFileSync(path.join(CFG.BACKUP_DIR, snapName), JSON.stringify(pre, null, 2), 'utf8'); log('pre-import snapshot ' + snapName); } catch (e) { log('pre-import snapshot failed: ' + (e && e.message)); }
    const result = store.apiImport(CFG, payload, q.get('replace') === 'true');
    log('import ' + (q.get('replace') === 'true' ? 'replace' : 'merge') + ' ok=' + result.ok);
    sendJSON(res, result.ok ? 200 : 400, Object.assign({}, result, { preImportSnapshot: snapName }));
    return;
  }
  if (p === '/api/clear' && method === 'POST') {
    const body = await readBody(req);
    let payload = {};
    try { payload = JSON.parse(body); } catch (e) {}
    if (payload.confirm !== '确认清空') { sendJSON(res, 400, { ok: false, error: '确认文字不匹配' }); return; }
    // 数据保护：清空前自动生成备份快照
    const pre = store.apiExport(CFG);
    const snapName = 'pre-clear-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    try { fs.writeFileSync(path.join(CFG.BACKUP_DIR, snapName), JSON.stringify(pre, null, 2), 'utf8'); log('pre-clear snapshot ' + snapName); } catch (e) { log('pre-clear snapshot failed: ' + (e && e.message)); }
    store.allKeys(CFG).forEach((k) => store.deleteKey(CFG, k));
    log('clear all records');
    sendJSON(res, 200, { ok: true, removed: store.allKeys(CFG).length, preClearSnapshot: snapName });
    return;
  }
  if (p === '/api/backup' && method === 'POST') {
    const payload = store.apiExport(CFG);
    const name = 'homeroom-workbench-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    fs.writeFileSync(path.join(CFG.BACKUP_DIR, name), JSON.stringify(payload, null, 2), 'utf8');
    log('backup written ' + name);
    sendJSON(res, 200, { ok: true, file: name, keys: Object.keys(payload.records).length, dir: CFG.BACKUP_DIR });
    return;
  }
  if (p === '/api/attachments' && method === 'GET') {
    sendJSON(res, 200, { ok: true, count: store.listAttachments(CFG).length, files: store.listAttachments(CFG) });
    return;
  }
  if (p === '/api/attachments/export' && method === 'GET') {
    const files = store.listAttachments(CFG).map((meta) => {
      const filePath = path.join(CFG.ATTACH_DIR, meta.file);
      if (!fs.existsSync(filePath)) return null;
      const buf = fs.readFileSync(filePath);
      const dataURL = 'data:' + meta.type + ';base64,' + buf.toString('base64');
      return { id: meta.id, name: meta.name, type: meta.type, size: meta.size, lastModified: meta.savedAt ? Date.parse(meta.savedAt) : Date.now(), savedAt: meta.savedAt, metadata: meta.metadata || {}, dataURL };
    }).filter(Boolean);
    log('attachments export count=' + files.length);
    sendJSON(res, 200, { ok: true, count: files.length, files });
    return;
  }
  if (p === '/api/attachments/import' && method === 'POST') {
    const body = await readBody(req);
    let records;
    try { records = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: '请求体不是有效 JSON' }); return; }
    records = Array.isArray(records) ? records : [];
    if (records.length > 500) { sendJSON(res, 400, { ok: false, error: '附件数量超过 500 个，已拒绝导入' }); return; }
    const prepared = [];
    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      if (!record || typeof record.id !== 'string' || !record.id || typeof record.dataURL !== 'string' || record.dataURL.indexOf('data:') !== 0) {
        sendJSON(res, 400, { ok: false, error: '第 ' + (i + 1) + ' 个附件记录无效' }); return;
      }
      const m = record.dataURL.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
      if (!m) { sendJSON(res, 400, { ok: false, error: '第 ' + (i + 1) + ' 个附件 dataURL 无效' }); return; }
      const type = m[1] || record.type || 'application/octet-stream';
      const buf = m[2] === ';base64' ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
      if (buf.length > 70 * 1024 * 1024) { sendJSON(res, 400, { ok: false, error: '附件"' + String(record.name || record.id) + '"超过可导入大小' }); return; }
      prepared.push({ id: String(record.id), name: String(record.name || '未命名附件'), type, size: buf.length, buf, savedAt: record.savedAt || new Date().toISOString(), metadata: record.metadata || {} });
    }
    const before = store.listAttachments(CFG);
    const written = [];
    try {
      for (const rec of prepared) {
        const ext = (path.extname(rec.name) || '.bin').slice(0, 16);
        const filePath = path.join(CFG.ATTACH_DIR, rec.id + ext);
        fs.writeFileSync(filePath, rec.buf);
        fs.writeFileSync(path.join(CFG.ATTACH_DIR, rec.id + '.json'), JSON.stringify({ id: rec.id, name: rec.name, type: rec.type, size: rec.size, ext, savedAt: rec.savedAt, metadata: rec.metadata, file: path.basename(filePath) }, null, 2), 'utf8');
        written.push({ id: rec.id, file: path.basename(filePath) });
      }
      if (q.get('replace') === 'true') {
        before.forEach((meta) => {
          try { fs.unlinkSync(path.join(CFG.ATTACH_DIR, meta.file)); } catch (e) {}
          try { fs.unlinkSync(path.join(CFG.ATTACH_DIR, meta.id + '.json')); } catch (e) {}
        });
      }
      log('attachments import count=' + prepared.length);
      sendJSON(res, 200, { ok: true, imported: prepared.length });
      return;
    } catch (err) {
      written.forEach((w) => { try { fs.unlinkSync(path.join(CFG.ATTACH_DIR, w.file)); } catch (e) {} try { fs.unlinkSync(path.join(CFG.ATTACH_DIR, w.id + '.json')); } catch (e) {} });
      sendJSON(res, 500, { ok: false, error: '附件导入失败，已回滚：' + String(err.message || err) });
      return;
    }
  }
  /* ---------------- 周作业模板解析（见 lib/weekly-parse.js） ---------------- */

const attMatch = p.match(/^\/api\/attachments\/([^/]+)$/);
  if (attMatch) {
    const id = store.safeKey(attMatch[1]);
    if (!id) { sendJSON(res, 400, { ok: false, error: '非法附件ID' }); return; }
    if (method === 'PUT') {
      const body = await readBody(req);
      let payload;
      try { payload = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: '请求体不是有效 JSON' }); return; }
      const dataURL = String(payload.dataURL || '');
      const m = dataURL.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
      if (!m) { sendJSON(res, 400, { ok: false, error: 'dataURL 格式无效' }); return; }
      const type = m[1] || payload.type || 'application/octet-stream';
      const isB64 = m[2] === ';base64';
      const buf = isB64 ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
      if (buf.length > 70 * 1024 * 1024) { sendJSON(res, 400, { ok: false, error: '附件超过 70MB 上限' }); return; }
      const ext = (path.extname(String(payload.name || 'file')) || '.bin').slice(0, 16);
      const filePath = path.join(CFG.ATTACH_DIR, id + ext);
      fs.writeFileSync(filePath, buf);
      const meta = { id, name: String(payload.name || '未命名附件'), type, size: buf.length, ext, savedAt: new Date().toISOString(), file: path.basename(filePath) };
      fs.writeFileSync(path.join(CFG.ATTACH_DIR, id + '.json'), JSON.stringify(meta, null, 2), 'utf8');
      log('PUT attachment ' + id + ' (' + buf.length + 'B)');
      sendJSON(res, 200, { ok: true, id, size: buf.length, file: meta.file });
      return;
    }
    if (method === 'GET') {
      const meta = store.listAttachments(CFG).find((a) => a.id === id);
      if (!meta) { sendJSON(res, 404, { ok: false, error: '附件不存在' }); return; }
      const filePath = path.join(CFG.ATTACH_DIR, meta.file);
      if (!fs.existsSync(filePath)) { sendJSON(res, 404, { ok: false, error: '附件文件缺失' }); return; }
      res.writeHead(200, { 'Content-Type': mimeFor(filePath), 'Content-Disposition': 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(meta.name), 'Cache-Control': 'no-store' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    if (method === 'DELETE') {
      const meta = store.listAttachments(CFG).find((a) => a.id === id);
      try { if (meta) fs.unlinkSync(path.join(CFG.ATTACH_DIR, meta.file)); } catch (e) {}
      try { fs.unlinkSync(path.join(CFG.ATTACH_DIR, id + '.json')); } catch (e) {}
      sendJSON(res, 200, { ok: true, id });
      return;
    }
  }
  if (p === '/api/parse-weekly' && method === 'POST') {
    const body = await readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: '请求体不是有效 JSON' }); return; }
    const name = String(payload.name || '');
    let grid = null, format = 'none';
    try {
      if (/\.xlsx$/i.test(name)) {
        const buf = Buffer.from(String(payload.base64 || ''), 'base64');
        if (!buf.length) { sendJSON(res, 400, { ok: false, error: '文件内容为空' }); return; }
        grid = weeklyParse.xlsxGrid(buf);
        if (!grid) { sendJSON(res, 400, { ok: false, error: '无法解析 xlsx（缺少工作表）' }); return; }
      } else {
        grid = weeklyParse.csvGrid(String(payload.text || ''));
      }
      const parsed = weeklyParse.parseWeeklyGrid(grid);
      format = parsed.format;
      if (format === 'none') { sendJSON(res, 400, { ok: false, error: '未识别到周作业表格结构：需含「班级」表头（模板：班级,班主任,班主任学科,政治课代表,第X周,周一~周五）或原版「高一各班记录跟踪」布局' }); return; }
      sendJSON(res, 200, { ok: true, format, count: parsed.rows.length, rows: parsed.rows });
      return;
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: '解析失败：' + String(e && e.message || e) });
      return;
    }
  }

  // --- 静态文件（仅限 app 目录内，防路径穿越） ---
  const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
  const file = path.resolve(CFG.APP, rel);
  if (file !== CFG.APP && !file.startsWith(CFG.APP + path.sep)) { sendJSON(res, 403, { ok: false, error: '禁止访问' }); return; }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': mimeFor(file), 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  sendJSON(res, 404, { ok: false, error: '资源不存在' });
}

// ---------- 启动 ----------
const PID_FILE = path.join(CFG.DATA, 'server.pid');
const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => { try { sendJSON(res, 500, { ok: false, error: String(err && err.message || err) }); } catch (e) {} });
});
server.listen(CFG.port, CFG.host, () => {
  try { fs.writeFileSync(PID_FILE, String(process.pid), 'utf8'); } catch (e) {}
  log('教师工作台已启动 → http://' + CFG.host + ':' + CFG.port + '  数据目录: ' + CFG.DATA);
});
server.on('error', (err) => { log('启动失败: ' + (err && err.message)); process.exitCode = 1; });
process.on('exit', () => { try { fs.unlinkSync(PID_FILE); } catch (e) {} });
