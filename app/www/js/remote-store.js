/* ============================================================
 * 远程本地存储适配器（覆盖 local-persistence.js 的浏览器存储实现）
 * 数据不再写入 localStorage / IndexedDB，而是通过本地服务 API
 * 落到磁盘文件（data/records、data/attachments）。
 * 读取：同步 XHR 预热缓存（本地服务，数据量小，启动即取全量备份）
 * 写入：同步更新缓存 + 异步 PUT 落盘，失败通过 workbench:storage
 *       事件驱动状态栏提示（保存中 / 已保存 / 保存失败）。
 * 依赖：本地服务必须已启动（127.0.0.1:8731）；服务未启动时页面可
 *       渲染，但保存会明确报错，不会静默丢失。
 * ============================================================ */
(function (root) {
  'use strict';
  if (typeof root.XMLHttpRequest !== 'function') return;

  function emit(root, state, key, error) {
    if (typeof root.dispatchEvent !== 'function' || typeof root.CustomEvent !== 'function') return;
    root.dispatchEvent(new root.CustomEvent('workbench:storage', {
      detail: { state: state, key: key || '', error: error ? String(error.message || error) : '', at: new Date().toISOString() }
    }));
  }

  function syncFetch(url, method, body) {
    var xhr = new XMLHttpRequest();
    xhr.open(method || 'GET', url, false);
    if (body !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(body);
    if (xhr.status >= 200 && xhr.status < 300) {
      return xhr.responseText ? JSON.parse(xhr.responseText) : null;
    }
    throw new Error('本地服务请求失败 HTTP ' + xhr.status + ' ' + url);
  }

  function asyncFetch(url, method, body, onFail) {
    var xhr = new XMLHttpRequest();
    xhr.open(method || 'GET', url, true);
    if (body !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () { if (!(xhr.status >= 200 && xhr.status < 300)) onFail(new Error('HTTP ' + xhr.status)); };
    xhr.onerror = function () { onFail(new Error('网络错误')); };
    xhr.send(body);
  }

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

  function create(options) {
    options = options || {};
    var namespace = String(options.namespace || 'homeroom_workbench').replace(/\s+/g, '_');
    var version = Number(options.version || 1);
    var migrate = typeof options.migrate === 'function' ? options.migrate : function (data) { return data; };
    var cache = {};
    var loaded = false;
    var timers = {};

    function fullKey(key) { return namespace + ':' + String(key); }

    function load() {
      if (loaded) return;
      loaded = true;
      try {
        var payload = syncFetch('/api/export');
        var records = (payload && payload.records) || {};
        var schemaVersion = (payload && payload.schemaVersion) || version;
        var exportedAt = (payload && payload.exportedAt) || null;
        // 与 set() 保持一致的缓存信封结构 {version, updatedAt, data}
        Object.keys(records).forEach(function (k) { cache[namespace + ':' + k] = { version: schemaVersion, updatedAt: exportedAt, data: records[k] }; });
      } catch (error) {
        emit(root, 'error', '*', error);
      }
    }

    function get(key, fallback) {
      load();
      var fk = fullKey(key);
      if (Object.prototype.hasOwnProperty.call(cache, fk)) {
        var saved = cache[fk];
        // 兼容两种缓存形态：信封 {version,updatedAt,data} 或裸数据
        if (saved && !Object.prototype.hasOwnProperty.call(saved, 'data')) saved = { version: version, updatedAt: null, data: saved };
        var data = saved && saved.version === version ? saved.data : migrate(saved && saved.data, saved && saved.version || 0, version, key);
        if (saved && saved.version !== version) set(key, data);
        return clone(data);
      }
      return clone(fallback);
    }

    // ---------- 撤销/重做（数据操作快照，防误操作） ----------
    var undoStack = [], redoStack = [], MAX_UNDO = 30;
    function dispatchHistory() {
      if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
        root.dispatchEvent(new root.CustomEvent('workbench:history'));
      }
    }
    // 会话/草稿类键不进入撤销栈（切换模块、主题选择等无意义快照）
    function isSessionKey(key) {
      return /^(ui_context|current_class|entered|subject|exam_selected|score_student|notify_seen_count|theme)|_draft_|^page_draft/.test(String(key));
    }
    function pushUndo(fk, before) {
      var last = undoStack[undoStack.length - 1];
      // 2.5 秒内同一键的连续写入（如防抖自动保存）合并为一次操作
      if (last && last.fk === fk && (Date.now() - last.at) < 2500) { last.before = before; last.at = Date.now(); return; }
      undoStack.push({ fk: fk, before: before, at: Date.now() });
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      redoStack = [];
      dispatchHistory();
    }
    function popBatch(stack) {
      var batch = [];
      var ref = stack[stack.length - 1];
      if (!ref) return batch;
      var base = ref.at;
      while (stack.length) {
        var r = stack[stack.length - 1];
        if (batch.length && Math.abs(r.at - base) > 2500) break;
        batch.push(stack.pop());
      }
      return batch;
    }
    function rawWrite(fk, data) {
      // 恢复写回（不入撤销栈），同步更新缓存 + 异步落盘
      var bare = fk.slice(namespace.length + 1);
      if (data === undefined) { delete cache[fk]; asyncFetch('/api/store/' + encodeURIComponent(bare), 'DELETE', undefined, function () {}); }
      else { cache[fk] = { version: version, updatedAt: new Date().toISOString(), data: clone(data) }; asyncFetch('/api/store/' + encodeURIComponent(bare), 'PUT', JSON.stringify({ version: version, data: clone(data) }), function () {}); }
    }
    function restoreBatch(stack, target) {
      var batch = popBatch(stack);
      batch.forEach(function (rec) {
        var current = cache[rec.fk];
        target.push({ fk: rec.fk, before: current ? current.data : undefined, at: rec.at });
        rawWrite(rec.fk, rec.before);
      });
      return batch;
    }
    function undo() {
      load();
      var batch = restoreBatch(undoStack, redoStack);
      if (!batch.length) return { ok: false };
      emit(root, 'saved', '*');
      dispatchHistory();
      return { ok: true, keys: batch.map(function (r) { return r.fk.slice(namespace.length + 1); }) };
    }
    function redo() {
      load();
      var batch = restoreBatch(redoStack, undoStack);
      if (!batch.length) return { ok: false };
      emit(root, 'saved', '*');
      dispatchHistory();
      return { ok: true, keys: batch.map(function (r) { return r.fk.slice(namespace.length + 1); }) };
    }
    function canUndo() { return undoStack.length > 0; }
    function canRedo() { return redoStack.length > 0; }

    function set(key, value) {
      load();
      if (value === undefined) {
        emit(root, 'error', key, new Error('拒绝写入 undefined 值（键：' + key + '）'));
        return { ok: false, key: key, error: '拒绝写入 undefined 值' };
      }
      var fk = fullKey(key);
      var before = Object.prototype.hasOwnProperty.call(cache, fk) ? clone(cache[fk].data) : undefined;
      cache[fk] = { version: version, updatedAt: new Date().toISOString(), data: clone(value) };
      if (!isSessionKey(key)) pushUndo(fk, before);
      emit(root, 'saving', key);
      asyncFetch('/api/store/' + encodeURIComponent(key), 'PUT', JSON.stringify({ version: version, data: cache[fk].data }), function (error) {
        emit(root, 'error', key, error);
      });
      emit(root, 'saved', key);
      return { ok: true, key: key };
    }

    function update(key, updater, fallback) {
      var current = get(key, fallback);
      var next = updater(clone(current));
      var result = set(key, next);
      result.data = next;
      return result;
    }

    function remove(key) {
      load();
      var fk = fullKey(key);
      var before = Object.prototype.hasOwnProperty.call(cache, fk) ? clone(cache[fk].data) : undefined;
      delete cache[fk];
      if (!isSessionKey(key)) pushUndo(fk, before);
      asyncFetch('/api/store/' + encodeURIComponent(key), 'DELETE', undefined, function (error) { emit(root, 'error', key, error); });
      emit(root, 'saved', key);
      return { ok: true, key: key };
    }

    function keys() {
      load();
      var prefix = namespace + ':';
      return Object.keys(cache).filter(function (k) { return k.indexOf(prefix) === 0; }).map(function (k) { return k.slice(prefix.length); }).sort();
    }

    function clear() {
      load();
      var targets = keys();
      targets.forEach(function (key) { delete cache[fullKey(key)]; });
      asyncFetch('/api/clear', 'POST', JSON.stringify({ confirm: '确认清空' }), function (error) { emit(root, 'error', '*', error); });
      emit(root, 'saved', '*');
      return { ok: true, removed: targets.length };
    }

    function exportData() {
      load();
      var records = {};
      keys().forEach(function (key) { records[key] = get(key, null); });
      return { format: 'homeroom-workbench-backup', namespace: namespace, schemaVersion: version, exportedAt: new Date().toISOString(), records: records };
    }

    function importData(payload, importOptions) {
      load();
      importOptions = importOptions || {};
      if (!payload || payload.format !== 'homeroom-workbench-backup' || !payload.records || typeof payload.records !== 'object') {
        return { ok: false, error: '备份格式无效' };
      }
      try {
        var result = syncFetch('/api/import' + (importOptions.replace === true ? '?replace=true' : ''), 'POST', JSON.stringify(payload));
        if (!result.ok) return result;
        var fresh = syncFetch('/api/export');
        cache = {};
        var schemaVersion = (fresh && fresh.schemaVersion) || version;
        Object.keys((fresh && fresh.records) || {}).forEach(function (k) { cache[namespace + ':' + k] = { version: schemaVersion, updatedAt: (fresh && fresh.exportedAt) || null, data: fresh.records[k] }; });
        emit(root, 'saved', '*');
        return result;
      } catch (error) {
        emit(root, 'error', '*', error);
        return { ok: false, error: '导入失败：' + String(error.message || error), failed: Object.keys(payload.records) };
      }
    }

    function autosave(key, delay) {
      var wait = Number(delay == null ? 350 : delay);
      return function (value) {
        emit(root, 'saving', key);
        root.clearTimeout(timers[key]);
        timers[key] = root.setTimeout(function () { set(key, value); }, wait);
      };
    }

    function serializeForm(form) {
      var data = {};
      Array.prototype.forEach.call(form.elements || [], function (field) {
        if (!field.name || field.disabled || field.type === 'file') return;
        if ((field.type === 'checkbox' || field.type === 'radio') && !field.checked) {
          if (field.type === 'checkbox' && !Object.prototype.hasOwnProperty.call(data, field.name)) data[field.name] = false;
          return;
        }
        if (field.type === 'checkbox') data[field.name] = true;
        else if (field.multiple) data[field.name] = Array.prototype.filter.call(field.options, function (item) { return item.selected; }).map(function (item) { return item.value; });
        else data[field.name] = field.value;
      });
      return data;
    }

    function restoreForm(form, data) {
      if (!data) return;
      Array.prototype.forEach.call(form.elements || [], function (field) {
        if (!field.name || !Object.prototype.hasOwnProperty.call(data, field.name)) return;
        if (field.type === 'checkbox') field.checked = Boolean(data[field.name]);
        else if (field.type === 'radio') field.checked = field.value === data[field.name];
        else if (field.type !== 'file') field.value = data[field.name];
      });
    }

    function bindForm(form, key, bindOptions) {
      bindOptions = bindOptions || {};
      restoreForm(form, get(key, bindOptions.fallback || {}));
      var save = autosave(key, bindOptions.delay);
      var handler = function () { save(serializeForm(form)); };
      form.addEventListener('input', handler);
      form.addEventListener('change', handler);
      return function () {
        form.removeEventListener('input', handler);
        form.removeEventListener('change', handler);
      };
    }

    return { namespace: namespace, version: version, get: get, set: set, update: update, remove: remove, keys: keys, clear: clear, exportData: exportData, importData: importData, autosave: autosave, bindForm: bindForm, serializeForm: serializeForm, restoreForm: restoreForm, undo: undo, redo: redo, canUndo: canUndo, canRedo: canRedo };
  }

  root.LocalWorkbenchStore = { create: create };

  // ---------- 附件远程适配（Promise API，与本地 IndexedDB 版同签名） ----------
  function createFiles(options) {
    options = options || {};
    function list() {
      return new Promise(function (resolve, reject) {
        try { var r = syncFetch('/api/attachments'); resolve(r.files || []); }
        catch (e) { reject(e); }
      });
    }
    function put(file, metadata) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var id = 'file_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
          try {
            var r = syncFetch('/api/attachments/' + id, 'PUT', JSON.stringify({ name: file.name, type: file.type || 'application/octet-stream', dataURL: reader.result, metadata: metadata || {} }));
            resolve({ id: id, name: file.name, type: file.type || 'application/octet-stream', size: file.size || r.size, savedAt: new Date().toISOString(), metadata: metadata || {} });
          } catch (e) { reject(e); }
        };
        reader.onerror = function () { reject(reader.error || new Error('文件读取失败')); };
        reader.readAsDataURL(file);
      });
    }
    function remove(id) {
      return new Promise(function (resolve, reject) {
        try { syncFetch('/api/attachments/' + encodeURIComponent(id), 'DELETE'); resolve({ ok: true }); }
        catch (e) { reject(e); }
      });
    }
    function clear() {
      return new Promise(function (resolve, reject) {
        try {
          var r = syncFetch('/api/attachments');
          (r.files || []).forEach(function (f) { syncFetch('/api/attachments/' + encodeURIComponent(f.id), 'DELETE'); });
          resolve({ ok: true });
        } catch (e) { reject(e); }
      });
    }
    function exportData() {
      return new Promise(function (resolve, reject) {
        try { var r = syncFetch('/api/attachments/export'); resolve(r.files || []); }
        catch (e) { reject(e); }
      });
    }
    function importData(records, replace) {
      return new Promise(function (resolve, reject) {
        try { var r = syncFetch('/api/attachments/import' + (replace === true ? '?replace=true' : ''), 'POST', JSON.stringify(records || [])); resolve(r); }
        catch (e) { reject(e); }
      });
    }
    return { put: put, list: list, remove: remove, clear: clear, exportData: exportData, importData: importData };
  }

  root.LocalWorkbenchFiles = { create: createFiles };
})(typeof window !== 'undefined' ? window : globalThis);
