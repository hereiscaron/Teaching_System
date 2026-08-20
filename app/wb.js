#!/usr/bin/env node
/* ============================================================
 * 教师工作台 · 命令行工具（AI 录入/读取数据的正式入口）
 * 用法：
 *   node wb.js status                     查看运行状态与数据概况
 *   node wb.js keys                       列出所有存储键
 *   node wb.js get <key>                  读取一个键的值
 *   node wb.js set <key> <json|@file>     写入（@file 表示从文件读取 JSON）
 *   node wb.js del <key>                  删除一个键
 *   node wb.js export [file]              导出完整备份 JSON
 *   node wb.js import <file> [--replace]  导入备份（默认合并）
 *   node wb.js migrate <file> [--replace] 迁移旧浏览器备份（自动剥离命名空间前缀）
 *   node wb.js backup                     在 data/backup/ 生成带日期备份
 *   node wb.js serve                      前台启动本地服务
 *   node wb.js start                      后台启动本地服务（写 PID）
 *   node wb.js stop                       停止本地服务
 * 说明：数据操作直接读写 data/records/ 下的信封 JSON 文件，
 *       与浏览器端通过 HTTP API 写入的是同一份数据。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const store = require('./lib/store.js');

const ROOT = __dirname;
const CFG = store.loadConfig(ROOT);

function out(obj) { console.log(JSON.stringify(obj, null, 2)); }
function err(msg) { console.error('✗ ' + msg); process.exitCode = 1; }
function readJSONFile(file) {
  if (!fs.existsSync(file)) throw new Error('文件不存在: ' + file);
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); // 剥离 UTF-8 BOM
  return JSON.parse(raw);
}

function status() {
  store.ensureDirs(CFG);
  const keys = store.allKeys(CFG);
  const attachments = store.listAttachments(CFG);
  const pidFile = path.join(CFG.DATA, 'server.pid');
  let running = false;
  try { running = fs.existsSync(pidFile) && process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 0); } catch (e) { running = false; }
  return {
    ok: true,
    name: '教师工作台',
    root: ROOT,
    app: CFG.APP,
    dataDir: CFG.DATA,
    records: keys.length,
    attachments: attachments.length,
    serverRunning: running,
    port: CFG.port,
    url: 'http://' + CFG.host + ':' + CFG.port + '/',
    schemaVersion: store.SCHEMA_VERSION,
    format: store.BACKUP_FORMAT
  };
}

function migrateLegacy(file, replace) {
  const payload = readJSONFile(file);
  if (!payload || !payload.records || typeof payload.records !== 'object') {
    throw new Error('不是有效的备份文件（缺少 records 字段）');
  }
  const converted = { format: store.BACKUP_FORMAT, namespace: 'homeroom_workbench', schemaVersion: store.SCHEMA_VERSION, exportedAt: new Date().toISOString(), records: {} };
  let stripped = 0;
  for (const k of Object.keys(payload.records)) {
    // 剥离形如 teacher_workbench:xxx / homeroom_workbench:xxx / workbench_xxx 的前缀
    let bare = k;
    const colon = k.indexOf(':');
    if (colon > 0) bare = k.slice(colon + 1);
    else {
      const m = k.match(/^(?:teacher_workbench|homeroom_workbench|workbench_[0-9a-f]+)_(.+)$/);
      if (m) { bare = m[1]; stripped++; }
    }
    converted.records[bare] = payload.records[k];
  }
  const result = store.apiImport(CFG, converted, replace);
  if (!result.ok) throw new Error(result.error || '迁移失败');
  return { ok: true, imported: result.imported, keysStripped: stripped, note: '旧备份中带命名空间前缀的键已自动剥离（如 teacher_workbench:xxx → xxx）' };
}

async function main() {
  store.ensureDirs(CFG);
  const [cmd, a1, a2, a3] = process.argv.slice(2);
  switch (cmd) {
    case 'status': out(status()); break;
    case 'keys': out({ ok: true, keys: store.allKeys(CFG) }); break;
    case 'get': {
      if (!a1) return err('用法: wb get <key>');
      const e = store.readEnvelope(CFG, a1);
      if (!e) return err('键不存在: ' + a1);
      out(e.data);
      break;
    }
    case 'set': {
      if (!a1 || !a2) return err('用法: wb set <key> <json|@file>');
      let raw = a2;
      if (raw.startsWith('@')) raw = fs.readFileSync(path.resolve(ROOT, raw.slice(1)), 'utf8').replace(/^\uFEFF/, '');
      else {
        raw = raw.trim();
        // 容忍 shell 传递时残留的外层引号
        if ((raw.length >= 2 && raw.charAt(0) === "'" && raw.charAt(raw.length - 1) === "'") ||
            (raw.length >= 2 && raw.charAt(0) === '"' && raw.charAt(raw.length - 1) === '"')) raw = raw.slice(1, -1);
      }
      let value;
      try { value = JSON.parse(raw); } catch (e) { return err('JSON 解析失败: ' + e.message); }
      store.writeEnvelope(CFG, a1, { version: store.SCHEMA_VERSION, updatedAt: new Date().toISOString(), data: value });
      out({ ok: true, key: a1 });
      break;
    }
    case 'del': {
      if (!a1) return err('用法: wb del <key>');
      store.deleteKey(CFG, a1);
      out({ ok: true, key: a1 });
      break;
    }
    case 'export': {
      const payload = store.apiExport(CFG);
      const file = a1 || path.join(CFG.BACKUP_DIR, 'homeroom-workbench-backup-' + new Date().toISOString().slice(0, 10) + '.json');
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      out({ ok: true, file, keys: Object.keys(payload.records).length });
      break;
    }
    case 'import': {
      if (!a1) return err('用法: wb import <file> [--replace]');
      const result = store.apiImport(CFG, readJSONFile(a1), a2 === '--replace' || a3 === '--replace');
      if (!result.ok) return err(result.error || '导入失败');
      out(result);
      break;
    }
    case 'migrate': {
      if (!a1) return err('用法: wb migrate <browser-backup.json> [--replace]');
      try { out(migrateLegacy(a1, a2 === '--replace' || a3 === '--replace')); }
      catch (e) { return err(e.message); }
      break;
    }
    case 'backup': {
      const payload = store.apiExport(CFG);
      const file = path.join(CFG.BACKUP_DIR, 'homeroom-workbench-backup-' + new Date().toISOString().slice(0, 10) + '.json');
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      out({ ok: true, file, keys: Object.keys(payload.records).length });
      break;
    }
    case 'serve': {
      require('./server.js');
      break;
    }
    case 'start': {
      const pidFile = path.join(CFG.DATA, 'server.pid');
      if (fs.existsSync(pidFile)) {
        try { process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 0); return out({ ok: true, alreadyRunning: true, url: 'http://' + CFG.host + ':' + CFG.port + '/' }); }
        catch (e) { /* 旧 PID 已失效 */ }
      }
      const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], { detached: true, stdio: 'ignore' });
      child.unref();
      fs.writeFileSync(pidFile, String(child.pid), 'utf8');
      out({ ok: true, pid: child.pid, url: 'http://' + CFG.host + ':' + CFG.port + '/', note: '服务已在后台启动；停止请运行 wb stop' });
      break;
    }
    case 'stop': {
      const pidFile = path.join(CFG.DATA, 'server.pid');
      if (!fs.existsSync(pidFile)) return out({ ok: true, alreadyStopped: true });
      const pid = Number(fs.readFileSync(pidFile, 'utf8'));
      try { process.kill(pid); } catch (e) { /* 进程已退出 */ }
      try { fs.unlinkSync(pidFile); } catch (e) {}
      out({ ok: true, stoppedPid: pid });
      break;
    }
    default:
      console.log('教师工作台 CLI\n用法: node wb.js <status|keys|get|set|del|export|import|migrate|backup|serve|start|stop> [参数]\n运行 "node wb.js status" 查看当前状态。');
      break;
  }
}
main().catch((e) => err(e.message));
