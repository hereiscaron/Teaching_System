(function (w) {
  'use strict';
  var TW = w.TW;
  if (!TW) return;

  var STORE_KEY = 'editable_tables_v2';
  var active = { root: null, context: '', tables: [] };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  /* 单元格文本：日期列取 input 的值，其余取文本 */
  function text(cell) {
    if (!cell) return '';
    var inp = cell.querySelector && cell.querySelector('input.cell-date');
    if (inp) return inp.value || '';
    return String(cell.textContent || '').replace(/\s+/g, ' ').trim();
  }
  /* 日期列判定：表头以「日期/时间/date」开头（含"日期(年/月/日)"等变体），避免误伤"更新时间"等 */
  function isDateHeader(h) { return /^(日期|时间|date)/i.test(String(h == null ? '' : h).trim()); }
  /* 旧格式日期（M月D日 / 2026-9-2）归一化为 input[type=date] 需要的 YYYY-MM-DD */
  function toDateInput(v) {
    v = String(v == null ? '' : v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    var m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return m[1] + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[3]).padStart(2, '0');
    var dm = v.match(/^(\d{1,2})月(\d{1,2})日/);
    if (dm) { var d = new Date(new Date().getFullYear(), +dm[1] - 1, +dm[2]); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    return '';
  }
  function safeName(value) { return String(value || '工作台数据').replace(/[\\/:*?"<>|]/g, '_'); }
  function keyFor(context, index) { return context + '::table_' + index; }
  function allData() { return TW.store.read(STORE_KEY, {}); }
  function read(key) { var data = allData(); return Array.isArray(data[key]) ? clone(data[key]) : null; }
  function write(key, rows) {
    var result = TW.store.update(STORE_KEY, function (data) { data = data && typeof data === 'object' ? data : {}; data[key] = rows; return data; }, {});
    return Boolean(result && result.ok);
  }
  function rowsFrom(table) { return TW.$$('tbody tr', table).map(function (row) { return TW.$$('td', row).map(text); }); }
  function headersFrom(table) { return TW.$$('thead th', table).map(text); }
  function editableColumnCount(table) {
    var headers = headersFrom(table), last = headers[headers.length - 1] || '';
    return /操作|动作|删除/.test(last) ? Math.max(1, headers.length - 1) : headers.length;
  }
  function tableTitle(table, index) {
    var section = table.closest('.section'), titleEl = section && section.querySelector('.section-title');
    if (!titleEl) return '数据表 ' + (index + 1);
    // 只取主标题，剥离 <small> 说明文字，避免弹窗标题过长/重叠
    var copy = titleEl.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll('small'), function (s) { s.remove(); });
    return text(copy) || ('数据表 ' + (index + 1));
  }
  /* 排除：专用数据源表格（业务数据读 TW.* 并渲染，编辑/查看须同源）由 .no-edit-table 标记，
   * 避免被通用可编辑表格接管后数据写进 editable_tables_v2，导致"表格显示与查看/统计不链接"。 */
  function isManaged(table) { return !table.matches('.fitness-table,.schedule,.workflow-table,.score-table,.no-edit-table,.hw-table') && !table.closest('.local-records-panel') && table.querySelector('tbody') && table.querySelector('thead'); }
  function ensureActionHeader(table) {
    var headers = headersFrom(table), last = headers[headers.length - 1] || '';
    if (!/操作|动作|删除/.test(last)) { var th = document.createElement('th'); th.textContent = '操作'; table.querySelector('thead tr').appendChild(th); }
  }

  /* 行操作按钮构建：
   * 1) 应用层可注册 TW.editableActionBuilder(info, row) 按当前行返回定制按钮（学生档案等业务表）；
   * 2) 否则取首行操作模板，并按当前行重绑 data-name / data-sid，
   *    避免排序、新增、导入后按钮仍指向旧行姓名/学籍号（"成长档案等按钮点不动"的根因）。 */
  function buildActionCell(info, row) {
    if (typeof TW.editableActionBuilder === 'function') {
      var custom = TW.editableActionBuilder(info, row);
      if (custom) return custom;
    }
    var tpl = info.actionTemplates.length ? info.actionTemplates[0] : '<button class="button text" data-action="edit-record">查看</button>';
    var name = String(row[0] == null ? '' : row[0]).trim();
    if (name) {
      tpl = tpl.replace(/data-name="[^"]*"/g, 'data-name="' + TW.escape(name) + '"');
      if (typeof TW.sidOfName === 'function') {
        tpl = tpl.replace(/data-sid="[^"]*"/g, 'data-sid="' + TW.escape(String(TW.sidOfName(name) || '')) + '"');
      }
    }
    return tpl;
  }

  function renderRows(info, rows) {
    var count = editableColumnCount(info.table), headers = headersFrom(info.table);
    info.table.querySelector('tbody').innerHTML = rows.map(function (row, rowIndex) {
      var cells = [];
      for (var i = 0; i < count; i += 1) {
        var isDate = info.dateCols && info.dateCols[i];
        var val = row[i] == null ? '' : row[i];
        var disp = isDate
          ? '<input type="date" class="cell-date" value="' + TW.escape(toDateInput(val)) + '" aria-label="选择日期">'
          : TW.escape(val);
        cells.push('<td data-label="' + TW.escape(headers[i] || '') + '" data-col="' + i + '">' + disp + '</td>');
      }
      if (info.table.matches('.no-actions')) {
        // 意向名单等精简表：操作列只保留删除按钮（无查看）
        cells.push('<td data-label="操作" class="editable-actions"><button class="button text danger-text" data-table-delete="' + rowIndex + '">删除</button></td>');
        return '<tr data-row-index="' + rowIndex + '">' + cells.join('') + '</tr>';
      }
      cells.push('<td data-label="操作" class="editable-actions">' + buildActionCell(info, row) + '<button class="button text danger-text" data-table-delete="' + rowIndex + '">删除</button></td>');
      return '<tr data-row-index="' + rowIndex + '">' + cells.join('') + '</tr>';
    }).join('');
    bindRows(info);
    updateCount(info);
  }

  function saveFromDOM(info) {
    var count = editableColumnCount(info.table), rows = TW.$$('tbody tr', info.table).map(function (row) { return TW.$$('td', row).slice(0, count).map(text); });
    if (!write(info.key, rows)) { TW.toast('保存失败，请立即导出完整备份', 'danger'); return false; }
    info.rows = rows;
    updateCount(info);
    refreshDashboard();
    if (TW.onTableWrite) TW.onTableWrite(info, rows);
    return true;
  }

  function bindRows(info) {
    var count = editableColumnCount(info.table);
    TW.$$('tbody tr', info.table).forEach(function (row) {
      TW.$$('td', row).slice(0, count).forEach(function (cell, i) {
        // 日期列：选择控件（只选不填），选择即保存；不进入 contenteditable
        if (info.dateCols && info.dateCols[i]) {
          var inp = cell.querySelector('input.cell-date');
          if (inp) inp.addEventListener('change', function () { info.autosave(); });
          return;
        }
        cell.contentEditable = info.editing ? 'true' : 'false';
        cell.spellcheck = false;
        cell.oninput = info.editing ? function () { info.autosave(); } : null;
        cell.onkeydown = info.editing ? function (event) {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); cell.blur(); saveFromDOM(info); TW.toast('表格修改已保存到本机'); }
          else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); saveFromDOM(info); TW.toast('表格修改已保存到本机'); }
        } : null;
      });
    });
    TW.$$('[data-table-delete]', info.table).forEach(function (button) {
      button.hidden = !info.editing;
      button.onclick = function () {
        // 二次确认：防止误删
        if (!confirm('确认删除该条数据吗？删除后可通过完整备份恢复。')) return;
        // 学生档案删除引用保护（应用层钩子：返回非空字符串则阻止删除并提示）
        if (typeof TW.guardStudentDelete === 'function') {
          var rowName = (rowsFrom(info.table)[Number(button.dataset.tableDelete)] || [])[0];
          var guardMsg = TW.guardStudentDelete(String(rowName || ''));
          if (guardMsg) { alert(guardMsg); return; }
        }
        var rows = rowsFrom(info.table).map(function (row) { return row.slice(0, count); });
        rows.splice(Number(button.dataset.tableDelete), 1);
        write(info.key, rows); info.rows = rows; renderRows(info, rows); refreshDashboard(); if (TW.onTableWrite) TW.onTableWrite(info, rows); TW.toast('该条数据已删除并保存');
      };
    });
  }

  function updateCount(info) {
    if (!info.toolbar) return;
    var visible = TW.$$('tbody tr', info.table).filter(function (row) { return !row.hidden; }).length;
    var total = TW.$$('tbody tr', info.table).length;
    var node = info.toolbar.querySelector('[data-table-count]');
    if (node) node.textContent = visible === total ? total + ' 条' : visible + ' / ' + total + ' 条';
  }

  function setEditing(info, enabled) {
    info.editing = enabled;
    info.toolbar.classList.toggle('is-editing', enabled);
    var button = info.toolbar.querySelector('[data-table-edit]');
    button.textContent = enabled ? '完成编辑' : '编辑数据';
    bindRows(info);
    if (!enabled) { saveFromDOM(info); TW.toast('表格修改已自动保存'); }
  }

  function csvEscape(value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }
  function toCSV(headers, rows) { return '\ufeff' + [headers].concat(rows).map(function (row) { return row.map(csvEscape).join(','); }).join('\n'); }
  function download(name, contents, type) {
    var blob = new Blob([contents], { type: type || 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }
  function parseCSV(input) {
    var source = String(input || '').replace(/^\ufeff/, ''), rows = [], row = [], value = '', quoted = false;
    for (var i = 0; i < source.length; i += 1) {
      var ch = source[i], next = source[i + 1];
      if (quoted && ch === '"' && next === '"') { value += '"'; i += 1; }
      else if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === ',') { row.push(value); value = ''; }
      else if (!quoted && (ch === '\n' || ch === '\r')) { if (ch === '\r' && next === '\n') i += 1; row.push(value); if (row.some(function (item) { return item !== ''; })) rows.push(row); row = []; value = ''; }
      else value += ch;
    }
    row.push(value); if (row.some(function (item) { return item !== ''; })) rows.push(row);
    if (quoted) throw new Error('CSV 引号没有闭合');
    return rows;
  }

  function exportInfo(info) {
    var count = editableColumnCount(info.table), headers = headersFrom(info.table).slice(0, count), rows = rowsFrom(info.table).map(function (row) { return row.slice(0, count); });
    download(safeName(info.title) + '-' + new Date().toISOString().slice(0, 10) + '.csv', toCSV(headers, rows));
    TW.toast('已导出 ' + rows.length + ' 条真实表格数据');
  }

  function openImport(info) {
    var m = TW.modal('导入数据 · ' + info.title,
      '<div class="import-dialog">' +
      '<div class="alert info">支持 UTF-8 CSV（Excel 请"另存为 CSV"后再上传）。首行可为表头；系统会先校验列数并预览，不会直接覆盖现有数据。可先下载模板对照填写。</div>' +
      '<div class="toolbar" style="margin:10px 0"><button class="button secondary" id="editableTemplate">⬇ 下载本表模板</button></div>' +
      '<div class="field"><label class="required">选择 CSV 文件</label><input id="editableImportFile" type="file" accept=".csv,text/csv"></div>' +
      '<div id="editableImportPreview" class="import-preview note">尚未选择文件</div>' +
      '</div>',
      '<button class="button secondary" data-close>取消</button><button class="button secondary" id="editableAppend" disabled>追加导入</button><button class="button" id="editableReplace" disabled>替换导入</button>');
    var modalEl = m.root.querySelector('.modal'); if (modalEl) modalEl.classList.add('import-modal');
    var parsed = null, input = TW.$('#editableImportFile'), preview = TW.$('#editableImportPreview'), append = TW.$('#editableAppend'), replace = TW.$('#editableReplace');
    TW.$('#editableTemplate').onclick = function () {
      var count = editableColumnCount(info.table), headers = headersFrom(info.table).slice(0, count);
      var example = headers.map(function (h, i) { return i === 0 ? '示例' + h : '示例' + (i + 1); });
      download(safeName(info.title) + '-模板.csv', toCSV(headers, [example]));
      TW.toast('模板已下载（含表头与示例行，导入前可删除示例行）');
    };
    input.onchange = function () {
      var file = input.files && input.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) { preview.textContent = '文件超过 5MB，已拒绝导入。'; return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var rows = parseCSV(reader.result), count = editableColumnCount(info.table), headers = headersFrom(info.table).slice(0, count);
          if (!rows.length) throw new Error('文件没有有效数据');
          var first = rows[0].map(function (v) { return v.trim(); }), headerMatches = first.filter(function (v, i) { return v === headers[i]; }).length >= Math.max(1, Math.floor(count / 2));
          if (headerMatches) rows.shift();
          if (!rows.length) throw new Error('文件只有表头，没有数据');
          var bad = rows.findIndex(function (row) { return row.length !== count; });
          if (bad >= 0) throw new Error('第 ' + (bad + 1) + ' 行有 ' + rows[bad].length + ' 列，应为 ' + count + ' 列');
          parsed = rows.map(function (row) { return row.map(function (v) { return v.trim(); }); });
          preview.innerHTML = '<strong>校验通过：' + parsed.length + ' 条、' + count + ' 列</strong><div class="import-preview-grid">' + parsed.slice(0, 4).map(function (row) { return '<span>' + row.map(TW.escape).join(' ｜ ') + '</span>'; }).join('') + '</div>';
          append.disabled = false; replace.disabled = false;
        } catch (error) { parsed = null; append.disabled = true; replace.disabled = true; preview.textContent = '校验失败：' + error.message; }
      };
      reader.onerror = function () { preview.textContent = '文件读取失败，请重新选择。'; };
      reader.readAsText(file, 'utf-8');
    };
    function commit(mode) {
      if (!parsed) return;
      var current = mode === 'append' ? rowsFrom(info.table).map(function (r) { return r.slice(0, editableColumnCount(info.table)); }) : [];
      var next = current.concat(parsed);
      if (!write(info.key, next)) { TW.toast('导入保存失败，原数据未改变', 'danger'); return; }
      info.rows = next; renderRows(info, next); document.querySelector('#modalRoot').innerHTML = ''; refreshDashboard(); if (TW.onTableWrite) TW.onTableWrite(info, next); TW.toast('已' + (mode === 'append' ? '追加' : '替换') + '导入 ' + parsed.length + ' 条数据');
    }
    append.onclick = function () { commit('append'); }; replace.onclick = function () { commit('replace'); };
  }

  function addRow(info) {
    var count = editableColumnCount(info.table), rows = rowsFrom(info.table).map(function (row) { return row.slice(0, count); });
    rows.push(Array.from({ length: count }, function (_, i) { return i === 0 ? '新记录' : ''; }));
    write(info.key, rows); info.rows = rows; info.editing = true; renderRows(info, rows); setEditing(info, true);
    if (TW.onTableWrite) TW.onTableWrite(info, rows);
    var cells = TW.$$('tbody tr:last-child td', info.table); if (cells[0]) cells[0].focus();
  }

  function bindToolbar(info) {
    var toolbar = document.createElement('div'); toolbar.className = 'editable-table-toolbar';
    toolbar.innerHTML = '<div class="editable-table-meta"><strong>' + TW.escape(info.title) + '</strong><span data-table-count></span><span class="local-chip">本机自动保存</span></div>' +
      '<label class="editable-search"><span>筛选</span><input data-table-search placeholder="输入任意字段"></label>' +
      '<div class="editable-table-actions"><button class="button secondary" data-table-edit>编辑数据</button><button class="button secondary" data-table-add>新增一条</button><button class="button secondary" data-table-import>导入 CSV</button><button class="button" data-table-export>导出 CSV</button></div>';
    info.table.closest('.data-table-wrap').insertAdjacentElement('beforebegin', toolbar); info.toolbar = toolbar;
    toolbar.querySelector('[data-table-edit]').onclick = function () { setEditing(info, !info.editing); };
    toolbar.querySelector('[data-table-add]').onclick = function () { addRow(info); };
    toolbar.querySelector('[data-table-import]').onclick = function () { openImport(info); };
    toolbar.querySelector('[data-table-export]').onclick = function () { exportInfo(info); };
    toolbar.querySelector('[data-table-search]').oninput = function () {
      var query = this.value.trim().toLowerCase();
      TW.$$('tbody tr', info.table).forEach(function (row) { row.hidden = query && text(row).toLowerCase().indexOf(query) < 0; }); updateCount(info);
    };
    updateCount(info);
  }

  function bindSort(info) {
    headersFrom(info.table).forEach(function (_, index) {
      var th = TW.$$('thead th', info.table)[index]; if (!th || index >= editableColumnCount(info.table)) return;
      th.tabIndex = 0; th.classList.add('sortable'); th.title = '点击排序';
      var direction = 1, sort = function () {
        var rows = rowsFrom(info.table).map(function (r) { return r.slice(0, editableColumnCount(info.table)); });
        rows.sort(function (a, b) { return String(a[index] || '').localeCompare(String(b[index] || ''), 'zh-CN', { numeric: true }) * direction; }); direction *= -1;
        write(info.key, rows); info.rows = rows; renderRows(info, rows); th.setAttribute('aria-sort', direction < 0 ? 'ascending' : 'descending');
      };
      th.onclick = sort; th.onkeydown = function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); sort(); } };
    });
  }

  function refreshDashboard() {
    if (!active.root) return;
    var allRows = active.tables.reduce(function (sum, info) { return sum + TW.$$('tbody tr', info.table).length; }, 0);
    var dashboard = active.root.querySelector('.insight-dashboard'); if (!dashboard) return;
    var kpis = dashboard.querySelectorAll('.insight-kpi strong');
    if (kpis[0]) kpis[0].textContent = allRows + '条';
    if (kpis[1]) kpis[1].textContent = Math.max(0, Math.round(allRows * 2.7));
    var foot = dashboard.querySelector('.insight-foot span'); if (foot) foot.textContent = '本页可编辑数据源：' + allRows + ' 条 · 修改后自动保存并驱动指标刷新';
    var canvas = dashboard.querySelector('.insight-canvas'); if (canvas) { canvas.dataset.seed = String(Number(canvas.dataset.seed || 1) + allRows * 13); if (canvas._redraw) canvas._redraw(); }
  }

  function mount(root, context) {
    active = { root: root, context: context, tables: [] };
    TW.$$('.data-table', root).filter(isManaged).forEach(function (table, index) {
      var originalRows = TW.$$('tbody tr', table), originalHeaders = headersFrom(table), hasAction = /操作|动作/.test(originalHeaders[originalHeaders.length - 1] || '');
      ensureActionHeader(table);
      var info = { table: table, index: index, context: context, key: keyFor(context, index), title: tableTitle(table, index), editing: false, toolbar: null, actionTemplates: hasAction ? originalRows.map(function (row) { var cells = TW.$$('td', row); return cells.length ? cells[cells.length - 1].innerHTML : ''; }) : [], dateCols: headersFrom(table).slice(0, editableColumnCount(table)).map(isDateHeader) };
      var saved = read(info.key), base = rowsFrom(table).map(function (row) { return row.slice(0, editableColumnCount(table)); });
      if (saved === null) { saved = base; write(info.key, saved); }
      info.rows = saved; info.autosave = function () { saveFromDOM(info); }; renderRows(info, saved); bindToolbar(info); bindSort(info);
      active.tables.push(info);
    });
    refreshDashboard();
    return { tables: active.tables.length, rows: active.tables.reduce(function (sum, info) { return sum + info.rows.length; }, 0) };
  }

  function exportCurrent(root, context) {
    if (!active.root || active.root !== root || active.context !== context) mount(root, context);
    if (!active.tables.length) return false;
    var blocks = [];
    active.tables.forEach(function (info) {
      var count = editableColumnCount(info.table), headers = headersFrom(info.table).slice(0, count), rows = rowsFrom(info.table).map(function (row) { return row.slice(0, count); });
      blocks.push([[info.title]].concat([headers], rows).map(function (row) { return row.map(csvEscape).join(','); }).join('\n'));
    });
    download('教师工作台-' + safeName(context) + '-' + new Date().toISOString().slice(0, 10) + '.csv', '\ufeff' + blocks.join('\n\n'));
    TW.toast('已将本页 ' + active.tables.length + ' 张表导出为一个 CSV 文件'); return true;
  }

  TW.editable = { mount: mount, exportCurrent: exportCurrent, parseCSV: parseCSV, summary: function () { return { tables: active.tables.length, rows: active.tables.reduce(function (sum, info) { return sum + info.rows.length; }, 0) }; } };
})(window);
