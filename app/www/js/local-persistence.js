(function (root) {
  'use strict';

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function create(options) {
    options = options || {};
    var storage = options.storage || root.localStorage;
    var namespace = String(options.namespace || 'workbench_a4f61bd777eeafb5').replace(/\s+/g, '_');
    var version = Number(options.version || 1);
    var prefix = namespace + ':';
    var migrate = typeof options.migrate === 'function' ? options.migrate : function (data) { return data; };
    var timers = {};

    function emit(state, key, error) {
      if (typeof root.dispatchEvent !== 'function' || typeof root.CustomEvent !== 'function') return;
      root.dispatchEvent(new root.CustomEvent('workbench:storage', {
        detail: { state: state, key: key || '', error: error ? String(error.message || error) : '', at: new Date().toISOString() }
      }));
    }

    function fullKey(key) { return prefix + String(key); }

    function envelope(key) {
      var raw = storage.getItem(fullKey(key));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, 'data')) return { version: 0, updatedAt: null, data: parsed };
      return parsed;
    }

    function get(key, fallback) {
      try {
        var saved = envelope(key);
        if (!saved) return clone(fallback);
        var data = saved.version === version ? saved.data : migrate(saved.data, saved.version || 0, version, key);
        if (saved.version !== version) set(key, data);
        return clone(data);
      } catch (error) {
        emit('error', key, error);
        return clone(fallback);
      }
    }

    function set(key, value) {
      emit('saving', key);
      try {
        storage.setItem(fullKey(key), JSON.stringify({ version: version, updatedAt: new Date().toISOString(), data: value }));
        emit('saved', key);
        return { ok: true, key: key };
      } catch (error) {
        emit('error', key, error);
        return { ok: false, key: key, error: String(error.message || error) };
      }
    }

    function update(key, updater, fallback) {
      var current = get(key, fallback);
      var next = updater(clone(current));
      var result = set(key, next);
      result.data = next;
      return result;
    }

    function remove(key) {
      try {
        storage.removeItem(fullKey(key));
        emit('saved', key);
        return { ok: true, key: key };
      } catch (error) {
        emit('error', key, error);
        return { ok: false, key: key, error: String(error.message || error) };
      }
    }

    function keys() {
      var output = [];
      for (var index = 0; index < storage.length; index += 1) {
        var key = storage.key(index);
        if (key && key.indexOf(prefix) === 0) output.push(key.slice(prefix.length));
      }
      return output.sort();
    }

    function clear() {
      var targets = keys();
      targets.forEach(function (key) { storage.removeItem(fullKey(key)); });
      emit('saved', '*');
      return { ok: true, removed: targets.length };
    }

    function exportData() {
      var records = {};
      keys().forEach(function (key) { records[key] = get(key, null); });
      return {
        format: 'homeroom-workbench-backup',
        namespace: namespace,
        schemaVersion: version,
        exportedAt: new Date().toISOString(),
        records: records
      };
    }

    function importData(payload, importOptions) {
      importOptions = importOptions || {};
      if (!payload || payload.format !== 'homeroom-workbench-backup' || !payload.records || typeof payload.records !== 'object') {
        return { ok: false, error: '备份格式无效' };
      }
      var incomingKeys = Object.keys(payload.records);
      if (incomingKeys.length > 2000) return { ok: false, error: '备份数据集数量异常，已拒绝导入' };
      var invalidKey = incomingKeys.find(function (key) { return !key || key.length > 240 || /[\u0000-\u001f]/.test(key); });
      if (invalidKey) return { ok: false, error: '备份包含非法数据键' };
      var serialized = {};
      try {
        incomingKeys.forEach(function (key) { serialized[key] = JSON.stringify({ version: version, updatedAt: new Date().toISOString(), data: payload.records[key] }); });
      } catch (error) { return { ok: false, error: '备份内容无法序列化：' + String(error.message || error) }; }
      var bytes = incomingKeys.reduce(function (sum, key) { return sum + serialized[key].length; }, 0);
      if (bytes > 25 * 1024 * 1024) return { ok: false, error: '普通数据超过 25MB，请拆分后导入' };
      var before = {}, existing = keys();
      existing.forEach(function (key) { before[key] = storage.getItem(fullKey(key)); });
      try {
        if (importOptions.replace === true) existing.forEach(function (key) { storage.removeItem(fullKey(key)); });
        incomingKeys.forEach(function (key) { storage.setItem(fullKey(key), serialized[key]); });
        emit('saved', '*');
        return { ok: true, imported: incomingKeys.length, failed: [] };
      } catch (error) {
        try {
          keys().forEach(function (key) { storage.removeItem(fullKey(key)); });
          Object.keys(before).forEach(function (key) { storage.setItem(fullKey(key), before[key]); });
        } catch (rollbackError) { emit('error', '*', rollbackError); return { ok: false, error: '导入失败且自动回滚未完成，请保留原备份：' + String(error.message || error), failed: incomingKeys }; }
        emit('error', '*', error);
        return { ok: false, error: '导入失败，原数据已自动恢复：' + String(error.message || error), failed: incomingKeys };
      }
    }

    function autosave(key, delay) {
      var wait = Number(delay == null ? 350 : delay);
      return function (value) {
        emit('saving', key);
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

    if (typeof root.addEventListener === 'function') {
      root.addEventListener('storage', function (event) {
        if (event.key && event.key.indexOf(prefix) === 0) emit('external-update', event.key.slice(prefix.length));
      });
    }

    return { namespace: namespace, version: version, get: get, set: set, update: update, remove: remove, keys: keys, clear: clear, exportData: exportData, importData: importData, autosave: autosave, bindForm: bindForm, serializeForm: serializeForm, restoreForm: restoreForm };
  }

  root.LocalWorkbenchStore = { create: create };

  function createFiles(options) {
    options = options || {};
    var databaseName = options.database || 'homeroom_workbench_files';
    var storeName = options.store || 'files';

    function open() {
      return new Promise(function (resolve, reject) {
        if (!root.indexedDB) { reject(new Error('当前浏览器不支持IndexedDB')); return; }
        var request = root.indexedDB.open(databaseName, 1);
        request.onupgradeneeded = function () {
          if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath: 'id' });
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error || new Error('附件数据库打开失败')); };
      });
    }

    function request(mode, operation) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var transaction = db.transaction(storeName, mode);
          var objectStore = transaction.objectStore(storeName);
          var result;
          try { result = operation(objectStore); } catch (error) { reject(error); return; }
          transaction.oncomplete = function () { db.close(); resolve(result && result.result); };
          transaction.onerror = function () { db.close(); reject(transaction.error || new Error('附件存储失败')); };
          transaction.onabort = transaction.onerror;
        });
      });
    }

    function put(file, metadata) {
      metadata = metadata || {};
      var id = metadata.id || ('file_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
      var record = { id: id, name: file.name, type: file.type || 'application/octet-stream', size: file.size, lastModified: file.lastModified || Date.now(), savedAt: new Date().toISOString(), metadata: metadata, blob: file };
      return request('readwrite', function (store) { return store.put(record); }).then(function () { return { id: id, name: record.name, type: record.type, size: record.size, savedAt: record.savedAt, metadata: metadata }; });
    }

    function list() {
      return request('readonly', function (store) { return store.getAll(); }).then(function (records) { return records || []; });
    }

    function clear() {
      return request('readwrite', function (store) { return store.clear(); });
    }

    function remove(id) {
      return request('readwrite', function (store) { return store.delete(id); });
    }

    function blobToDataURL(blob) {
      return new Promise(function (resolve, reject) { var reader = new FileReader();reader.onload = function () { resolve(reader.result); };reader.onerror = function () { reject(reader.error); };reader.readAsDataURL(blob); });
    }

    function dataURLToBlob(dataURL) {
      var parts = dataURL.split(','), match = parts[0].match(/data:([^;]+)/), bytes = atob(parts[1]), array = new Uint8Array(bytes.length);
      for (var index = 0; index < bytes.length; index += 1) array[index] = bytes.charCodeAt(index);
      return new Blob([array], { type: match ? match[1] : 'application/octet-stream' });
    }

    function exportData() {
      return list().then(function (records) { return Promise.all(records.map(function (record) { return blobToDataURL(record.blob).then(function (dataURL) { return { id: record.id, name: record.name, type: record.type, size: record.size, lastModified: record.lastModified, savedAt: record.savedAt, metadata: record.metadata, dataURL: dataURL }; }); })); });
    }

    function importData(records, replace) {
      records = Array.isArray(records) ? records : [];
      if (records.length > 500) return Promise.reject(new Error('附件数量超过 500 个，已拒绝导入'));
      var prepared;
      try {
        prepared = records.map(function (record, index) {
          if (!record || typeof record.id !== 'string' || !record.id || typeof record.dataURL !== 'string' || record.dataURL.indexOf('data:') !== 0) throw new Error('第 ' + (index + 1) + ' 个附件记录无效');
          if (record.dataURL.length > 70 * 1024 * 1024) throw new Error('附件“' + (record.name || record.id) + '”超过可导入大小');
          return { id: record.id, name: String(record.name || '未命名附件'), type: String(record.type || 'application/octet-stream'), size: Number(record.size || 0), lastModified: Number(record.lastModified || Date.now()), savedAt: record.savedAt || new Date().toISOString(), metadata: record.metadata || {}, blob: dataURLToBlob(record.dataURL) };
        });
      } catch (error) { return Promise.reject(error); }
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var transaction = db.transaction(storeName, 'readwrite'), store = transaction.objectStore(storeName);
          if (replace) store.clear();
          prepared.forEach(function (record) { store.put(record); });
          transaction.oncomplete = function () { db.close(); resolve({ ok: true, imported: prepared.length }); };
          transaction.onerror = function () { db.close(); reject(transaction.error || new Error('附件导入失败，事务已回滚')); };
          transaction.onabort = transaction.onerror;
        });
      });
    }

    return { put: put, list: list, remove: remove, clear: clear, exportData: exportData, importData: importData };
  }

  root.LocalWorkbenchFiles = { create: createFiles };
})(typeof window !== 'undefined' ? window : globalThis);
