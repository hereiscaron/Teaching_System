/* ============================================================
 * 共享存储模块：JSON 文件仓库（CLI 与服务端共用的唯一数据约定）
 * 约定：
 *   - 每个存储键一个文件 data/records/<key>.json，内容为信封
 *     {version, updatedAt, data}
 *   - 键名仅允许 [A-Za-z0-9_\-.:]，文件名为键名清洗（: → _）
 *   - 导出/导入格式：{format:'homeroom-workbench-backup', records:{key:data}}
 * 纯 Node 标准库，零依赖；路径全部相对调用方传入的 ROOT 解析。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const BACKUP_FORMAT = 'homeroom-workbench-backup';
const SCHEMA_VERSION = 2;
const KEY_RE = /^[A-Za-z0-9_\-.:]+$/;
const MAX_KEYS = 2000;

function expandPath(p) {
  if (typeof p !== 'string' || !p) return p;
  // 展开用户主目录：~/xxx 或 ~\xxx
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    const home = os.homedir();
    p = p === '~' ? home : path.join(home, p.slice(2));
  }
  // 展开环境变量：${VAR} 与 %VAR% 两种写法
  p = p.replace(/\$\{([^}]+)\}/g, (_, k) => process.env[k] || '');
  p = p.replace(/%([^%]+)%/g, (_, k) => process.env[k] || '');
  return p;
}

function loadConfig(ROOT) {
  const cfgPath = path.join(ROOT, 'config.json');
  let cfg = { host: '127.0.0.1', port: 8731, appDir: 'app', dataDir: 'data' };
  try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(cfgPath, 'utf8'))); } catch (e) { /* 默认值 */ }
  if (process.env.WB_PORT) cfg.port = Number(process.env.WB_PORT) || cfg.port;
  // 热补丁/测试隔离：WB_DATA 覆盖数据目录（QA 用独立目录，不碰真实数据）
  if (process.env.WB_DATA) cfg.dataDir = String(process.env.WB_DATA);
  cfg.ROOT = ROOT;
  cfg.APP = path.resolve(ROOT, String(cfg.appDir || 'app'));
  // 数据目录与应用代码隔离：绝对路径原样用；~ / ${VAR} / %VAR% 先展开；
  // 相对路径（不含~与变量）解析为"应用根目录之外/../xxx"或相对应用根（向后兼容）。
  const rawData = String(cfg.dataDir || 'data');
  const expanded = expandPath(rawData);
  const isAbs = path.isAbsolute(expanded) || rawData.indexOf('~') === 0 || /\$\{|\%/.test(rawData);
  cfg.DATA = isAbs ? path.resolve(expanded) : path.resolve(ROOT, expanded);
  cfg.RECORDS_DIR = path.join(cfg.DATA, 'records');
  cfg.ATTACH_DIR = path.join(cfg.DATA, 'attachments');
  cfg.BACKUP_DIR = path.join(cfg.DATA, 'backup');
  cfg.LOG_FILE = path.join(cfg.DATA, 'server.log');
  return cfg;
}

function ensureDirs(cfg) {
  [cfg.RECORDS_DIR, cfg.ATTACH_DIR, cfg.BACKUP_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));
}

function safeKey(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key) || key.length > 240) return null;
  return key;
}

function fileFor(cfg, key) {
  return path.join(cfg.RECORDS_DIR, String(key).replace(/[^A-Za-z0-9_.\-]/g, '_') + '.json');
}

function readEnvelope(cfg, key) {
  const p = fileFor(cfg, key);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function writeEnvelope(cfg, key, payload) {
  const p = fileFor(cfg, key);
  const tmp = p + '.tmp-' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, p); // 原子替换
}

function allKeys(cfg) {
  if (!fs.existsSync(cfg.RECORDS_DIR)) return [];
  return fs.readdirSync(cfg.RECORDS_DIR).filter((f) => f.endsWith('.json') && !f.includes('.tmp-')).map((f) => f.replace(/\.json$/, '')).sort();
}

function deleteKey(cfg, key) {
  try { fs.unlinkSync(fileFor(cfg, key)); } catch (e) {}
}

/* 更新 editable_tables_v2 中某张表（agent 导入时同步前端可编辑表格显示源） */
function updateEditable(cfg, tableKey, rows) {
  const e = readEnvelope(cfg, 'editable_tables_v2');
  let data = e && e.data && typeof e.data === 'object' ? e.data : {};
  data[tableKey] = rows;
  writeEnvelope(cfg, 'editable_tables_v2', { version: SCHEMA_VERSION, updatedAt: new Date().toISOString(), data });
  return true;
}

function apiExport(cfg) {
  const records = {};
  allKeys(cfg).forEach((k) => { const e = readEnvelope(cfg, k); if (e && e.data !== undefined) records[k] = e.data; });
  return { format: BACKUP_FORMAT, namespace: 'homeroom_workbench', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), records };
}

function apiImport(cfg, payload, replace) {
  if (!payload || payload.format !== BACKUP_FORMAT || !payload.records || typeof payload.records !== 'object') {
    return { ok: false, error: '备份格式无效' };
  }
  const incoming = Object.keys(payload.records);
  if (incoming.length > MAX_KEYS) return { ok: false, error: '备份数据集数量异常，已拒绝导入' };
  const bad = incoming.find((k) => !safeKey(k));
  if (bad) return { ok: false, error: '备份包含非法数据键' };
  const prepared = {};
  for (const k of incoming) {
    try { prepared[k] = JSON.stringify({ version: SCHEMA_VERSION, updatedAt: new Date().toISOString(), data: payload.records[k] }); }
    catch (e) { return { ok: false, error: '备份内容无法序列化：' + String(e.message || e) }; }
  }
  const before = {};
  allKeys(cfg).forEach((k) => { before[k] = readEnvelope(cfg, k); });
  try {
    if (replace) allKeys(cfg).forEach((k) => deleteKey(cfg, k));
    for (const k of incoming) {
      const p = fileFor(cfg, k);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      const tmp = p + '.tmp-' + crypto.randomBytes(4).toString('hex');
      fs.writeFileSync(tmp, prepared[k], 'utf8');
      fs.renameSync(tmp, p);
    }
    return { ok: true, imported: incoming.length, failed: [] };
  } catch (err) {
    try {
      allKeys(cfg).forEach((k) => deleteKey(cfg, k));
      Object.keys(before).forEach((k) => { if (before[k]) writeEnvelope(cfg, k, before[k]); });
    } catch (e2) {
      return { ok: false, error: '导入失败且自动回滚未完成：' + String(err.message || err), failed: incoming };
    }
    return { ok: false, error: '导入失败，原数据已自动恢复：' + String(err.message || err), failed: incoming };
  }
}

function listAttachments(cfg) {
  if (!fs.existsSync(cfg.ATTACH_DIR)) return [];
  return fs.readdirSync(cfg.ATTACH_DIR).filter((f) => f.endsWith('.json')).map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(cfg.ATTACH_DIR, f), 'utf8')); } catch (e) { return null; }
  }).filter(Boolean).sort((a, b) => String(a.savedAt || '').localeCompare(String(b.savedAt || '')));
}

module.exports = { BACKUP_FORMAT, SCHEMA_VERSION, loadConfig, ensureDirs, safeKey, fileFor, readEnvelope, writeEnvelope, allKeys, deleteKey, updateEditable, apiExport, apiImport, listAttachments };
