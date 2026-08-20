(function(w){
  var TW=w.TW;

  /* ================= 状态与数据水合（单班级：固定 c1） ================= */
  var classes = TW.store.read('classes', TW.defaultClasses);
  if (!Array.isArray(classes) || !classes.length) classes = TW.defaultClasses.slice();
  // 单班级化：不再支持多班级管理，固定使用第一个班级（c1）
  classes = [classes[0]];
  var savedCtx = TW.store.read('ui_context', {});
  var state = {
    classId: classes[0].id,
    area: savedCtx.area || 'teaching',
    module: savedCtx.module || 'dashboard',
    examId: TW.store.read('exam_selected', 'ex_1'),
    scoreStudent: TW.store.read('score_student', ''),
    passLine: Number(TW.store.read('pass_line', 360)) || 360,
    calYear: 2026, calMonth: 8,
    hwWeekStart: '', pCalYear: 2026, pCalMonth: 8
  };
  var scoreEditing = false;
  var pointsSort = { key: 'name', dir: 1 };

  function ck(base){ return base + '_' + state.classId; }
  function cd(base, seed){
    var v = TW.store.read(ck(base), null);
    if (v == null) {
      if (state.classId === 'c1') return seed;
      // 新班级：数组返回空数组，对象深拷贝（避免共享种子引用，写入时跨班级污染）
      return Array.isArray(seed) ? [] : (seed && typeof seed === 'object' ? JSON.parse(JSON.stringify(seed)) : seed);
    }
    return v;
  }
  function cw(base, value){ return TW.store.write(ck(base), value); }
  /* 学校/教务台账：跨班级全局存储（切换班级数据不丢） */
  function gd(base, seed){
    var v = TW.store.read(base, null);
    if (v == null) return Array.isArray(seed) ? seed.slice() : seed;
    return v;
  }
  function gw(base, value){ return TW.store.write(base, value); }

  function classNameOf(){ return (classes.find(function(c){ return c.id === state.classId; }) || classes[0]).name; }
  /* 全局班级代码 → 班级显示名（多班级管理时跨模块使用；未知代码回退显示代码本身） */
  function classNameOfClassId(classId){
    var c = (classes || []).find(function(x){ return x.id === classId; });
    return c ? c.name : (classId || '—');
  }

  function hydrate(){
    TW.className = classNameOf();
    TW.students = cd('students', TW.studentsSeed);
    // 学生主键化：确保每个学生有唯一 sid（学籍号优先，缺省自动生成），各业务板块以 sid 关联
    TW.students = (TW.students || []).map(function(s, i){
      if (!s) s = {};
      if (!s.sid) s.sid = (s.id && String(s.id).trim()) || ('s_' + state.classId + '_' + i + '_' + Date.now().toString(36));
      if (!s.name) s.name = '学生' + (i + 1);
      // 全局班级代码：学生归属的班级 id（多班级管理时用于跨模块区分学生）
      if (!s.classId) s.classId = state.classId;
      return s;
    });
    TW.attendance = cd('attendance', TW.attendanceSeed);
    TW.exams = cd('exams', TW.examsSeed);
    TW.subjects = cd('subjects', TW.defaultSubjects);
    if (!Array.isArray(TW.subjects) || !TW.subjects.length) TW.subjects = TW.defaultSubjects.slice();
    TW.homework = cd('homework', TW.homeworkSeed);
    TW.meetings = cd('meetings', TW.meetingSeed);
    TW.meetingPlan = cd('meeting_plan', TW.meetingPlanSeed);
    TW.family = cd('family', TW.familySeed);
    TW.parentMeetings = cd('parent_meetings', TW.parentMeetingSeed);
    TW.familyPlan = cd('family_plan', TW.familyPlanSeed);
    TW.dorm = cd('dorm', TW.dormSeed);
    TW.dormVisits = cd('dorm_visits', TW.dormVisitSeed);
    TW.mental = cd('mental', TW.mentalSeed);
    TW.quality = cd('quality', TW.qualitySeed);
    TW.selection = cd('selection', TW.selectionSeed);
    TW.affairs = cd('affairs', TW.affairsSeed);
    TW.tasks = cd('tasks', TW.tasksSeed);
    TW.cleaning = cd('cleaning', TW.cleaningSeed);
    // 分数管理：按班级存储；初始值不落盘，渲染时对名单内学生默认 100 分（未加减分不产生空记录）
    TW.points = cd('points', []);
    // 谈话记录：归总到学生档案，按班级存储 {name, sid, type, time, content, note, audioId}
    TW.talks = cd('talks', []);
    // 个人事务（教师工作备忘录）：跨班级全局，日历型 {date, title, note}
    TW.personalMemo = gd('personal_memo', []);
    // 各班作业跟踪（周作业模板模块）：跨班级全局 [{cls, head, subject, rep, week, days:{周一..周五}}]
    TW.weeklyHomework = gd('weekly_homework', []);
    if (!Array.isArray(TW.weeklyHomework)) TW.weeklyHomework = [];
    // 课时管理：教学班 / 课表（单双周）/ 课时记录（跨班级全局）
    TW.lessonClasses = gd('lesson_classes', TW.lessonClassesSeed);
    if (!Array.isArray(TW.lessonClasses) || !TW.lessonClasses.length) TW.lessonClasses = TW.lessonClassesSeed.slice();
    TW.schedule = gd('schedule', TW.scheduleSeed);
    if (!TW.schedule || typeof TW.schedule !== 'object') TW.schedule = { odd: {}, even: {} };
    if (!TW.schedule.odd || typeof TW.schedule.odd !== 'object') TW.schedule.odd = {};
    if (!TW.schedule.even || typeof TW.schedule.even !== 'object') TW.schedule.even = {};
    TW.lessons = gd('lessons', []);
    if (!Array.isArray(TW.lessons)) TW.lessons = [];
    // 班级信息（班主任/学科/政治课代表）：{ 班级名: {head, subject, rep} }，可自定义
    TW.lessonClassInfo = gd('lesson_class_info', {});
    if (!TW.lessonClassInfo || typeof TW.lessonClassInfo !== 'object') TW.lessonClassInfo = {};
    // 学期名称可自定义（个人信息中修改，持久化覆盖 data.js 默认值）
    TW.semester = TW.store.read('semester', TW.semester);
    TW.userRecords = TW.store.read('user_records', []);
    migrateTalksOnce();
    ensureAttIds();
    // 全局班级代码：学生对象补 classId 后立即持久化（老数据一次性补齐，多班级管理时跨模块可区分）
    var _needClassSave = (TW.students || []).some(function(s){ return !s.classId; });
    if (_needClassSave) cw('students', TW.students);
  }
  hydrate();
  // 迁移：将旧「心理关注」模块的谈话记录并入学生档案谈话（每班仅执行一次）
  function migrateTalksOnce(){
    if (TW.store.read(ck('talks_migrated'), false)) return;
    // 用与 hydrate 相同的种子回退（cd('mental', []) 在 c1 会返回空数组，导致迁移漏掉种子谈话）
    var mental = cd('mental', TW.mentalSeed);
    var moved = 0;
    (mental || []).forEach(function(m){
      (m.talks || []).forEach(function(t){
        var dup = (TW.talks || []).some(function(x){ return x.name === m.name && x.time === t.time && x.content === t.content; });
        if (dup) return;
        TW.talks.push({ name: m.name, sid: recSid(m), type: '个人谈话', time: t.time, content: t.content || '', note: t.reaction || '', audioId: '' });
        moved++;
      });
    });
    if (moved) cw('talks', TW.talks);
    TW.store.write(ck('talks_migrated'), true);
  }
  // 考勤记录补全稳定 id（销假/编辑/删除按 id 定位，避免索引错位）；兼容旧格式已销假标记
  function ensureAttIds(){
    var changed = false;
    TW.attendance = (TW.attendance || []).map(function(r){
      if (!r) r = {};
      if (!r.id) { r.id = uid('att'); changed = true; }
      if (r.type && /已销假/.test(r.type) && !r.settled) {
        r.type = String(r.type).replace(/（已销假）|\(已销假\)/g, '').trim();
        r.settled = true; r.settledAt = r.settledAt || r.date || fmtNow();
        changed = true;
      }
      return r;
    });
    if (changed) cw('attendance', TW.attendance);
  }
  /* ================= 学生主键匹配（sid 优先，回退姓名，兼容历史数据） ================= */
  function studentBySid(sid){
    if (sid == null) return null;
    return (TW.students || []).find(function(s){ return s.sid === sid || (s.id && s.id === sid); }) || null;
  }
  function sidOfName(name){
    var s = (TW.students || []).find(function(x){ return x.name === name; });
    return s ? s.sid : (name || '');
  }
  function recSid(rec){
    if (rec && rec.sid != null) return rec.sid;
    if (rec && rec.name) return sidOfName(rec.name);
    return null;
  }
  function recName(rec){
    if (!rec) return '';
    if (rec.name) return rec.name;
    var s = studentBySid(rec.sid);
    return s ? s.name : '';
  }
  /* 谈话记录（归总到学生档案）：按学生姓名聚合 */
  function talksOf(name){ return (TW.talks || []).filter(function(t){ return t.name === name; }); }
  function talkCount(name){ return talksOf(name).length; }
  /* 某学生的跨板块引用计数（用于删除保护） */
  function studentRefCount(sid){
    var name = recName({ sid: sid });
    var n = 0;
    var parts = { 考勤: TW.attendance, 分数: TW.points, 心理: TW.mental, 综评: TW.quality, 选科: (TW.selection && TW.selection.intents) || [] };
    Object.keys(parts).forEach(function(k){
      var arr = parts[k] || [];
      n += arr.filter(function(r){ return recSid(r) === sid; }).length;
    });
    // 值日/宿舍成员为字符串，按姓名包含统计（尽力而为）
    ['cleaning','dorm'].forEach(function(k){
      (TW[k] || []).forEach(function(r){
        var members = String(r.members || '').split(/[、,，]/);
        if (members.indexOf(name) >= 0) n++;
      });
    });
    return n;
  }
  /* 学生删除引用保护：引用数 >0 时阻止删除并提示（供可编辑表格删除钩子调用） */
  TW.guardStudentDelete = function(name){
    var s = (TW.students || []).find(function(x){ return x.name === name; });
    if (!s) return '';
    var refs = studentRefCount(s.sid);
    if (refs > 0) {
      return '无法删除「' + name + '」：该生还有 ' + refs + ' 条关联记录（分数/考勤/心理/综评/选科/值日/宿舍等）。\n请先在对应板块清理这些记录，或确认后手动处理。';
    }
    return '';
  };
  // 应用已保存的界面主题（个人信息 → 界面主题 可切换：配色1 / 配色2 / 深夜模式）
  var savedTheme = TW.store.read('theme', '');
  if (savedTheme === 'badge' || savedTheme === 'dark' || savedTheme === 'default') document.documentElement.dataset.theme = savedTheme;
  // 暴露每班读写钩子（供可编辑表格在导入/编辑后同步班级名单）
  TW.cw = cw; TW.cd = cd;
  // 姓名 → sid 解析暴露给可编辑表格引擎（行操作按钮按当前行重绑）
  TW.sidOfName = sidOfName;
  // 可编辑表格行操作按钮构建器：学生档案表按当前行重建「成长档案 / 谈话」按钮，
  // 排序、新增、导入后按钮与行一一对应，谈话计数实时更新（"成长档案点不动"根因修复）。
  TW.editableActionBuilder = function(info, row){
    if (moduleOfContext(info.context) !== 'students') return '';
    var name = String(row[0] == null ? '' : row[0]).trim();
    if (!name) return '<button class="button text" data-action="view-student">成长档案</button>';
    return '<button class="button text" data-action="view-student" data-name="' + TW.escape(name) + '">成长档案</button>'
      + '<button class="button text" data-action="view-talks" data-name="' + TW.escape(name) + '">谈话' + (talkCount(name) ? '(' + talkCount(name) + ')' : '') + '</button>';
  };
  /* ============ 可编辑表格 → 业务镜像同步（表即真相，图表/KPI 实时联动） ============ */
  function normHomeworkDate(d){
    d = String(d == null ? '' : d).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    var now = new Date(), y = now.getFullYear();
    var dm = d.match(/^(\d{1,2})月(\d{1,2})日/);
    if (dm) { var dt = new Date(y, Number(dm[1]) - 1, Number(dm[2])); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
    var wm = d.match(/周([一二三四五六日天])/);
    if (wm) { var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0 }; var now0 = new Date(y, now.getMonth(), now.getDate()); var cur = (now0.getDay() + 6) % 7; var target = map[wm[1]]; var dt2 = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate() + ((target - cur + 7) % 7)); return dt2.getFullYear() + '-' + String(dt2.getMonth() + 1).padStart(2, '0') + '-' + String(dt2.getDate()).padStart(2, '0'); }
    return d;
  }
  function fmtDateLabel(d){
    var dt = new Date(d + 'T00:00:00');
    if (isNaN(dt)) return d;
    return ['周日','周一','周二','周三','周四','周五','周六'][dt.getDay()] + ' ' + (dt.getMonth() + 1) + '/' + dt.getDate();
  }
  function moduleOfContext(ctx){ if (ctx.indexOf('|students') >= 0) return 'students'; if (ctx.indexOf('|selection') >= 0) return 'selection'; if (ctx.indexOf('|homework') >= 0) return 'homework'; return null; }
  function mirrorKey(m){ return m === 'students' ? 'students' : m === 'selection' ? 'selection' : m === 'homework' ? 'homework' : 'attendance'; }
  function mirrorFromTable(m, rows){
    rows = rows || [];
    if (m === 'students') {
      return rows.map(function(r){
        return { name: String(r[0] == null ? '' : r[0]), id: String(r[1] == null ? '' : r[1]), gender: String(r[2] == null ? '' : r[2]), status: String(r[3] == null ? '' : r[3]), dorm: String(r[4] == null ? '' : r[4]), parent: String(r[5] == null ? '' : r[5]), phone: String(r[6] == null ? '' : r[6]), focusMark: String(r[7] == null ? '' : r[7]), focus: /关注/.test(String(r[7] || '')) ? 2 : 0, focusReason: '', classId: state.classId };
      });
    }
    if (m === 'selection') {
      var sel = { first: { physics: 0, history: 0 }, combos: {}, undecided: 0, intents: [] };
      rows.forEach(function(r){
        var name = String(r[0] || ''), first = String(r[1] || ''), combo = String(r[2] || '');
        sel.intents.push({ name: name, first: first, combos: combo });
        if (first === '物理') sel.first.physics += 1;
        else if (first === '历史') sel.first.history += 1;
        if (combo) sel.combos[combo] = (sel.combos[combo] || 0) + 1;
      });
      return sel;
    }
    if (m === 'homework') {
      return rows.map(function(r){ return { subject: String(r[0] || ''), date: String(r[1] || ''), content: String(r[2] || ''), minutes: Number(r[3]) || 0, difficulty: String(r[4] || '') }; });
    }
    if (m === 'attendance') {
      return rows.map(function(r){
        var type = String(r[2] || ''), settled = /已销假/.test(type);
        type = type.replace(/（已销假）|\(已销假\)/g, '').trim();
        return { date: String(r[0] || ''), name: String(r[1] || ''), type: type, note: String(r[3] || ''), settled: settled };
      });
    }
    return null;
  }
  function applyMirror(m, rows){
    var v = mirrorFromTable(m, rows);
    if (v === null) return;
    if (m === 'students') TW.students = v;
    else if (m === 'selection') TW.selection = v;
    else if (m === 'homework') TW.homework = v;
    else if (m === 'attendance') TW.attendance = v;
  }
  TW.onTableWrite = function(info, rows){
    if (!info || !info.context) return;
    var m = moduleOfContext(info.context);
    if (!m) return;
    applyMirror(m, rows);
    cw(mirrorKey(m), TW[m === 'students' ? 'students' : m === 'selection' ? 'selection' : m === 'homework' ? 'homework' : 'attendance']);
    requestAnimationFrame(drawModuleCharts);
    // 统计卡与表格数据同源联动（编辑/导入/撤销后即时更新，无需刷新）
    if (m === 'students') updateStudentStats();
    if (m === 'attendance') updateAttendanceStats();
    // 操作日志：表格增删改/导入自动记录到"本机个人记录"
    logModule(m, (rows || []).length + ' 行');
  };
  /* 学生档案统计卡实时刷新 */
  function updateStudentStats(){
    var rows = TW.students || [];
    var el;
    el = TW.$('#statStuCount'); if (el) el.textContent = rows.length;
    el = TW.$('#statStuDorm'); if (el) el.textContent = rows.filter(function(s){ return s.status === '住宿'; }).length;
    el = TW.$('#statStuFocus'); if (el) el.textContent = rows.filter(function(s){ return s.focus > 0; }).length;
    el = TW.$('#statStuMove'); if (el) el.textContent = rows.filter(function(s){ return s.status === '休学' || s.status === '转学'; }).length;
  }
  /* 考勤统计卡实时刷新 */
  function updateAttendanceStats(){
    var rows = TW.attendance || [];
    var el;
    el = TW.$('#statLate'); if (el) el.textContent = rows.filter(function(r){ return r.type === '迟到'; }).length;
    el = TW.$('#statAbsent'); if (el) el.textContent = rows.filter(function(r){ return r.type === '缺勤'; }).length;
    el = TW.$('#statLeave'); if (el) el.textContent = rows.filter(function(r){ return r.type === '请假'; }).length;
    el = TW.$('#statTotal'); if (el) el.textContent = rows.length;
  }
  // 撤销/重做后重建业务镜像（仅内存，不落盘不入撤销栈）
  function rebuildMirrors(){
    var et = TW.store.read('editable_tables_v2', {}) || {};
    Object.keys(et).forEach(function(k){
      var m = moduleOfContext(k);
      if (m) applyMirror(m, et[k]);
    });
  }
  function syncHistoryButtons(){
    var ub = TW.$('#undoBtn'), rb = TW.$('#redoBtn');
    if (ub) ub.disabled = !TW.store.canUndo();
    if (rb) rb.disabled = !TW.store.canRedo();
  }
  document.addEventListener('workbench:history', syncHistoryButtons);

  /* ================= 工具 ================= */
  function uid(p){ return (p||'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6); }
  function persistContext(){ TW.store.write('ui_context', { classId: state.classId, area: state.area, module: state.module }); }
  function contextId(){ return [state.area, state.classId, state.module].join('|'); }
  function currentRecords(){ return TW.userRecords.filter(function(r){ return r.context === contextId(); }); }
  function saveUserRecord(record){
    var i = TW.userRecords.findIndex(function(x){ return x.id === record.id; });
    if (i >= 0) TW.userRecords[i] = record; else TW.userRecords.unshift(record);
    return TW.store.write('user_records', TW.userRecords);
  }
  /* 操作日志：各板块的写操作自动生成"本机个人记录"条目（同一板块 30 秒内合并为一条，避免刷屏） */
  var MODULE_NAMES = { dashboard:'首页', affairs:'班级事务', students:'学生档案', attendance:'考勤管理', scores:'成绩分析', homework:'作业台账', meeting:'班会与德育', family:'家校沟通', dorm:'宿舍管理', quality:'综合素质', selection:'选科意向', cleaning:'值日表', points:'分数管理', alerts:'预警中心', personal:'个人事务' };
  function refreshRecordsPanel(){
    // 操作日志/个人记录变化后，局部重建页面底部的"本机个人记录"面板（不整体重渲染，避免打断输入）
    var root = TW.$('.local-records-panel');
    if (!root || !root.parentNode) return;
    var holder = document.createElement('section');
    holder.innerHTML = personalRecordsPanel();
    root.parentNode.replaceChild(holder.firstChild || holder, root);
  }
  function logRecord(title, note){
    var ctx = contextId(), now = new Date().toISOString();
    var last = TW.userRecords.find(function(r){ return r.context === ctx && r.kind === 'log' && (new Date(now) - new Date(r.createdAt)) < 30000; });
    if (last) {
      last.note = note || last.note; last.updatedAt = TW.format.now();
      TW.store.write('user_records', TW.userRecords);
    } else {
      saveUserRecord({ id: uid('r'), context: ctx, kind: 'log', title: title, date: now.slice(0, 10), note: note || '', status: '已记录', createdAt: now, updatedAt: TW.format.now() });
    }
    refreshRecordsPanel();
  }
  function logModule(m, note){ logRecord((MODULE_NAMES[m] || m) + '：数据已更新', note); }
  function saveWorkflowUpdate(kind, note, status){
    var u = { id: uid('wf'), context: contextId(), kind: kind, note: note || '', status: status || '已更新', at: new Date().toISOString() };
    TW.store.update('workflow_updates', function(items){ items = Array.isArray(items) ? items : []; items.unshift(u); return items; }, []);
    saveUserRecord({ id: u.id, context: u.context, kind: kind, title: kind, date: new Date().toISOString().slice(0,10), note: u.note, status: u.status, createdAt: u.at, updatedAt: TW.format.now() });
    return true;
  }
  function personalRecordsPanel(){
    var rows = currentRecords();
    return '<section class="section local-records-panel"><div class="section-title"><span>本机个人记录</span><small>' + rows.length + '条 · 自动保存到本机磁盘</small></div><div class="section-body">' + (rows.length ? '<div class="data-table-wrap"><table class="data-table"><thead><tr><th>事项</th><th>日期</th><th>备注</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows.map(function(r){ return '<tr><td>' + TW.escape(r.title) + '</td><td>' + TW.escape(r.date || '—') + '</td><td>' + TW.escape(r.note || '—') + '</td><td><span class="status-badge ok">' + TW.escape(r.status || '已保存') + '</span></td><td>' + (r.context ? '<button class="button text" data-action="goto-context" data-context="' + TW.escape(r.context) + '">前往</button>' : '') + '<button class="button text" data-action="edit-user-record" data-record-id="' + r.id + '">编辑</button><button class="button text danger-text" data-action="delete-user-record" data-record-id="' + r.id + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="alert info">这个页面还没有个人记录。</div>') + '</div></section>';
  }
  function draftFieldId(field, index){ return field.id || field.name || field.dataset.key || field.getAttribute('aria-label') || field.placeholder || field.tagName.toLowerCase() + '_' + index; }
  function bindDraftFields(root, key){
    var fields = TW.$$('input:not([type="file"]),select,textarea', root);
    if (!fields.length) return;
    var saved = TW.store.read(key, {});
    fields.forEach(function(field, index){
      var id = draftFieldId(field, index);
      if (!Object.prototype.hasOwnProperty.call(saved, id)) return;
      if (field.type === 'checkbox') field.checked = Boolean(saved[id]);
      else if (field.type !== 'radio' || field.value === saved[id]) field.value = saved[id];
    });
    var save = TW.store.autosave(key, 350), handler = function(){
      var data = {}; fields.forEach(function(field, index){ var id = draftFieldId(field, index); data[id] = field.type === 'checkbox' ? field.checked : field.value; }); save(data);
    };
    fields.forEach(function(field){ field.addEventListener('input', handler); field.addEventListener('change', handler); });
  }
  function fmtNow(){ return new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' }); }

  /* ================= 首页快捷入口（待办/事务 → 对应板块） ================= */
  var SCORE_MODULES = ['scores','homework','selection','points'];
  function areaOfModule(m){ return SCORE_MODULES.indexOf(m) >= 0 ? 'scores' : 'teaching'; }
  function taskTarget(kind){
    return { '成绩':'scores', '家校':'family', '德育':'meeting', '宿舍':'dorm', '选科':'selection', '心理':'students', '考试':'scores' }[kind] || 'affairs';
  }
  function gotoModule(m){
    state.module = m;
    state.area = areaOfModule(m);
    persistContext(); renderShell();
  }
  function gotoTask(el){
    gotoModule(taskTarget(el.dataset.kind));
  }
  function gotoAffair(el){
    var date = String(el.dataset.date || '');
    var d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : normHomeworkDate(date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      var dt = new Date(d + 'T00:00:00');
      state.calYear = dt.getFullYear(); state.calMonth = dt.getMonth();
    }
    state.module = 'affairs'; state.area = 'teaching';
    persistContext(); renderShell();
    quickAddAffair(d);
  }

  /* ================= 台账行查看/编辑/删除（通用：读业务键、可编辑、可删） ================= */
  /* 字段类型：text（默认） / date / textarea / select:选项A,选项B */
  var LIST_DEFS = {
    meetings:      { title:'班会记录', rows: function(){ return TW.meetings; },      fields: [['日期','date','date'],['主题','topic','text'],['内容','content','textarea'],['状态','status','text']], save: function(r){ cw('meetings', r); } },
    meetingPlan:   { title:'班会计划', rows: function(){ return TW.meetingPlan; },   fields: [['日期','date','date'],['主题','topic','text'],['目标','goal','text']], save: function(r){ cw('meeting_plan', r); } },
    family:        { title:'沟通历史', rows: function(){ return TW.family; },        fields: [['日期','date','date'],['方式','type','select:家访,电话,微信,面谈'],['对象','target','text'],['内容','content','textarea'],['反馈','feedback','textarea']], save: function(r){ cw('family', r); } },
    parentMeetings:{ title:'家长会记录', rows: function(){ return TW.parentMeetings; }, fields: [['日期','date','date'],['主题','topic','text'],['出勤','attendance','text'],['内容','content','textarea'],['状态','status','text']], save: function(r){ cw('parent_meetings', r); } },
    familyPlan:    { title:'沟通计划', rows: function(){ return TW.familyPlan; },    fields: [['日期','date','date'],['对象','target','text'],['原因','reason','text']], save: function(r){ cw('family_plan', r); } },
    dormVisits:    { title:'探访记录', rows: function(){ return TW.dormVisits; },    fields: [['日期','date','date'],['宿舍','room','text'],['备注','note','textarea']], save: function(r){ cw('dorm_visits', r); } },
    quality:       { title:'综合素质评价', rows: function(){ return TW.quality; },   fields: [['姓名','name','text'],['道德','moral','select:优,良,中'],['学业','academic','select:优,良,中'],['健康','health','select:优,良,中'],['艺术','art','select:优,良,中'],['劳动','labor','select:优,良,中'],['评语','comment','textarea']], save: function(r){ cw('quality', r); } },
    cleaning:      { title:'值日安排', rows: function(){ return TW.cleaning; },      fields: [['星期','week','select:周一,周二,周三,周四,周五,周六,周日'],['值日学生','members','text'],['值日内容','task','text']], save: function(r){ cw('cleaning', r); } }
  };
  function viewListRow(el){
    var def = LIST_DEFS[el.dataset.list];
    var rows = def ? def.rows() : null;
    var row = rows && rows[Number(el.dataset.idx)];
    if (!row) { TW.toast('记录不存在', 'danger'); return; }
    var html = '<div class="grid-2">' + def.fields.map(function(f){
      var v = row[f[1]] == null || row[f[1]] === '' ? '—' : String(row[f[1]]);
      return '<div class="stat-card"><div class="stat-label">' + f[0] + '</div><div class="stat-value" style="font-size:16px">' + TW.escape(v) + '</div></div>';
    }).join('') + '</div>';
    TW.modal('查看详情 · ' + def.title, html);
  }
  function editListRow(el){
    var def = LIST_DEFS[el.dataset.list];
    var rows = def ? def.rows() : null;
    var row = rows && rows[Number(el.dataset.idx)];
    if (!row) { TW.toast('记录不存在', 'danger'); return; }
    var html = '<div class="form-grid">' + def.fields.map(function(f){
      var key = f[1], label = f[0], type = f[2] || 'text';
      var val = row[key] == null ? '' : String(row[key]);
      var control;
      if (type.indexOf('select:') === 0) {
        var opts = type.slice(7).split(',');
        control = '<select id="er_' + key + '">' + opts.map(function(o){ return '<option' + (val === o ? ' selected' : '') + '>' + TW.escape(o) + '</option>'; }).join('') + '</select>';
      } else if (type === 'date') {
        control = '<input id="er_' + key + '" type="date" value="' + TW.escape(val) + '">';
      } else if (type === 'textarea') {
        control = '<textarea id="er_' + key + '" style="min-height:90px">' + TW.escape(val) + '</textarea>';
      } else {
        control = '<input id="er_' + key + '" value="' + TW.escape(val) + '">';
      }
      return '<div class="field' + (type === 'textarea' ? ' full' : '') + '"><label>' + label + '</label>' + control + '</div>';
    }).join('') + '</div>';
    TW.modal('编辑 · ' + def.title, html, '<button class="button secondary" data-close>取消</button><button class="button" id="erSave">保存</button>');
    TW.$('#erSave').onclick = function(){
      def.fields.forEach(function(f){
        var key = f[1], inp = TW.$('#er_' + key);
        if (inp) row[key] = inp.value.trim();
      });
      def.save(rows);
      TW.$('#modalRoot').innerHTML = ''; renderShell(); TW.toast('已保存修改');
    };
  }
  function deleteListRow(el){
    var def = LIST_DEFS[el.dataset.list];
    var rows = def ? def.rows() : null;
    var idx = Number(el.dataset.idx);
    var row = rows && rows[idx];
    if (!row) { TW.toast('记录不存在', 'danger'); return; }
    var label = row[def.fields[0][1]] || '该条';
    if (!confirm('确认删除「' + label + '」吗？')) return;
    rows.splice(idx, 1);
    def.save(rows);
    renderShell(); TW.toast('已删除');
  }

  /* ================= 启动与全局（单班级） ================= */
  function init(){
    bindGlobal();
    renderShell();
    // 页面锁：不输入密码无法观看。首次使用必须先设置密码。
    showLock(!(lockConfig && lockConfig.hash));
  }

  /* 通知未读：已读条数 = 上次打开通知中心时的待办数（按班级记忆） */
  function unreadNotify(){ return Math.max(0, (TW.tasks || []).length - Number(TW.store.read(ck('notify_seen_count'), 0))); }
  function renderNotifyBadge(){
    var el = TW.$('.notification-count');
    if (!el) return;
    var n = unreadNotify();
    el.textContent = n > 99 ? '99+' : String(n);
    el.style.display = n > 0 ? '' : 'none';
    TW.$('#notifyButton').setAttribute('aria-label', n > 0 ? '通知，有' + n + '条未读' : '通知中心');
  }

  function bindGlobal(){
    TW.$('#mobileMenu').onclick = function(){ TW.$('#sidebar').classList.toggle('open'); };
    TW.$('#lockButton').onclick = lockNow;
    TW.$('#undoBtn').onclick = function(){ var r = TW.store.undo(); if (r.ok) { rebuildMirrors(); renderShell(); TW.toast('已撤回上一次操作'); } else { TW.toast('没有可撤回的操作'); } };
    TW.$('#redoBtn').onclick = function(){ var r = TW.store.redo(); if (r.ok) { rebuildMirrors(); renderShell(); TW.toast('已回溯刚才的操作'); } else { TW.toast('没有可回溯的操作'); } };
    TW.$('#notifyButton').onclick = function(){
      var items = TW.tasks || [];
      var body = items.length
        ? '<ul class="mini-list" style="max-height:62vh;overflow:auto">' + items.map(function(t){
            return '<li><span>' + TW.escape(t.title) + '</span><span class="status-badge info">' + TW.escape(t.kind || '') + '</span><span class="status-badge ' + ((t.status === '待处理' || t.status === '待审批') ? 'warn' : 'ok') + '">' + TW.escape(t.due) + '</span></li>';
          }).join('') + '</ul>'
        : '<div class="alert info">暂无待办通知</div>';
      TW.modal('通知中心', body + '<p class="note" style="margin-top:12px">共 ' + items.length + ' 项待办 · 打开即视为已读，红点提醒将消失</p>');
      // 打开即已读：记录已读条数，清除强提醒红点
      TW.store.write(ck('notify_seen_count'), items.length);
      renderNotifyBadge();
    };
    TW.$$('.primary-tab').forEach(function(b){ b.onclick = function(){
      TW.$$('.primary-tab').forEach(function(x){ x.classList.remove('active'); x.setAttribute('aria-selected','false'); });
      b.classList.add('active'); b.setAttribute('aria-selected','true');
      state.area = b.dataset.area; state.module = state.area === 'teaching' ? 'dashboard' : 'scores'; persistContext(); renderShell();
    }; });
  }

  /* ================= 外壳渲染 ================= */
  /* 侧边栏模块拖拽排序（Apple 风格）：Pointer Events + FLIP 让位动画
   * 顺序持久化到 module_order_<area>，个人信息/分组标题不参与排序 */
  var SORT_ANIM_MS = 240;
  function moduleOrderKey(area){ return 'module_order_' + area; }
  function applyModuleOrder(mods, area){
    var saved = TW.store.read(moduleOrderKey(area), null);
    if (!Array.isArray(saved) || !saved.length) return mods;
    var byId = {};
    mods.forEach(function(m){ byId[m[0]] = m; });
    var out = [];
    saved.forEach(function(id){ if (byId[id]) { out.push(byId[id]); delete byId[id]; } });
    Object.keys(byId).forEach(function(id){ out.push(byId[id]); });
    return out;
  }
  function enableSidebarSort(){
    var sidebar = TW.$('#sidebar');
    if (!sidebar || sidebar.dataset.sortable) return;
    sidebar.dataset.sortable = '1';
    var items = function(){ return TW.$$('.sidebar-item[data-module]', sidebar); };
    var dragState = null;
    var suppressClick = false;
    sidebar.addEventListener('click', function(e){
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
    }, true);
    /* Apple 风格拖拽模型：
     * 1) 拖动全程 DOM 顺序不动，被拖项 transform 跟随指针（始终相对原始文档位置 → 绝不跳跃）
     * 2) 其余项按目标插入位用 transform 让位（上/下让出一个行高）
     * 3) 松手时一次性重排 DOM + FLIP 播放让位/落位动画 */
    function rowHeight(){ return dragState && dragState.h || 44; }
    function applySlots(target){
      // 让位：仅改动其他项的 transform，不触碰 DOM
      var idx = dragState.idx, h = rowHeight();
      items().forEach(function(el, i){
        if (el === dragState.el) return;
        var shift = 0;
        if (target < idx) { if (i >= target && i < idx) shift = h; }
        else if (target > idx) { if (i > idx && i <= target) shift = -h; }
        el.style.transition = 'transform ' + SORT_ANIM_MS + 'ms cubic-bezier(.22,.8,.26,1)';
        el.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
      });
    }
    sidebar.addEventListener('pointerdown', function(e){
      if (e.button !== 0 || (e.pointerType && e.pointerType !== 'mouse')) return;
      var el = e.target && e.target.closest ? e.target.closest('.sidebar-item[data-module]') : null;
      if (!el) return;
      var list = items();
      var idx = list.indexOf(el);
      if (idx < 0) return;
      // 清理上一轮拖拽残留的内联样式，保证本次 transform 立即生效、rect 读取无动画中间值
      list.forEach(function(x){ x.style.transform = ''; x.style.transition = ''; });
      var r = el.getBoundingClientRect();
      dragState = { el: el, idx: idx, h: r.height, startY: e.clientY, startScroll: sidebar.scrollTop, target: idx, moved: false, pointerId: e.pointerId };
    });
    sidebar.addEventListener('pointermove', function(e){
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      var dy = e.clientY - dragState.startY;
      if (!dragState.moved && Math.abs(dy) < 6) return;
      if (!dragState.moved) {
        dragState.moved = true;
        document.body.classList.add('wb-sorting');
        dragState.el.classList.add('sort-dragging');
        try { dragState.el.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
      // 被拖项：transform 相对原始文档位置跟随指针（补偿容器滚动）
      var scrollDelta = sidebar.scrollTop - dragState.startScroll;
      dragState.el.style.transform = 'translateY(' + (dy - scrollDelta) + 'px) scale(1.035)';
      // 容器边缘自动滚动
      var sr = sidebar.getBoundingClientRect();
      if (e.clientY < sr.top + 26) sidebar.scrollTop -= 10;
      else if (e.clientY > sr.bottom - 26) sidebar.scrollTop += 10;
      // 计算目标插入位（按其余项中线；拖动项自身不计入，DOM 顺序未变）
      var others = items().filter(function(x){ return x !== dragState.el; });
      var target = others.length;
      for (var i = 0; i < others.length; i++) {
        var r = others[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { target = i; break; }
      }
      if (target === dragState.target) return;
      dragState.target = target;
      applySlots(target);
    });
    function endDrag(e){
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      var d = dragState, moved = d.moved;
      dragState = null;
      document.body.classList.remove('wb-sorting');
      if (!moved) return;
      suppressClick = true; setTimeout(function(){ suppressClick = false; }, 60);
      var el = d.el;
      el.classList.remove('sort-dragging');
      el.style.transform = ''; el.style.transition = '';
      var others = items().filter(function(x){ return x !== el; });
      // FLIP：记录让位后的当前位置 → 一次性重排 DOM → 播放落位过渡
      var from = {};
      others.forEach(function(o){ from[o.dataset.module] = o.getBoundingClientRect().top; });
      others.forEach(function(o){ o.style.transition = 'none'; o.style.transform = ''; });
      sidebar.insertBefore(el, d.target >= others.length ? null : others[d.target]);
      others.forEach(function(o){
        var key = o.dataset.module;
        if (from[key] == null) return;
        var delta = from[key] - o.getBoundingClientRect().top;
        if (Math.abs(delta) < 1) { o.style.transition = ''; o.style.transform = ''; return; }
        o.style.transform = 'translateY(' + delta + 'px)';
        void o.offsetHeight;
        o.style.transition = 'transform ' + SORT_ANIM_MS + 'ms cubic-bezier(.22,.8,.26,1)';
        o.style.transform = '';
      });
      var ids = items().map(function(x){ return x.dataset.module; });
      TW.store.write(moduleOrderKey(state.area), ids);
      // 动画结束后清理内联样式，交还 CSS 规则（hover 等过渡不受残留影响）
      setTimeout(function(){
        items().forEach(function(o){ o.style.transform = ''; o.style.transition = ''; });
      }, SORT_ANIM_MS + 80);
      TW.toast('已保存模块顺序');
    }
    sidebar.addEventListener('pointerup', endDrag);
    sidebar.addEventListener('pointercancel', endDrag);
  }
  function renderShell(){
    // 成绩编辑态下切换页面：先把当前表格内的修改写入（避免"完成编辑"前切走丢失）
    if (scoreEditing && state.module === 'scores') commitScoreTable();
    var _clLabel = TW.$('#classFixedLabel');
    if (_clLabel) _clLabel.textContent = classNameOf();
    var mods = applyModuleOrder(state.area === 'teaching' ? TW.teachingModules : TW.scoreModules, state.area);
    TW.$('#sidebar').innerHTML = '<div class="sidebar-group-title">' + (state.area === 'teaching' ? '班级工作' : '成绩管理') + '</div>' + mods.map(function(m){ return '<button class="sidebar-item ' + (state.module === m[0] ? 'active' : '') + '" data-module="' + m[0] + '" title="拖动可调整顺序"><span>' + m[1] + '</span></button>'; }).join('') + '<div class="sidebar-divider"></div><button class="sidebar-item" id="profileNav" title="个人信息：锁屏密码与本机数据"><span>个人信息</span></button>';
    TW.$$('[data-module]', TW.$('#sidebar')).forEach(function(b){ b.onclick = function(){ state.module = b.dataset.module; persistContext(); TW.$('#sidebar').classList.remove('open'); renderShell(); }; });
    enableSidebarSort();
    var pn = TW.$('#profileNav'); if (pn) pn.onclick = function(){ TW.$('#sidebar').classList.remove('open'); openProfile(); };
    TW.$('#identityStatus').textContent = classNameOf() + '班主任';
    TW.$('#todoStatus').textContent = '待办' + (TW.tasks.length || 0) + '项';
    TW.$('#syncStatus').textContent = '已保存到本机：' + TW.format.now();
    renderNotifyBadge();
    syncHistoryButtons();
    TW.$('#mainContent').innerHTML = renderModule();
    var pageHead = TW.$('.page-head', TW.$('#mainContent'));
    if (pageHead && state.area === 'teaching' && state.module === 'dashboard') pageHead.insertAdjacentHTML('afterend', campusHero());
    TW.$('#mainContent').insertAdjacentHTML('beforeend', personalRecordsPanel());
    TW.$('#drawer').classList.add('hidden'); TW.$('.workspace').classList.remove('with-drawer');
    if (TW.editable) TW.editable.mount(TW.$('#mainContent'), contextId());
    bindModule();
  }

  function head(title, desc, actions){
    return '<div class="breadcrumbs">' + (state.area === 'teaching' ? '班级工作' : '成绩管理') + ' / ' + title + '</div><div class="page-head"><div><h1>' + title + '</h1><div class="muted">' + (desc || (TW.school + ' · ' + classNameOf())) + '</div></div><div class="head-actions">' + (actions || '') + '</div></div>';
  }

  function dueDays(t){
    var d = String(t.due || '');
    var now = new Date(), today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (/今天|今日/.test(d)) return 0;
    if (/明天|明日/.test(d)) return 1;
    var wm = d.match(/周([一二三四五六日天])/);
    if (wm) { var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0 }; return (map[wm[1]] - ((today0.getDay() + 6) % 7) + 7) % 7; }
    var dm = d.match(/(\d{1,2})月(\d{1,2})日/);
    if (dm) { var dt = new Date(today0.getFullYear(), Number(dm[1]) - 1, Number(dm[2])); var days = Math.round((dt - today0) / 86400000); return days < 0 ? 365 + days : days; }
    return 999;
  }
  function campusHero(){
    var pending = TW.tasks.filter(function(t){ return t.status === '待处理' || t.status === '待审批' || t.status === '待审核'; });
    var urgent = pending.filter(function(t){ return dueDays(t) <= 3; }).sort(function(a, b){ return dueDays(a) - dueDays(b); });
    // 任务提醒：精简头部，展示更多条目（最多 8 条）
    var heroList = urgent.length ? urgent.slice(0, 8) : [];
    var urgentHtml = urgent.length
      ? '<div class="hero-tasks-head">近 3 天任务提醒 <span class="hero-tasks-count">' + urgent.length + ' 项</span></div><ul class="hero-tasks-list">' + heroList.map(function(t){ return '<li role="button" tabindex="0" class="quick-entry" data-action="goto-task" data-kind="' + TW.escape(t.kind || '') + '" title="前往对应板块"><span class="hero-task-title">' + TW.escape(t.title) + '</span><span class="hero-task-due">' + TW.escape(t.due) + ' ›</span></li>'; }).join('') + (urgent.length > 8 ? '<li class="hero-tasks-more">… 还有 ' + (urgent.length - 8) + ' 项待办</li>' : '') + '</ul>'
      : '<div class="hero-tasks-empty">近 3 天无待办任务，一切就绪</div>';
    // 本周课时预览（跳转课时管理）：课表 + 手动记录 合并（与课时管理模块联动）
    var weekStart = weekMonday(null);
    var wkDates = [];
    for (var i = 0; i < 7; i++) { var d = new Date(weekStart); d.setDate(weekStart.getDate() + i); wkDates.push(dateStr(d)); }
    // 某天课时集合：课表节次 + 手动记录班级（去重，与课时管理一致）
    function dayLessons(ds){
      var list = [];
      var seen = {};
      scheduleFor(ds).forEach(function(t){
        if (!seen[t.cls]) { seen[t.cls] = 1; list.push({ cls: t.cls, period: t.period, manual: false }); }
      });
      (TW.lessons || []).forEach(function(l){
        if (l.date === ds && !seen[l.cls]) { seen[l.cls] = 1; list.push({ cls: l.cls, period: 0, manual: true }); }
      });
      return list;
    }
    // 本周课时：按班级分组，一个班级一张卡片（只展示 星期 + 节次，无"手动"标签与状态徽标）
    var weekGroups = {}; // cls -> [{ds, period, manual}]
    wkDates.forEach(function(ds){
      dayLessons(ds).forEach(function(t){
        (weekGroups[t.cls] = weekGroups[t.cls] || []).push({ ds: ds, period: t.period });
      });
    });
    var dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    var clsOrder = {};
    (TW.lessonClasses || []).forEach(function(c, i){ clsOrder[c] = i; });
    var weekCls = Object.keys(weekGroups).sort(function(a, b){
      var ia = clsOrder[a], ib = clsOrder[b];
      if (ia != null && ib != null) return ia - ib;
      if (ia != null) return -1; if (ib != null) return 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    var lessonPreview = weekCls.length
      ? '<div class="hero-lesson-grid">' + weekCls.map(function(cls){
          var list = weekGroups[cls];
          return '<div class="hero-lesson-card" data-action="goto-lessons" role="button" tabindex="0" title="点击进入课时管理"><div class="hero-lesson-head">' + TW.escape(cls) + ' <span class="hero-tasks-count">' + list.length + ' 节</span></div><ul class="hero-lesson-list">' + list.map(function(t){
            return '<li><span class="hero-lesson-day">' + dayNames[(new Date(t.ds + 'T00:00:00').getDay() + 6) % 7] + '</span>' + (t.period ? '<span class="hero-lesson-period">第' + t.period + '节</span>' : '') + '</li>';
          }).join('') + '</ul></div>';
        }).join('') + '</div>'
      : '<div class="hero-lesson-card hero-lesson-empty" data-action="goto-lessons" role="button" tabindex="0" title="点击进入课时管理"><div class="hero-lesson-head">本周课时 <span class="hero-tasks-count">0 节</span></div><div class="hero-lesson-note">本周暂无课时 · 点击去课时管理添加</div></div>';
    return '<section class="campus-hero"><div class="campus-visual"><div class="campus-backdrop"></div><div class="campus-grid-lines"></div><div class="campus-hero-copy">' + urgentHtml + '</div></div><div class="campus-metrics"><div><span>今日异常</span><strong>' + TW.attendance.length + '</strong><small>考勤异常记录</small></div><div><span>班级人数</span><strong>' + TW.students.length + '</strong><small>' + classNameOf() + '</small></div><div><span>待办闭环</span><strong>' + pending.length + '</strong><small>未处理</small></div><div class="campus-signal"><i></i><span>本地磁盘</span><strong>已保存</strong></div></div></section>'
      + '<section class="section"><div class="section-title">本周课时 <small>点击卡片进入课时管理 · 记录上课内容与计划</small></div><div class="section-body">' + lessonPreview + '</div></section>';
  }

  /* ================= 页面构建器 ================= */
  function renderModule(){
    var f = { dashboard: dashboard, lessons: lessons, affairs: affairs, students: students, attendance: attendance, scores: scores, homework: homework, meeting: meeting, family: family, dorm: dorm, quality: quality, selection: selection, cleaning: cleaning, points: points, alerts: alerts, personal: personal };
    return (f[state.module] || dashboard)();
  }

  function dashboard(){
    var pending = TW.tasks.filter(function(t){ return t.status === '待处理' || t.status === '待审批'; }).sort(function(a, b){ return dueDays(a) - dueDays(b); });
    var mentalWatch = TW.mental.length;
    var upcoming = TW.affairs.filter(function(a){ return a.date >= new Date().toISOString().slice(0,10); }).sort(function(a,b){ return a.date < b.date ? -1 : 1; }).slice(0, 4);
    // 今日值日（今天星期几）
    var todayIdx = (new Date().getDay() + 6) % 7;
    var todayDuty = (TW.cleaning || []).filter(function(c){ return c.week === CLEAN_WEEKS[todayIdx]; })[0];
    // 预警数（复用 alerts 逻辑的轻量版）
    var alertCount = (TW.students || []).filter(function(s){
      var low = pointTotal(s.sid) < 95;
      var mentalNoTalk = (TW.mental || []).some(function(m){ return recSid(m) === s.sid && m.level >= 2 && !(m.talks || []).length; });
      var absent = (TW.attendance || []).filter(function(a){ return recSid(a) === s.sid && a.type === '缺勤'; }).length >= 3;
      return low || mentalNoTalk || absent;
    }).length;
    return head('班级总览', '今天 · ' + classNameOf() + '班主任 · ' + TW.semester, '<button class="button" data-action="new-record">+ 快速记一笔</button>')
      + '<div class="grid-4">'
      + '<div class="stat-card"><div class="stat-label">学生人数</div><div class="stat-value">' + TW.students.length + '</div><div class="stat-sub">' + classNameOf() + '</div></div>'
      + '<div class="stat-card"><div class="stat-label">待办事项</div><div class="stat-value">' + pending.length + '</div><div class="stat-sub">需跟进</div></div>'
      + '<div class="stat-card"><div class="stat-label">今日值日</div><div class="stat-value">' + (todayDuty ? (todayDuty.members || '').split(/[、,，]/).length : 0) + '</div><div class="stat-sub">' + CLEAN_WEEKS[todayIdx] + (todayDuty ? ' · ' + todayDuty.task : ' · 未安排') + '</div></div>'
      + '<div class="stat-card"><div class="stat-label">预警学生</div><div class="stat-value ' + (alertCount ? 'danger-text' : '') + '">' + alertCount + '</div><div class="stat-sub">积分/心理/考勤</div></div>'
      + '</div>'
      + (todayDuty ? '<section class="section"><div class="section-title">今日值日 <small>' + CLEAN_WEEKS[todayIdx] + ' · ' + TW.escape(todayDuty.task || '') + '</small></div><div class="section-body"><div class="mini-list">' + String(todayDuty.members || '').split(/[、,，]/).map(function(n){ return '<li><span>' + TW.escape(n.trim()) + '</span></li>'; }).join('') + '</div></div></section>' : '')
      + '<section class="section"><div class="section-title">今日待办 <small>按时间排序 · 点击直达对应板块</small></div><div class="section-body"><ul class="mini-list">' + (pending.length ? pending.map(function(t){ return '<li><button class="quick-link" data-action="goto-task" data-kind="' + TW.escape(t.kind || '') + '" title="前往对应板块"><span>' + TW.escape(t.title) + '</span><span class="status-badge warn">' + TW.escape(t.due) + ' ›</span></button></li>'; }).join('') : '<li><span>暂无待办</span></li>') + '</ul></div></section>'
      + '<section class="section"><div class="section-title">近期班级事务 <small>点击直达对应日期</small></div><div class="section-body"><ul class="mini-list">' + (upcoming.length ? upcoming.map(function(a){ return '<li><button class="quick-link" data-action="goto-affair" data-date="' + TW.escape(a.date) + '" title="前往班级事务日历"><span>' + TW.escape(a.title) + '</span><span class="status-badge info">' + a.date + ' ›</span></button></li>'; }).join('') : '<li><span>暂无安排</span></li>') + '</ul></div></section>';
  }

  function affairs(){
    var y = state.calYear, m = state.calMonth;
    var first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7;
    var days = new Date(y, m + 1, 0).getDate();
    var byDate = {};
    TW.affairs.forEach(function(a){ (byDate[a.date] = byDate[a.date] || []).push(a); });
    var cells = '';
    for (var i = 0; i < startDow; i++) cells += '<div class="cal-cell empty"></div>';
    for (var d = 1; d <= days; d++){
      var ds = y + '-' + String(m + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var evs = byDate[ds] || [];
      var today = (new Date().getFullYear() === y && new Date().getMonth() === m && new Date().getDate() === d);
      cells += '<div class="cal-cell cal-clickable ' + (today ? 'today' : '') + '" data-date="' + ds + '" tabindex="0" role="button" aria-label="' + ds + '，点击查看或录入当日事务"><div class="cal-day">' + d + '</div>' + evs.map(function(e){ return '<div class="cal-event ' + affairColorClass(e) + '"' + affairColorStyle(e) + ' title="' + TW.escape(e.title + (e.note ? '：' + e.note : '')) + '">' + TW.escape(e.title) + '</div>'; }).join('') + '</div>';
    }
    var monthLabel = y + '年' + (m + 1) + '月';
    return head('班级事务', '以日历形式管理班级日程、活动与重要节点', '<button class="button secondary" data-action="cal-prev">‹ 上月</button><button class="button secondary" data-action="cal-next">下月 ›</button><button class="button" data-action="new-affair">+ 新增事务</button>')
      + '<section class="section"><div class="section-title"><span>班级日历</span><small>' + monthLabel + ' · 点击日期查看/新增当日事务</small></div><div class="section-body"><div class="calendar"><div class="cal-head">' + ['一','二','三','四','五','六','日'].map(function(d){ return '<div>' + d + '</div>'; }).join('') + '</div><div class="cal-grid">' + cells + '</div></div></div></section>';
  }
  function kindClass(k){ return { '德育':'c-deyu','家校':'c-jiaxiao','活动':'c-huodong','教学':'c-jiaoxue','考试':'c-kaoshi' }[k] || 'c-other'; }
  /* 内容自定义颜色（8 色）：渲染为浅底深字色块 */
  var MACARON_COLORS = [
    { id: 'mac1', name: '樱花粉', bg: '#FFD6DD', fg: '#8C3A4A' },
    { id: 'mac2', name: '薄荷绿', bg: '#D2F2E0', fg: '#2E6B4F' },
    { id: 'mac3', name: '天空蓝', bg: '#D3E8FF', fg: '#2E5A8C' },
    { id: 'mac4', name: '柠檬黄', bg: '#FFF3C9', fg: '#8A6D1F' },
    { id: 'mac5', name: '薰衣草紫', bg: '#E6DBFF', fg: '#5B3F8C' },
    { id: 'mac6', name: '蜜桃橙', bg: '#FFE2C9', fg: '#8C5A2E' },
    { id: 'mac7', name: '抹茶绿', bg: '#E3EFC9', fg: '#5C7A2E' },
    { id: 'mac8', name: '玫瑰红', bg: '#FFD9E2', fg: '#8C3A5A' }
  ];
  function macaronById(id){ for (var i = 0; i < MACARON_COLORS.length; i++) if (MACARON_COLORS[i].id === id) return MACARON_COLORS[i]; return null; }
  function affairColorClass(e){ return e && e.color ? 'c-' + e.color : kindClass(e && e.kind); }
  function affairColorStyle(e){
    var m = e && e.color ? macaronById(e.color) : null;
    return m ? ' style="background:' + m.bg + ';color:' + m.fg + '"' : '';
  }
  /* 颜色选择器 HTML（8 个马卡龙色块单选，纯色块无文字） */
  function macaronPickerHtml(selected, inputId){
    return '<div class="macaron-picker" id="' + inputId + '" role="radiogroup" aria-label="选择内容颜色">' + MACARON_COLORS.map(function(m){
      return '<button type="button" class="macaron-swatch' + (selected === m.id ? ' selected' : '') + '" data-color="' + m.id + '" title="' + m.name + '" aria-label="' + m.name + '" role="radio" aria-checked="' + (selected === m.id ? 'true' : 'false') + '" style="--swatch:' + m.bg + ';--swatch-fg:' + m.fg + '"></button>';
    }).join('') + '</div>';
  }
  function bindMacaronPicker(containerId, onPick){
    var box = TW.$('#' + containerId);
    if (!box) return;
    TW.$$('.macaron-swatch', box).forEach(function(b){
      b.onclick = function(){
        TW.$$('.macaron-swatch', box).forEach(function(x){ x.classList.remove('selected'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('selected'); b.setAttribute('aria-checked', 'true');
        if (onPick) onPick(b.dataset.color);
      };
    });
  }
  function selectedMacaron(containerId){
    var b = TW.$('#' + containerId + ' .macaron-swatch.selected');
    return b ? b.dataset.color : '';
  }

  function students(){
    var rows = TW.students || [];
    var watch = rows.filter(function(s){ return s.focus > 0; }).length;
    return head('学生档案', '学籍、宿舍、家长联系方式与重点关注', '<button class="button" data-action="new-student">+ 新增学生</button><button class="button secondary" data-action="export-students">导出名单</button>')
      + '<div class="grid-4"><div class="stat-card"><div class="stat-label">学生人数</div><div class="stat-value" id="statStuCount">' + rows.length + '</div><div class="stat-sub">' + classNameOf() + '</div></div><div class="stat-card"><div class="stat-label">住宿生</div><div class="stat-value" id="statStuDorm">' + rows.filter(function(s){ return s.status === '住宿'; }).length + '</div><div class="stat-sub">宿舍管理联动</div></div><div class="stat-card"><div class="stat-label">重点关注</div><div class="stat-value danger-text" id="statStuFocus">' + watch + '</div><div class="stat-sub">心理与家校跟进</div></div><div class="stat-card"><div class="stat-label">学籍异动</div><div class="stat-value" id="statStuMove">' + rows.filter(function(s){ return s.status === '休学' || s.status === '转学'; }).length + '</div><div class="stat-sub">休学/转学</div></div></div>'
      + '<section class="section"><div class="section-title">学生档案 <small>可编辑 · 成长档案与谈话记录归总于此</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>姓名</th><th>学籍号</th><th>性别</th><th>学籍状态</th><th>宿舍</th><th>家长</th><th>联系电话</th><th>重点标记</th><th>操作</th></tr></thead><tbody>' + rows.map(function(s){ return '<tr><td>' + TW.escape(s.name) + '</td><td class="mono">' + TW.escape(s.id || '') + '</td><td>' + (s.gender || '') + '</td><td>' + (s.status || '') + '</td><td>' + TW.escape(s.dorm || '') + '</td><td>' + TW.escape(s.parent || '') + '</td><td class="mono">' + TW.escape(s.phone || '') + '</td><td>' + (s.focus > 0 ? '重点关注' : '—') + '</td><td><button class="button text" data-action="view-student" data-name="' + TW.escape(s.name) + '">成长档案</button><button class="button text" data-action="view-talks" data-name="' + TW.escape(s.name) + '">谈话' + (talkCount(s.name) ? '(' + talkCount(s.name) + ')' : '') + '</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>';
  }

  function attendance(){
    var rows = TW.attendance || [];
    var unsettled = rows.filter(function(r){ return !r.settled; });
    var settled = rows.filter(function(r){ return r.settled; });
    var late = unsettled.filter(function(r){ return r.type === '迟到'; }).length;
    var absent = unsettled.filter(function(r){ return r.type === '缺勤'; }).length;
    var leave = unsettled.filter(function(r){ return r.type === '请假'; }).length;
    return head('考勤管理', '仅记录异常考勤（迟到 / 缺勤 / 请假），正常出勤无需登记', '<button class="button" data-action="new-attendance">+ 记录异常</button><button class="button secondary" data-action="export-attendance">导出</button>')
      + '<div class="grid-4"><div class="stat-card"><div class="stat-label">迟到</div><div class="stat-value" id="statLate">' + late + '</div><div class="stat-sub">人次</div></div><div class="stat-card"><div class="stat-label">缺勤</div><div class="stat-value danger-text" id="statAbsent">' + absent + '</div><div class="stat-sub">人次</div></div><div class="stat-card"><div class="stat-label">待销假</div><div class="stat-value" id="statLeave">' + leave + '</div><div class="stat-sub">请假未销</div></div><div class="stat-card"><div class="stat-label">异常合计</div><div class="stat-value" id="statTotal">' + unsettled.length + '</div><div class="stat-sub">未销假</div></div></div>'
      + '<section class="section"><div class="section-title">未销假记录 <small>请假记录可在此销假 · 支持编辑与删除</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>日期</th><th>学生</th><th>类型</th><th>备注</th><th>操作</th></tr></thead><tbody>' + unsettled.map(function(r){ return '<tr><td class="mono">' + r.date + '</td><td>' + TW.escape(r.name) + '</td><td><span class="status-badge ' + (r.type === '迟到' ? 'warn' : (r.type === '缺勤' ? 'danger' : 'info')) + '">' + r.type + '</span></td><td>' + TW.escape(r.note || '') + '</td><td>' + (r.type === '请假' ? '<button class="button text" data-action="settle-attendance" data-att-id="' + r.id + '">销假</button>' : '') + '<button class="button text" data-action="edit-attendance" data-att-id="' + r.id + '">编辑</button><button class="button text danger-text" data-action="del-attendance" data-att-id="' + r.id + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>'
      + '<section class="section"><div class="section-title">已销假历史 <small>已销假的请假记录存档</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>日期</th><th>学生</th><th>类型</th><th>备注</th><th>销假时间</th><th>操作</th></tr></thead><tbody>' + (settled.length ? settled.map(function(r){ return '<tr><td class="mono">' + r.date + '</td><td>' + TW.escape(r.name) + '</td><td><span class="status-badge info">' + r.type + '（已销假）</span></td><td>' + TW.escape(r.note || '') + '</td><td>' + TW.escape(r.settledAt || '—') + '</td><td><button class="button text danger-text" data-action="del-attendance" data-att-id="' + r.id + '">删除</button></td></tr>'; }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--ink-3)">暂无已销假记录</td></tr>') + '</tbody></table></div></div></section>';
  }

  function scores(){
    var exams = TW.exams || [];
    var exam = exams.find(function(e){ return e.id === state.examId; }) || exams[0];
    // 新班级尚无考试记录时：提供占位考试，避免渲染崩溃（"成绩管理打不开"的根因）
    if (!exam) {
      exam = { id: 'ex_new', name: '新增考试', date: new Date().toISOString().slice(0, 10), scores: [] };
      exams = [exam];
    }
    var subj = TW.subjects;
    var rows = (exam && exam.scores) || [];
    function total(r){ return subj.reduce(function(s,k){ return s + (Number(r[k]) || 0); }, 0); }
    var avg = rows.length ? Math.round(rows.reduce(function(s,r){ return s + total(r); }, 0) / rows.length) : 0;
    var maxScore = rows.length ? Math.max.apply(null, rows.map(total)) : 0;
    var passLine = state.passLine; // 达标总分线（用户可调，见工具栏输入框）
    var pass = rows.length ? rows.filter(function(r){ return total(r) >= passLine; }).length : 0;
    var cmp = state.scoreCmp || {};
    var cmpSubject = cmp.subject || '总分';
    var cmpStudents = cmp.students || rows.slice(0, Math.min(4, rows.length)).map(function(r){ return r.name; });
    function studentOptions(selName){
      return '<option value="">（选择学生）</option>' + rows.map(function(r){ return '<option value="' + TW.escape(r.name) + '" ' + (selName === r.name ? 'selected' : '') + '>' + TW.escape(r.name) + '</option>'; }).join('');
    }
    return head('成绩分析', '多考试 · 自定义学科 · 趋势/均分/学生对比/班级对比', '<button class="button" data-action="new-exam">+ 新增考试</button><button class="button" data-action="import-exam">上传成绩</button><button class="button secondary" data-action="manage-subjects">学科设置</button><button class="button secondary" data-action="export-exam">导出本次成绩</button>')
      + '<div class="toolbar score-toolbar" style="margin:14px 0;flex-wrap:wrap;gap:10px"><label class="field" style="width:320px;max-width:100%"><span class="note">考试</span><select id="examSelect">' + exams.map(function(e){ return '<option value="' + e.id + '" ' + (e.id === exam.id ? 'selected' : '') + '>' + e.name + '（' + e.date + '）</option>'; }).join('') + '</select></label><label class="field" style="width:300px;max-width:100%"><span class="note">趋势学生</span><select id="scoreStudentSelect"><option value="">全部学生均分</option>' + rows.map(function(r){ return '<option value="' + TW.escape(r.name) + '" ' + (state.scoreStudent === r.name ? 'selected' : '') + '>' + TW.escape(r.name) + '</option>'; }).join('') + '</select></label><label class="field" style="width:240px;max-width:100%"><span class="note">达标总分线（可调）</span><input id="passLineInput" type="number" min="0" step="10" value="' + passLine + '"></label></div>'
      + '<div class="grid-4"><div class="stat-card"><div class="stat-label">班级总分均分</div><div class="stat-value" id="scoreAvg">' + avg + '</div><div class="stat-sub" id="scoreAvgSub">' + exam.name + '</div></div><div class="stat-card"><div class="stat-label">最高总分</div><div class="stat-value" id="scoreMax">' + maxScore + '</div><div class="stat-sub" id="scoreRef">' + rows.length + '人参考</div></div><div class="stat-card"><div class="stat-label">达标人数</div><div class="stat-value" id="scorePass">' + pass + '</div><div class="stat-sub" id="scorePassSub">总分≥' + passLine + '</div></div><div class="stat-card"><div class="stat-label">学科数</div><div class="stat-value">' + subj.length + '</div><div class="stat-sub">可自定义</div></div></div>'
      + (rows.length ? '' : '<div class="alert info"><strong>「' + TW.escape(exam.name) + '」暂无成绩：</strong>可<button class="button text" data-action="seed-scores" style="text-decoration:underline">从学生名单生成空表</button>后直接录入，或用上方"上传成绩"按模板导入 CSV。</div>')
      + '<section class="section"><div class="section-title">' + exam.name + ' 成绩录入 <small>' + (scoreEditing ? '正在编辑中' : '点击「开始编辑」后录入') + '</small></div><div class="section-body"><div class="toolbar" style="margin-bottom:12px"><button class="button ' + (scoreEditing ? '' : 'secondary') + '" data-action="score-toggle-edit">' + (scoreEditing ? '完成编辑并保存' : '开始编辑') + '</button><span class="note">' + (scoreEditing ? '编辑后点击「完成编辑并保存」统一写入本机' : '当前为只读，点击「开始编辑」后可直接修改分数') + '</span></div><div class="data-table-wrap"><table class="data-table score-table" data-exam="' + exam.id + '"><thead><tr><th>姓名</th>' + subj.map(function(k){ return '<th>' + TW.escape(k) + '</th>'; }).join('') + '<th>总分</th></tr></thead><tbody>' + rows.map(function(r){ return '<tr><td>' + TW.escape(r.name) + '</td>' + subj.map(function(k){ return '<td data-subject="' + TW.escape(k) + '" class="score-cell">' + (r[k] || '') + '</td>'; }).join('') + '<td class="score-total">' + total(r) + '</td></tr>'; }).join('') + '</tbody></table></div></div></section>'
      + '<section class="section"><div class="section-title">成绩趋势 <small>折线图 · 所选学生各科历次考试变化</small></div><div class="section-body"><canvas id="scoreLine" style="width:100%;height:340px"></canvas></div></section>'
      + '<section class="section"><div class="section-title">学科均分 <small>柱状图 · 本次考试各学科班级平均分</small></div><div class="section-body"><canvas id="scoreBar" style="width:100%;height:340px"></canvas></div></section>'
      + '<section class="section"><div class="section-title">学生成绩对比 <small>折线图 · 最多 4 名学生历次考试变化</small></div><div class="section-body"><div class="toolbar score-toolbar" style="margin-bottom:12px;flex-wrap:wrap;gap:10px"><label class="field" style="width:280px;max-width:100%"><span class="note">对比科目</span><select id="scoreCmpSubject"><option value="总分"' + (cmpSubject === '总分' ? ' selected' : '') + '>总分</option>' + subj.map(function(k){ return '<option value="' + TW.escape(k) + '"' + (cmpSubject === k ? ' selected' : '') + '>' + TW.escape(k) + '</option>'; }).join('') + '</select></label>' + [0,1,2,3].map(function(i){ return '<label class="field" style="width:260px;max-width:100%"><span class="note">对比学生' + (i + 1) + '</span><select id="cmpS' + (i + 1) + '">' + studentOptions(cmpStudents[i] || '') + '</select></label>'; }).join('') + '</div><canvas id="scoreCmpLine" style="width:100%;height:340px"></canvas></div></section>'
      + '<section class="section"><div class="section-title">班级成绩对比 <small>折线图 · 各学科均分 · 当前考试 · 与其他班级对比</small></div><div class="section-body"><canvas id="classCmpLine" style="width:100%;height:340px"></canvas></div></section>';
  }

  function weekMonday(base){
    var d = base ? new Date(base + 'T00:00:00') : new Date();
    if (isNaN(d)) d = new Date();
    var dow = (d.getDay() + 6) % 7; // 周一=0
    d.setDate(d.getDate() - dow);
    return d;
  }
  function dateStr(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function homework(){
    var rows = TW.homework || [];
    var monday = weekMonday(state.hwWeekStart || null);
    state.hwWeekStart = dateStr(monday);
    var days = [];
    for (var i = 0; i < 7; i++){ var d = new Date(monday); d.setDate(monday.getDate() + i); days.push(dateStr(d)); }
    var byDate = {};
    rows.forEach(function(h){ var dd = normHomeworkDate(h.date); (byDate[dd] = byDate[dd] || []).push(h); });
    var sun = new Date(monday); sun.setDate(monday.getDate() + 6);
    var weekLabel = (monday.getMonth() + 1) + '月' + monday.getDate() + '日 — ' + (sun.getMonth() + 1) + '月' + sun.getDate() + '日';
    var weekNames = ['周一','周二','周三','周四','周五','周六','周日'];
    var today = dateStr(new Date());
    var cells = days.map(function(ds, i){
      var items = byDate[ds] || [];
      var cards = items.map(function(h, j){
        return '<div class="hw-card" data-action="edit-homework" data-hw-date="' + ds + '" data-hw-idx="' + j + '" role="button" tabindex="0"><span class="hw-subject">' + TW.escape(h.subject || '未分类') + '</span><span class="hw-content">' + TW.escape(h.content || '') + '</span>' + (h.minutes ? '<span class="hw-min">' + h.minutes + '分</span>' : '') + '</div>';
      }).join('');
      return '<div class="hw-day ' + (ds === today ? 'today' : '') + '" data-date="' + ds + '" role="button" tabindex="0" aria-label="' + ds + '，点击录入作业"><div class="hw-day-head"><span class="hw-week-name">' + weekNames[i] + '</span><span class="hw-day-date">' + Number(ds.slice(8, 10)) + '</span><span class="hw-day-count">' + items.length + ' 项</span></div><div class="hw-day-body">' + (cards || '<div class="hw-empty">＋ 点击录入</div>') + '</div></div>';
    }).join('');
    return head('作业与自习', '以周为单位记录各科作业（班主任任教一科，可代录其他学科）', '<button class="button secondary" data-action="hw-week-prev">‹ 上一周</button><button class="button secondary" data-action="hw-week-next">下一周 ›</button><button class="button" data-action="new-homework">+ 布置作业</button>')
      + '<section class="section"><div class="section-title">本周作业 <small>' + weekLabel + ' · 点击某天录入该日作业，点击卡片可编辑或删除</small></div><div class="section-body"><div class="hw-week">' + cells + '</div></div></section>';
  }

  /* ================= 课时管理（跨班上课内容 · 计划 · 作业） =================
   * 数据：
   *   TW.lessonClasses  = ['高一16班', ...]        教学班名称列表（不管理学生）
   *   TW.schedule       = { odd: {'周X-第N节': 班级}, even: {...} }   课表（单双周，可调课）
   *   TW.lessons        = [{ id, cls, date, content, plan, homework, note, color }]   课时记录
   * 视图：今日卡片（课表驱动）+ 四周计划（本周已上/后三周计划） */
  var LESSON_DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var LESSON_PERIODS = 8; // 每天最多 8 节课
  function lessonSave(){ gw('lessons', TW.lessons); }
  function scheduleSave(){ gw('schedule', TW.schedule); }
  function lessonClassesSave(){ gw('lesson_classes', TW.lessonClasses); }
  function lessonFind(cls, date){
    return (TW.lessons || []).find(function(l){ return l.cls === cls && l.date === date; });
  }
  function lessonEnsure(cls, date){
    var l = lessonFind(cls, date);
    if (!l) { l = { id: uid('ls'), cls: cls, date: date, content: '', plan: '', homework: '', note: '', color: '' }; TW.lessons.push(l); }
    return l;
  }
  /* 学期起始周（用于单双周判断；默认取当前周周一往前推）
   * 单双周按「距学期开始周的周数」奇偶判定，可持久化调整 */
  function semesterStartDate(){
    var v = TW.store.read('semester_start', '');
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // 默认：当前日期所在周的周一
    var d = weekMonday(null);
    return dateStr(d);
  }
  function weekNumOf(date){
    var start = semesterStartDate();
    var a = new Date(start + 'T00:00:00'), b = new Date(date + 'T00:00:00');
    if (isNaN(a) || isNaN(b)) return 1;
    return Math.floor((b - a) / (7 * 86400000)) + 1;
  }
  function isOddWeek(date){ return weekNumOf(date) % 2 === 1; }
  function scheduleFor(date){
    var dayIdx = (new Date(date + 'T00:00:00').getDay() + 6) % 7; // 周一=0
    var week = isOddWeek(date) ? TW.schedule.odd : TW.schedule.even;
    var out = [];
    for (var p = 1; p <= LESSON_PERIODS; p++) {
      var cls = week[LESSON_DAY_NAMES[dayIdx] + '-第' + p + '节'] || '';
      if (cls) out.push({ period: p, cls: cls });
    }
    return out;
  }
  function todayStr(){ return dateStr(new Date()); }

  function lessons(){
    var today = todayStr();
    var oddToday = isOddWeek(today);
    var todayClasses = scheduleFor(today);
    // 班级筛选（默认全部；也可只看某班）
    var filterCls = state.lessonFilter || '';
    var weekStart = weekMonday(state.hwWeekStart || null);
    var weeks = [];
    for (var w = 0; w < 4; w++) {
      var monday = new Date(weekStart); monday.setDate(weekStart.getDate() + w * 7);
      var ds = [];
      for (var i = 0; i < 7; i++) { var d = new Date(monday); d.setDate(monday.getDate() + i); ds.push(dateStr(d)); }
      weeks.push({ start: dateStr(monday), days: ds, label: (monday.getMonth() + 1) + '月' + monday.getDate() + '日' + (w === 0 ? '（本周）' : w === 1 ? '（下周计划）' : w === 2 ? '（第3周计划）' : '（第4周计划）') });
    }
    // 参与排课的班级集合（课表 ∪ 已有课时记录 ∪ 教学班列表）
    var clsSet = {};
    TW.lessonClasses.forEach(function(c){ clsSet[c] = 1; });
    (TW.lessons || []).forEach(function(l){ if (l.cls) clsSet[l.cls] = 1; });
    ['odd', 'even'].forEach(function(k){ Object.keys(TW.schedule[k] || {}).forEach(function(key){ var c = TW.schedule[k][key]; if (c) clsSet[c] = 1; }); });
    var allClasses = Object.keys(clsSet);
    var shownClasses = filterCls ? [filterCls] : allClasses;
    // 今日卡片：课表驱动 + 今日已手动记录班级 合并去重（保证与下方数据表联动）
    var todayClsList = [];
    var todaySeen = {};
    todayClasses.forEach(function(t){
      if (!todaySeen[t.cls]) { todaySeen[t.cls] = 1; todayClsList.push({ cls: t.cls, period: t.period, manual: false }); }
    });
    (TW.lessons || []).forEach(function(l){
      if (l.date === today && !todaySeen[l.cls]) { todaySeen[l.cls] = 1; todayClsList.push({ cls: l.cls, period: 0, manual: true }); }
    });
    var todayCards = todayClsList.map(function(t){
      if (filterCls && t.cls !== filterCls) return '';
      var l = lessonFind(t.cls, today);
      var m = l && l.color ? macaronById(l.color) : null;
      return '<div class="lesson-card ' + (m ? 'c-' + l.color : '') + '"' + (m ? ' style="--swatch:' + m.bg + ';--swatch-fg:' + m.fg + '"' : '') + ' data-action="lesson-edit" data-cls="' + TW.escape(t.cls) + '" data-date="' + today + '" role="button" tabindex="0" title="点击记录该班今日课时"><div class="lesson-card-head"><strong>' + TW.escape(t.cls) + '</strong>' + (t.period ? '<span class="lesson-period">第' + t.period + '节</span>' : '<span class="lesson-period lesson-period-manual">手动</span>') + '</div><div class="lesson-card-body"><div class="lesson-line">' + TW.escape((l && l.content) || '＋ 记录上课内容') + '</div>' + ((l && l.homework) ? '<div class="lesson-line lesson-hw">作业：' + TW.escape(l.homework) + '</div>' : '') + '</div></div>';
    }).join('');
    // 四周计划：参考 excel「高一各班记录跟踪」布局——横轴=日期（周一~周日），纵轴=班级（每班一行）
    // 每周一块，四周纵向排列；每个单元格（含空格）都可点击录入
    function cellHtml(cls, ds){
      var isToday = ds === today;
      var l = lessonFind(cls, ds);
      var m = l && l.color ? macaronById(l.color) : null;
      var isFuture = ds >= today;
      var text = l ? (isFuture ? (l.plan || l.content || '') : (l.content || l.plan || '')) : '';
      var schedCls = scheduleFor(ds).filter(function(t){ return t.cls === cls; });
      var period = schedCls.length ? schedCls[0].period : 0;
      var periodTag = period ? ('第' + period + '节') : '手动';
      var done = !!(l && (l.content || l.plan || l.homework));
      var title = TW.escape(cls + ' ' + ds + (period ? '（' + periodTag + '）' : '（手动）') + ' · 点击' + (l ? '编辑' : '录入') + '课时');
      // 空格也带 data-action，保证可点击
      return '<div class="ls-cell ' + (isToday ? 'today' : '') + (m ? ' c-' + l.color : '') + (l ? '' : ' ls-empty') + '"' + (m ? ' style="--swatch:' + m.bg + ';--swatch-fg:' + m.fg + '"' : '') + ' data-action="lesson-edit" data-cls="' + TW.escape(cls) + '" data-date="' + ds + '" role="button" tabindex="0" title="' + title + '"><span class="ls-cell-head">' + (period ? '<span class="ls-cell-period">' + periodTag + '</span>' : '<span class="ls-cell-period ls-manual">手动</span>') + (done ? '<span class="ls-cell-state done">✓</span>' : (l ? '<span class="ls-cell-state todo">待记</span>' : '<span class="ls-cell-state none">＋</span>')) + '</span>' + (l ? '<span class="ls-cell-text">' + TW.escape(text.length > 26 ? text.slice(0, 26) + '…' : text) + '</span>' + (l.homework ? '<span class="ls-cell-hw">✎ ' + TW.escape(l.homework.length > 14 ? l.homework.slice(0, 14) + '…' : l.homework) + '</span>' : '') : '<span class="ls-cell-plus">＋ 点击录入</span>') + '</div>';
    }
    function weekMatrixHtml(wk){
      var headCells = wk.days.map(function(ds){
        var isToday = ds === today;
        return '<div class="ls-mx-head ' + (isToday ? 'today' : '') + '"><span>' + LESSON_DAY_NAMES[(new Date(ds + 'T00:00:00').getDay() + 6) % 7] + '</span><span class="ls-mx-head-date">' + Number(ds.slice(8, 10)) + '</span>' + (isToday ? '<span class="ls-mx-today">今天</span>' : '') + '</div>';
      }).join('');
      var rows = shownClasses.map(function(cls){
        var cells = wk.days.map(function(ds){ return cellHtml(cls, ds); }).join('');
        return '<div class="ls-mx-row"><div class="ls-mx-cls" title="' + TW.escape(cls) + '">' + TW.escape(cls) + '</div>' + cells + '</div>';
      }).join('');
      // 本周统计
      var weekSchedN = 0, weekDoneN = 0;
      wk.days.forEach(function(ds){
        scheduleFor(ds).forEach(function(t){
          if (filterCls && t.cls !== filterCls) return;
          weekSchedN++;
          var l = lessonFind(t.cls, ds);
          if (l && (l.content || l.plan || l.homework)) weekDoneN++;
        });
      });
      var stat = weekSchedN ? ('已记录 ' + weekDoneN + '/' + weekSchedN + ' 节') : (shownClasses.length ? '未排课 · 可直接点击录入' : '');
      return '<div class="lesson-week-block"><div class="lesson-week-head"><span>' + TW.escape(wk.label) + '</span><span class="lesson-week-stat">' + stat + '</span></div><div class="ls-matrix-wrap"><div class="ls-matrix"><div class="ls-mx-cls-head">班级</div>' + headCells + rows + '</div></div></div>';
    }
    var weekBlocks = weeks.map(weekMatrixHtml).join('');
    var filterOpts = '<option value="">全部班级（' + allClasses.length + ' 个）</option>' + allClasses.map(function(c){ return '<option value="' + TW.escape(c) + '"' + (c === filterCls ? ' selected' : '') + '>' + TW.escape(c) + '</option>'; }).join('');
    // 全部课时记录（可编辑/删除/筛选）
    var allRecords = (TW.lessons || []).slice().sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.cls < b.cls ? -1 : 1); });
    var shownRecords = filterCls ? allRecords.filter(function(r){ return r.cls === filterCls; }) : allRecords;
    var recordsHtml = shownRecords.length
      ? '<div class="data-table-wrap" style="max-height:320px"><table class="data-table no-edit-table"><thead><tr><th>日期</th><th>班级</th><th>内容 / 计划</th><th>应收作业</th><th>操作</th></tr></thead><tbody>' + shownRecords.map(function(r){
          var m = r.color ? macaronById(r.color) : null;
          return '<tr><td class="mono">' + r.date + '</td><td>' + (m ? '<span class="affair-dot" style="display:inline-block;background:' + m.bg + ';border-color:' + m.fg + '"></span> ' : '') + TW.escape(r.cls) + '</td><td>' + TW.escape((r.content || r.plan || '—').length > 40 ? (r.content || r.plan).slice(0, 40) + '…' : (r.content || r.plan || '—')) + '</td><td>' + TW.escape(r.homework || '—') + '</td><td><button class="button text" data-action="lesson-edit" data-cls="' + TW.escape(r.cls) + '" data-date="' + r.date + '">编辑</button><button class="button text danger-text" data-action="lesson-record-del" data-id="' + r.id + '">删除</button></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="alert info">暂无课时记录 — 点击网格或「＋ 手动录入」添加</div>';
    var weekRange = weeks[0].start + ' — ' + weeks[3].days[6];
    // 班级信息卡：各教学班班主任 / 学科 / 政治课代表（可自定义）
    var infoCards = allClasses.map(function(cls){
      var info = TW.lessonClassInfo[cls] || {};
      var head = info.head || '—', subject = info.subject || '—', rep = info.rep || '—';
      return '<div class="cls-info-card" data-action="lesson-class-info-edit" data-cls="' + TW.escape(cls) + '" role="button" tabindex="0" title="点击编辑「' + TW.escape(cls) + '」的班主任 / 学科 / 政治课代表"><div class="cls-info-name">' + TW.escape(cls) + '</div><div class="cls-info-row"><span class="cls-info-label">班主任</span><span>' + TW.escape(head) + '</span></div><div class="cls-info-row"><span class="cls-info-label">学科</span><span>' + TW.escape(subject) + '</span></div><div class="cls-info-row"><span class="cls-info-label">政治课代表</span><span>' + TW.escape(rep) + '</span></div></div>';
    }).join('');
    return head('课时管理', '', '<label class="field" style="width:200px"><span class="note">班级</span><select id="lessonFilter">' + filterOpts + '</select></label><button class="button secondary" data-action="lesson-class-manage">教学班管理</button><button class="button secondary" data-action="lesson-week-prev">‹ 前四周</button><button class="button secondary" data-action="lesson-week-next">后四周 ›</button><button class="button" data-action="lesson-add">＋ 手动录入</button><button class="button secondary" data-action="schedule-manage">课表管理</button><button class="button secondary" data-action="schedule-upload">上传课表</button><button class="button secondary" data-action="lesson-upload">上传课时模板</button>')
      + '<section class="section"><div class="section-title">班级信息 <small>班主任 / 任教学科 / 政治课代表 · 点击卡片可自定义</small></div><div class="section-body"><div class="cls-info-grid">' + (infoCards || '<div class="alert info">暂无教学班，可在「教学班管理」中添加</div>') + '</div></div></section>'
      + '<section class="section"><div class="section-title">今日上课 <small>' + today + ' · ' + (oddToday ? '单周' : '双周') + '</small></div><div class="section-body">' + (todayCards ? '<div class="lesson-cards">' + todayCards + '</div><div class="toolbar" style="margin-top:10px"><button class="button secondary" data-action="lesson-add" data-date="' + today + '">＋ 今日手动录入</button></div>' : '<div class="alert info">今日暂无课时 — 在下方四周计划点今日格子录入，或点「＋ 今日手动录入」</div>') + '</div></section>'
      + '<section class="section"><div class="section-title">四周计划 <small>' + weekRange + '</small></div><div class="section-body">' + weekBlocks + '</div></section>'
      + '<section class="section"><div class="section-title">全部课时记录 <small>按日期排序 · 点击「编辑」修改 · 「删除」移除单条（可撤回）</small></div><div class="section-body">' + recordsHtml + '</div></section>';
  }
  /* 编辑班级信息（班主任 / 学科 / 政治课代表，可自定义） */
  function lessonClassInfoEdit(cls){
    var info = TW.lessonClassInfo[cls] || {};
    TW.modal('班级信息 · ' + cls, '<div class="form-grid"><div class="field"><label>班主任</label><input id="ciHead" value="' + TW.escape(info.head || '') + '" placeholder="如：李林华"></div><div class="field"><label>任教学科</label><input id="ciSubject" value="' + TW.escape(info.subject || '') + '" placeholder="如：数学"></div><div class="field full"><label>政治课代表</label><input id="ciRep" value="' + TW.escape(info.rep || '') + '" placeholder="如：肖玥希、谭欢"></div></div>', '<button class="button secondary" data-close>取消</button>' + (info.head || info.subject || info.rep ? '<button class="button danger" id="ciClear">清空</button>' : '') + '<button class="button" id="ciSave">保存</button>');
    TW.$('#ciSave').onclick = function(){
      TW.lessonClassInfo[cls] = { head: TW.$('#ciHead').value.trim(), subject: TW.$('#ciSubject').value.trim(), rep: TW.$('#ciRep').value.trim() };
      gw('lesson_class_info', TW.lessonClassInfo);
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('课时管理：编辑班级信息', cls);
      TW.toast('已保存 ' + cls + ' 信息');
    };
    var cClear = TW.$('#ciClear');
    if (cClear) cClear.onclick = function(){
      TW.lessonClassInfo[cls] = { head: '', subject: '', rep: '' };
      gw('lesson_class_info', TW.lessonClassInfo);
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      TW.toast('已清空 ' + cls + ' 信息');
    };
  }

  function meeting(){
    return head('班会与德育', '记录讲过的班会 + 计划未来的班会', '<button class="button" data-action="new-meeting">+ 记录班会</button><button class="button secondary" data-action="new-meeting-plan">+ 新增计划</button>')
      + '<section class="section"><div class="section-title">班会记录 <small>可编辑 · 日期 / 主题 / 内容 / 状态</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>日期</th><th>主题</th><th>内容</th><th>状态</th><th>操作</th></tr></thead><tbody>' + TW.meetings.map(function(m, i){ return '<tr><td class="mono">' + m.date + '</td><td>' + TW.escape(m.topic) + '</td><td>' + TW.escape(m.content || '') + '</td><td><span class="status-badge ok">' + (m.status || '已归档') + '</span></td><td><button class="button text" data-action="edit-list-row" data-list="meetings" data-idx="' + i + '">编辑</button><button class="button text danger-text" data-action="delete-list-row" data-list="meetings" data-idx="' + i + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>'
      + '<section class="section"><div class="section-title">班会计划 <small>可编辑 · 未来要讲的班会</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>日期</th><th>主题</th><th>目标</th><th>操作</th></tr></thead><tbody>' + TW.meetingPlan.map(function(p, i){ return '<tr><td class="mono">' + p.date + '</td><td>' + TW.escape(p.topic) + '</td><td>' + TW.escape(p.goal || '') + '</td><td><button class="button text" data-action="edit-list-row" data-list="meetingPlan" data-idx="' + i + '">编辑</button><button class="button text danger-text" data-action="delete-list-row" data-list="meetingPlan" data-idx="' + i + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>';
  }

  function family(){
    return head('家校沟通', '沟通历史 + 家长反馈 + 家长会记录 + 沟通计划', '<button class="button" data-action="new-family">+ 记录沟通</button><button class="button secondary" data-action="new-parent-meeting">+ 家长会</button><button class="button secondary" data-action="new-family-plan">+ 计划</button>')
      + '<section class="section"><div class="section-title">沟通历史 <small>可编辑 · 说过什么 + 家长反馈</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>日期</th><th>方式</th><th>对象</th><th>沟通内容</th><th>家长反馈</th><th>操作</th></tr></thead><tbody>' + TW.family.map(function(f, i){ return '<tr><td class="mono">' + f.date + '</td><td>' + f.type + '</td><td>' + TW.escape(f.target) + '</td><td>' + TW.escape(f.content || '') + '</td><td>' + TW.escape(f.feedback || '') + '</td><td><button class="button text" data-action="edit-list-row" data-list="family" data-idx="' + i + '">编辑</button><button class="button text danger-text" data-action="delete-list-row" data-list="family" data-idx="' + i + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>'
      + '<section class="section"><div class="section-title">家长会记录 <small>可编辑 · 日期 / 主题 / 出勤 / 内容</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>日期</th><th>主题</th><th>出勤</th><th>内容</th><th>状态</th><th>操作</th></tr></thead><tbody>' + TW.parentMeetings.map(function(p, i){ return '<tr><td class="mono">' + p.date + '</td><td>' + TW.escape(p.topic) + '</td><td>' + p.attendance + '</td><td>' + TW.escape(p.content || '') + '</td><td><span class="status-badge ' + (p.status === '已完成' ? 'ok' : 'warn') + '">' + p.status + '</span></td><td><button class="button text" data-action="edit-list-row" data-list="parentMeetings" data-idx="' + i + '">编辑</button><button class="button text danger-text" data-action="delete-list-row" data-list="parentMeetings" data-idx="' + i + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>'
      + '<section class="section"><div class="section-title">沟通计划 <small>可编辑</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>日期</th><th>对象</th><th>原因</th><th>操作</th></tr></thead><tbody>' + TW.familyPlan.map(function(p, i){ return '<tr><td class="mono">' + p.date + '</td><td>' + TW.escape(p.target) + '</td><td>' + TW.escape(p.reason || '') + '</td><td><button class="button text" data-action="edit-list-row" data-list="familyPlan" data-idx="' + i + '">编辑</button><button class="button text danger-text" data-action="delete-list-row" data-list="familyPlan" data-idx="' + i + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>';
  }

  function dorm(){
    var blocks = (TW.dorm || []).map(function(d, i){
      var members = String(d.members || '').split(/[、,，]/).filter(function(n){ return n.trim(); });
      return '<button class="dorm-block" data-action="edit-dorm" data-idx="' + i + '"><span class="dorm-room">' + TW.escape(d.room || ('宿舍' + (i + 1))) + '</span><span class="dorm-leader">舍长：' + TW.escape(d.leader || '—') + '</span><span class="dorm-members">' + members.map(function(n){ return '<i>' + TW.escape(n.trim()) + '</i>'; }).join('') + '</span><span class="dorm-score">当前分数：' + (d.score != null && d.score !== '' ? TW.escape(String(d.score)) : '—') + '</span></button>';
    }).join('');
    return head('宿舍管理', '宿舍块状管理 · 谁和谁一个宿舍一目了然', '<button class="button" data-action="new-dorm">+ 新增宿舍</button><button class="button secondary" data-action="new-dorm-visit">+ 探访记录</button>')
      + '<section class="section"><div class="section-title">宿舍信息 <small>点击宿舍卡片查看并编辑详情（舍长 / 当前分数 / 备注）</small></div><div class="section-body"><div class="dorm-grid">' + (blocks || '<div class="empty-state">暂无宿舍，点击右上角「+ 新增宿舍」</div>') + '</div></div></section>'
      + '<section class="section"><div class="section-title">探访记录 <small>可编辑 · 班主任何时探访了哪个宿舍</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>日期</th><th>宿舍</th><th>备注</th><th>操作</th></tr></thead><tbody>' + TW.dormVisits.map(function(v, i){ return '<tr><td class="mono">' + v.date + '</td><td>' + TW.escape(v.room) + '</td><td>' + TW.escape(v.note || '') + '</td><td><button class="button text" data-action="edit-list-row" data-list="dormVisits" data-idx="' + i + '">编辑</button><button class="button text danger-text" data-action="delete-list-row" data-list="dormVisits" data-idx="' + i + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>';
  }

  function levelBadge(l){ return '<span class="status-badge ' + (l >= 2 ? 'danger' : 'warn') + '">L' + l + '</span>'; }
  function quality(){
    return head('综合素质评价', '五育过程记录 + 完整学期评语', '<button class="button" data-action="new-quality">+ 新增评价</button>')
      + '<section class="section"><div class="section-title">评价档案 <small>可编辑 · 点击「编辑」修改五育等级与学期评语</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>姓名</th><th>道德</th><th>学业</th><th>健康</th><th>艺术</th><th>劳动</th><th>操作</th></tr></thead><tbody>' + TW.quality.map(function(q, i){ return '<tr><td>' + TW.escape(q.name) + '</td><td>' + q.moral + '</td><td>' + q.academic + '</td><td>' + q.health + '</td><td>' + q.art + '</td><td>' + q.labor + '</td><td><button class="button text" data-action="edit-list-row" data-list="quality" data-idx="' + i + '">编辑</button><button class="button text danger-text" data-action="delete-list-row" data-list="quality" data-idx="' + i + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>';
  }

  function selection(){
    var sel = TW.selection || { first:{physics:0,history:0}, combos:{}, intents:[] };
    var total = (Number(sel.first.physics) || 0) + (Number(sel.first.history) || 0) || 1;
    var pieItems = [{ label:'首选物理', value: sel.first.physics, color:'#789783' }, { label:'首选历史', value: sel.first.history, color:'#2e6bc4' }];
    var comboPie = Object.keys(sel.combos || {}).map(function(k){ return { label:k, value: sel.combos[k] }; });
    return head('选科意向', '新高考 3+1+2 首选与组合意向', '<button class="button" data-action="new-selection">+ 录入意向</button><button class="button secondary" data-action="export-selection">导出统计</button>')
      + '<div class="grid-4"><div class="stat-card"><div class="stat-label">首选物理</div><div class="stat-value">' + (sel.first.physics || 0) + '</div><div class="stat-sub">' + Math.round((sel.first.physics || 0) / total * 100) + '%</div></div><div class="stat-card"><div class="stat-label">首选历史</div><div class="stat-value">' + (sel.first.history || 0) + '</div><div class="stat-sub">' + Math.round((sel.first.history || 0) / total * 100) + '%</div></div><div class="stat-card"><div class="stat-label">未确定</div><div class="stat-value">' + (sel.undecided || 0) + '</div><div class="stat-sub">需一对一沟通</div></div><div class="stat-card"><div class="stat-label">已登记</div><div class="stat-value">' + (sel.intents || []).length + '</div><div class="stat-sub">意向名单</div></div></div>'
      + '<div class="grid-2"><section class="section"><div class="section-title">首选科目分布 <small>饼状图</small></div><div class="section-body"><canvas id="selPie1" style="width:100%;height:300px"></canvas>' + TW.pieLegend(pieItems) + '</div></section><section class="section"><div class="section-title">再选组合分布 <small>饼状图</small></div><div class="section-body"><canvas id="selPie2" style="width:100%;height:300px"></canvas>' + TW.pieLegend(comboPie) + '</div></section></div>'
      + '<section class="section"><div class="section-title">意向名单 <small>可编辑 / 导出导入CSV / 新增条目</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-actions"><thead><tr><th>姓名</th><th>首选</th><th>再选组合</th></tr></thead><tbody>' + (sel.intents || []).map(function(i){ return '<tr><td>' + TW.escape(i.name) + '</td><td>' + i.first + '</td><td>' + i.combos + '</td></tr>'; }).join('') + '</tbody></table></div></div></section>';
  }

  /* ============ 学生值日表（班级卫生值日排班，按星期循环；值日内容自定义） ============ */
  var CLEAN_WEEKS = ['周一','周二','周三','周四','周五','周六','周日'];
  function cleaning(){
    var rows = TW.cleaning || [];
    var students = TW.students || [];
    // 涉及学生去重统计（按顿号/逗号分隔）
    var all = [];
    rows.forEach(function(r){ String(r.members || '').split(/[、,，]/).forEach(function(n){ n = n.trim(); if (n && all.indexOf(n) < 0) all.push(n); }); });
    // 今日值日（今天星期几）
    var todayIdx = (new Date().getDay() + 6) % 7; // 周一=0
    var todayLabel = CLEAN_WEEKS[todayIdx];
    var todayRow = rows.filter(function(r){ return r.week === todayLabel; })[0];
    return head('值日表', '班级卫生值日排班 · 按星期循环 · 值日内容自定义', '<button class="button" data-action="new-cleaning">+ 新增排班</button>')
      + '<div class="grid-4"><div class="stat-card"><div class="stat-label">已排星期</div><div class="stat-value">' + rows.length + '</div><div class="stat-sub">周一至周日</div></div><div class="stat-card"><div class="stat-label">涉及学生</div><div class="stat-value">' + all.length + '</div><div class="stat-sub">' + classNameOf() + '共' + students.length + '人</div></div><div class="stat-card"><div class="stat-label">今日值日</div><div class="stat-value ' + (todayRow ? '' : 'danger-text') + '">' + (todayRow ? (todayRow.members || '').split(/[、,，]/).length : '未安排') + '</div><div class="stat-sub">' + todayLabel + (todayRow ? ' · ' + todayRow.task : '') + '</div></div><div class="stat-card"><div class="stat-label">未排班学生</div><div class="stat-value">' + students.filter(function(s){ return all.indexOf(s.name) < 0; }).length + '</div><div class="stat-sub">可补排</div></div></div>'
      + '<section class="section"><div class="section-title">每周值日安排 <small>可编辑 · 点击「编辑」修改值日学生与内容</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>星期</th><th>值日学生</th><th>值日内容</th><th>操作</th></tr></thead><tbody>' + rows.map(function(r, i){ return '<tr><td class="mono">' + r.week + '</td><td>' + TW.escape(r.members) + '</td><td>' + TW.escape(r.task || '') + '</td><td><button class="button text" data-action="edit-list-row" data-list="cleaning" data-idx="' + i + '">编辑</button><button class="button text danger-text" data-action="delete-list-row" data-list="cleaning" data-idx="' + i + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>';
  }

  /* ============ 分数管理（班级量化积分：初始 100 分，加减分记录分数/原因/时间） ============ */
  function pointOf(sid){
    return (TW.points || []).find(function(p){ return p.sid === sid || (p.sid == null && p.name && recSid(p) === sid); });
  }
  function pointTotal(sid){
    var p = pointOf(sid);
    if (!p) return 100; // 未加减分 = 初始 100
    var base = 100;
    (p.logs || []).forEach(function(l){ base += Number(l.delta) || 0; });
    return base;
  }
  function pointLogs(sid){
    var p = pointOf(sid);
    return p && Array.isArray(p.logs) ? p.logs : [];
  }
  function points(){
    var students = TW.students || [];
    var rows = students.map(function(s){ var logs = pointLogs(s.sid); return { sid: s.sid, name: s.name, total: pointTotal(s.sid), logs: logs, times: logs.length }; });
    var s = pointsSort;
    rows.sort(function(a, b){
      if (s.key === 'name') return String(a.name).localeCompare(String(b.name), 'zh-CN') * s.dir;
      return (Number(a[s.key]) - Number(b[s.key])) * s.dir;
    });
    var withLogs = rows.filter(function(r){ return r.logs.length; });
    var avg = rows.length ? Math.round(rows.reduce(function(sum, r){ return sum + r.total; }, 0) / rows.length * 10) / 10 : 100;
    var maxRow = rows.reduce(function(a, b){ return b.total > a.total ? b : a; }, rows[0]);
    var minRow = rows.reduce(function(a, b){ return b.total < a.total ? b : a; }, rows[0]);
    var up = withLogs.reduce(function(sum, r){ return sum + r.logs.filter(function(l){ return Number(l.delta) > 0; }).length; }, 0);
    var down = withLogs.reduce(function(sum, r){ return sum + r.logs.filter(function(l){ return Number(l.delta) < 0; }).length; }, 0);
    function th(label, key){ return '<th class="psort-th" data-psort="' + key + '">' + label + (pointsSort.key === key ? (pointsSort.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }
    return head('分数管理', '班级量化积分 · 开学初始 100 分 · 表头可排序 · 加减分留痕', '')
      + '<div class="grid-4"><div class="stat-card"><div class="stat-label">班级平均分</div><div class="stat-value">' + avg + '</div><div class="stat-sub">' + rows.length + '人</div></div><div class="stat-card"><div class="stat-label">最高分</div><div class="stat-value ok-text">' + (maxRow ? maxRow.total : 100) + '</div><div class="stat-sub">' + (maxRow ? maxRow.name : '—') + '</div></div><div class="stat-card"><div class="stat-label">最低分</div><div class="stat-value danger-text">' + (minRow ? minRow.total : 100) + '</div><div class="stat-sub">' + (minRow ? minRow.name : '—') + '</div></div><div class="stat-card"><div class="stat-label">加减分记录</div><div class="stat-value">' + (up + down) + '</div><div class="stat-sub">加分 ' + up + ' 次 · 扣分 ' + down + ' 次</div></div></div>'
      + '<section class="section"><div class="section-title">学生积分表 <small>点击表头排序 · 操作列可加分 / 扣分 / 查看明细</small></div><div class="section-body"><div class="data-table-wrap"><table class="data-table no-edit-table" id="pointsTable"><thead><tr>' + th('姓名', 'name') + th('当前分数', 'total') + th('加减分次数', 'times') + '<th>操作</th></tr></thead><tbody>' + rows.map(function(r){ return '<tr><td>' + TW.escape(r.name) + '</td><td><span class="score-value ' + (r.total > 100 ? 'ok-text' : (r.total < 100 ? 'danger-text' : '')) + '">' + r.total + '</span></td><td>' + (r.logs.length ? r.logs.filter(function(l){ return Number(l.delta) > 0; }).length + '加 / ' + r.logs.filter(function(l){ return Number(l.delta) < 0; }).length + '扣' : '—') + '</td><td class="editable-actions"><button class="button text" data-action="view-points" data-sid="' + TW.escape(r.sid) + '">明细</button><button class="button text ok-text" data-action="add-point" data-sid="' + TW.escape(r.sid) + '">+ 加分</button><button class="button text danger-text" data-action="deduct-point" data-sid="' + TW.escape(r.sid) + '">- 扣分</button></td></tr>'; }).join('') + '</tbody></table></div></div></section>';
  }

  /* ============ 预警中心：跨板块聚合风险信号 ============ */
  function alerts(){
    var students = TW.students || [];
    var items = [];
    students.forEach(function(s){
      var alertsList = [];
      // 1. 积分过低
      var total = pointTotal(s.sid);
      if (total < 90) alertsList.push({ level: 'danger', text: '积分 ' + total + ' 分（<90）', target: 'points' });
      else if (total < 95) alertsList.push({ level: 'warn', text: '积分 ' + total + ' 分（<95）', target: 'points' });
      // 2. 心理关注无谈话（谈话记录已并入学生档案）
      var m = (TW.mental || []).find(function(x){ return recSid(x) === s.sid; });
      var hasTalk = (TW.talks || []).some(function(t){ return t.name === s.name || t.sid === s.sid; });
      if (m && m.level >= 2 && !hasTalk) alertsList.push({ level: 'warn', text: '心理 L' + m.level + ' 尚无谈话记录', target: 'students' });
      // 3. 缺勤 >= 3
      var absent = (TW.attendance || []).filter(function(a){ return recSid(a) === s.sid && a.type === '缺勤'; }).length;
      if (absent >= 3) alertsList.push({ level: 'warn', text: '累计缺勤 ' + absent + ' 次', target: 'attendance' });
      // 4. 未排值日
      var onDuty = (TW.cleaning || []).some(function(c){ return String(c.members || '').split(/[、,，]/).indexOf(s.name) >= 0; });
      if (!onDuty) alertsList.push({ level: 'info', text: '未排值日', target: 'cleaning' });
      if (alertsList.length) items.push({ sid: s.sid, name: s.name, alerts: alertsList });
    });
    var danger = items.reduce(function(n, it){ return n + it.alerts.filter(function(a){ return a.level === 'danger'; }).length; }, 0);
    var warn = items.reduce(function(n, it){ return n + it.alerts.filter(function(a){ return a.level === 'warn'; }).length; }, 0);
    return head('预警中心', '跨板块聚合风险信号 · 积分/心理/考勤/值日', '')
      + '<div class="grid-4"><div class="stat-card"><div class="stat-label">需关注学生</div><div class="stat-value danger-text">' + items.length + '</div><div class="stat-sub">有任一预警</div></div><div class="stat-card"><div class="stat-label">高危预警</div><div class="stat-value danger-text">' + danger + '</div><div class="stat-sub">积分<90 等</div></div><div class="stat-card"><div class="stat-label">一般预警</div><div class="stat-value warn-text">' + warn + '</div><div class="stat-sub">需跟进</div></div><div class="stat-card"><div class="stat-label">未排值日</div><div class="stat-value">' + items.filter(function(it){ return it.alerts.some(function(a){ return a.text === '未排值日'; }); }).length + '</div><div class="stat-sub">可补排</div></div></div>'
      + '<section class="section"><div class="section-title">预警清单 <small>点击学生查看成长档案 · 点击预警条目前往对应板块</small></div><div class="section-body">' + (items.length ? '<table class="data-table no-edit-table"><thead><tr><th>学生</th><th>预警项</th><th>操作</th></tr></thead><tbody>' + items.map(function(it){ return '<tr><td><button class="button text" data-action="view-student" data-name="' + TW.escape(it.name) + '">' + TW.escape(it.name) + '</button></td><td>' + it.alerts.map(function(a){ return '<span class="status-badge ' + (a.level === 'danger' ? 'danger' : (a.level === 'warn' ? 'warn' : 'info')) + '" role="button" tabindex="0" data-action="goto-alert" data-target="' + a.target + '" data-name="' + TW.escape(it.name) + '" style="margin:2px 4px 2px 0;cursor:pointer">' + TW.escape(a.text) + ' ›</span>'; }).join('') + '</td><td><button class="button text" data-action="view-student" data-name="' + TW.escape(it.name) + '">成长档案</button></td></tr>'; }).join('') + '</tbody></table>' : '<div class="alert ok">当前无预警，一切正常 🎉</div>') + '</div></section>';
  }
  function personal(){
    var y = state.pCalYear, m = state.pCalMonth;
    var first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7;
    var days = new Date(y, m + 1, 0).getDate();
    var byDate = {};
    TW.personalMemo.forEach(function(a){ (byDate[a.date] = byDate[a.date] || []).push(a); });
    var cells = '';
    for (var i = 0; i < startDow; i++) cells += '<div class="cal-cell empty"></div>';
    for (var d = 1; d <= days; d++){
      var ds = y + '-' + String(m + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var evs = byDate[ds] || [];
      var today = (new Date().getFullYear() === y && new Date().getMonth() === m && new Date().getDate() === d);
      cells += '<div class="cal-cell cal-clickable ' + (today ? 'today' : '') + '" data-date="' + ds + '" data-pcal="1" tabindex="0" role="button" aria-label="' + ds + '，点击查看或新增个人备忘"><div class="cal-day">' + d + '</div>' + evs.map(function(e){ return '<div class="cal-event ' + (e.color ? 'c-' + e.color : 'c-personal') + '"' + affairColorStyle(e) + ' title="' + TW.escape(e.title + (e.note ? '：' + e.note : '')) + '">' + TW.escape(e.title) + '</div>'; }).join('') + '</div>';
    }
    var monthLabel = y + '年' + (m + 1) + '月';
    return head('个人事务', '以日历形式记录教师本人的工作备忘录', '<button class="button secondary" data-action="pcal-prev">‹ 上月</button><button class="button secondary" data-action="pcal-next">下月 ›</button><button class="button" data-action="new-personal">+ 新增备忘</button>')
      + '<section class="section"><div class="section-title">个人备忘录 <small>' + monthLabel + ' · 点击日期查看/新增当日备忘</small></div><div class="section-body"><div class="calendar"><div class="cal-head">' + ['一','二','三','四','五','六','日'].map(function(d){ return '<div>' + d + '</div>'; }).join('') + '</div><div class="cal-grid">' + cells + '</div></div></div></section>';
  }

  /* ================= 图表绘制（真实数据） ================= */
  function drawModuleCharts(){
    if (state.module === 'scores') drawScoresCharts();
    else if (state.module === 'selection') {
      var sel = TW.selection || { first:{physics:0,history:0}, combos:{} };
      var c1 = TW.$('#selPie1'); if (c1) TW.drawPie(c1, { items: [{label:'首选物理',value:sel.first.physics||0,color:'#789783'},{label:'首选历史',value:sel.first.history||0,color:'#2e6bc4'}] });
      var c2 = TW.$('#selPie2'); if (c2) TW.drawPie(c2, { items: Object.keys(sel.combos||{}).map(function(k){ return {label:k, value: sel.combos[k]}; }) });
    }
  }
  function drawScoresCharts(){
    var exams = TW.exams || [], subj = TW.subjects;
    var exam = exams.find(function(e){ return e.id === state.examId; }) || exams[0];
    if (!exam) exam = { id: 'ex_new', name: '新增考试', date: new Date().toISOString().slice(0, 10), scores: [] };
    var rows = (exam && exam.scores) || [];
    function total(r){ return subj.reduce(function(s,k){ return s + (Number(r[k]) || 0); }, 0); }
    // 柱状图：各学科均分
    var barLabels = subj, barVals = subj.map(function(k){ var s = rows.reduce(function(sum,r){ return sum + (Number(r[k]) || 0); }, 0); return rows.length ? Math.round(s / rows.length * 10) / 10 : 0; });
    var bar = TW.$('#scoreBar'); if (bar) TW.drawBar(bar, { labels: barLabels, values: barVals, color: '#789783', unit: '' });
    // 折线图：所选学生各科历次考试变化（或全班均分）
    var selName = state.scoreStudent;
    var lineSeries = [];
    if (selName) {
      subj.forEach(function(k, idx){
        lineSeries.push({ name: k, color: ['#2e6bc4','#a98250','#ad6962','#789783','#5a8f72','#c9a227'][idx % 6], values: exams.map(function(e){ var r = (e.scores || []).find(function(x){ return x.name === selName; }); return r ? (Number(r[k]) || 0) : 0; }) });
      });
    } else {
      lineSeries.push({ name: '全班总分均分', color: '#2e6bc4', values: exams.map(function(e){ var s = e.scores || []; return s.length ? Math.round(s.reduce(function(sum,r){ return sum + total(r); }, 0) / s.length) : 0; }) });
    }
    var line = TW.$('#scoreLine'); if (line) TW.drawLine(line, { labels: exams.map(function(e){ return e.name; }), series: lineSeries });
    // 学生成绩对比：所选学生（≤4 人）× 对比科目（或总分）历次考试变化
    var cmp = state.scoreCmp || {};
    var cmpSubject = cmp.subject || '总分';
    var cmpStudents = cmp.students || rows.slice(0, Math.min(4, rows.length)).map(function(r){ return r.name; });
    var cmpLine = TW.$('#scoreCmpLine');
    if (cmpLine) {
      var cmpSeries = cmpStudents.filter(function(nm){ return nm; }).map(function(nm, i){
        var values = exams.map(function(e){ var r = (e.scores || []).find(function(x){ return x.name === nm; }); if (!r) return 0; return cmpSubject === '总分' ? total(r) : (Number(r[cmpSubject]) || 0); });
        return { name: nm, color: ['#2e6bc4','#a98250','#ad6962','#789783'][i % 4], values: values };
      });
      TW.drawLine(cmpLine, { labels: exams.map(function(e){ return e.name; }), series: cmpSeries });
    }
    // 班级成绩对比：当前考试各学科均分，系列 = 有数据的班级
    var clsLine = TW.$('#classCmpLine');
    if (clsLine) {
      var clsSeries = [], used = 0;
      classes.forEach(function(c){
        var exs = c.id === state.classId ? TW.exams : readClassExams(c.id);
        var ex = (exs || []).find(function(e){ return e.id === exam.id; });
        var sr = (ex && ex.scores) || [];
        if (!sr.length) return;
        var vals = subj.map(function(k){ var s = sr.reduce(function(sum, r){ return sum + (Number(r[k]) || 0); }, 0); return sr.length ? Math.round(s / sr.length * 10) / 10 : 0; });
        clsSeries.push({ name: c.name, color: ['#2e6bc4','#a98250','#ad6962','#789783','#5a8f72','#c9a227'][used % 6], values: vals });
        used += 1;
      });
      if (!clsSeries.length) clsSeries.push({ name: classNameOf(), color: '#2e6bc4', values: subj.map(function(){ return 0; }) });
      TW.drawLine(clsLine, { labels: subj, series: clsSeries });
    }
  }

  function readClassExams(classId){
    var v = TW.store.read('exams_' + classId, null);
    return Array.isArray(v) ? v : (classId === 'c1' ? TW.examsSeed : []);
  }

  /* 成绩统计卡实时刷新（编辑单元格/调整达标线/切换考试后即时联动，无需刷新页面） */
  function updateScoreStats(){
    var exams = TW.exams || [], subj = TW.subjects;
    var exam = exams.find(function(e){ return e.id === state.examId; }) || exams[0];
    var rows = (exam && exam.scores) || [];
    function total(r){ return subj.reduce(function(s,k){ return s + (Number(r[k]) || 0); }, 0); }
    var avg = rows.length ? Math.round(rows.reduce(function(s,r){ return s + total(r); }, 0) / rows.length) : 0;
    var maxScore = rows.length ? Math.max.apply(null, rows.map(total)) : 0;
    var passLine = state.passLine;
    var pass = rows.length ? rows.filter(function(r){ return total(r) >= passLine; }).length : 0;
    var el;
    el = TW.$('#scoreAvg'); if (el) el.textContent = avg;
    el = TW.$('#scoreMax'); if (el) el.textContent = maxScore;
    el = TW.$('#scoreRef'); if (el) el.textContent = rows.length + '人参考';
    el = TW.$('#scorePass'); if (el) el.textContent = pass;
    el = TW.$('#scorePassSub'); if (el) el.textContent = '总分≥' + passLine;
  }

  /* ================= 模块绑定 ================= */
  function bindModule(){
    // 事件委托：可编辑表格在排序/编辑/导入后会重建 tbody，直接绑定会失效（"查看按钮点不动"根因）。
    // 委托绑定在 #mainContent 上，重建后依然有效；dataset.bound 防重复监听。
    var main = TW.$('#mainContent');
    if (main && !main.dataset.bound) {
      main.dataset.bound = '1';
      main.addEventListener('click', function(e){
        var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
        if (el && main.contains(el)) action(el.dataset.action, el);
      });
      // 非按钮的快捷入口（hero 任务条目等）支持回车/空格触发
      main.addEventListener('keydown', function(e){
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var el = e.target && e.target.closest ? e.target.closest('[data-action]:not(button):not(select)') : null;
        if (el && main.contains(el)) { e.preventDefault(); el.click(); }
      });
    }
    // 弹窗内 data-action 按钮（如班级事务弹窗的编辑/删除）同样走委托：
    // 弹窗位于 #modalRoot 而非 #mainContent，原委托不覆盖 → 按钮点击无效。
    // 委托绑定在永久容器上，弹窗内容重建后依然有效。
    var modalRoot = TW.$('#modalRoot');
    if (modalRoot && !modalRoot.dataset.bound) {
      modalRoot.dataset.bound = '1';
      modalRoot.addEventListener('click', function(e){
        var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
        if (el && modalRoot.contains(el)) action(el.dataset.action, el);
      });
    }
    if (state.module === 'affairs') {
      TW.$$('.cal-cell:not(.empty)', TW.$('#mainContent')).forEach(function(cell){
        cell.onclick = function(){ quickAddAffair(cell.dataset.date); };
        cell.onkeydown = function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); quickAddAffair(cell.dataset.date); } };
      });
    }
    if (state.module === 'homework') {
      TW.$$('.hw-day', TW.$('#mainContent')).forEach(function(day){
        day.onclick = function(e){
          var card = e.target && e.target.closest ? e.target.closest('.hw-card') : null;
          if (card) return; // 卡片点击由委托 action 处理
          openHomeworkModal(day.dataset.date, null);
        };
      });
    }
    if (state.module === 'lessons') {
      var lf = TW.$('#lessonFilter', TW.$('#mainContent'));
      if (lf) lf.onchange = function(){ state.lessonFilter = this.value; renderShell(); };
    }
    if (state.module === 'personal') {
      TW.$$('.cal-cell:not(.empty)', TW.$('#mainContent')).forEach(function(cell){
        cell.onclick = function(){ quickAddPersonal(cell.dataset.date); };
        cell.onkeydown = function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); quickAddPersonal(cell.dataset.date); } };
      });
    }
    if (state.module === 'points') {
      TW.$$('#pointsTable th[data-psort]', TW.$('#mainContent')).forEach(function(th){
        th.onclick = function(){
          var key = th.dataset.psort;
          if (pointsSort.key === key) pointsSort.dir = -pointsSort.dir; else { pointsSort.key = key; pointsSort.dir = 1; }
          renderShell();
        };
      });
    }
    if (state.module === 'scores') {
      var es = TW.$('#examSelect', TW.$('#mainContent')); if (es) es.onchange = function(){ state.examId = this.value; TW.store.write('exam_selected', state.examId); renderShell(); };
      var ss = TW.$('#scoreStudentSelect', TW.$('#mainContent')); if (ss) ss.onchange = function(){ state.scoreStudent = this.value; TW.store.write('score_student', state.scoreStudent); renderShell(); };
      var cs = TW.$('#scoreCmpSubject', TW.$('#mainContent')); if (cs) cs.onchange = function(){ state.scoreCmp = state.scoreCmp || {}; state.scoreCmp.subject = this.value; renderShell(); };
      [1, 2, 3, 4].forEach(function(i){
        var el = TW.$('#cmpS' + i, TW.$('#mainContent'));
        if (el) el.onchange = function(){ state.scoreCmp = state.scoreCmp || {}; state.scoreCmp.students = state.scoreCmp.students || []; state.scoreCmp.students[i - 1] = this.value || ''; renderShell(); };
      });
      bindScoreTable(TW.$('#mainContent'));
      var pl = TW.$('#passLineInput', TW.$('#mainContent'));
      if (pl) pl.onchange = function(){
        var v = Math.max(0, Math.round(Number(this.value) || 0));
        state.passLine = v; TW.store.write('pass_line', v);
        updateScoreStats(); drawScoresCharts();
        TW.toast('达标总分线已设为 ' + v);
      };
    }
    requestAnimationFrame(drawModuleCharts);
  }
  function bindScoreTable(root){
    var table = TW.$('.score-table', root); if (!table) return;
    TW.$$('.score-cell', table).forEach(function(cell){
      cell.contentEditable = scoreEditing ? 'true' : 'false';
      cell.spellcheck = false;
      if (scoreEditing) {
        // 回车即保存该格并退出编辑（不插入换行）；Shift+回车保留换行
        cell.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cell.blur(); } });
      }
    });
  }
  /* 成绩统一提交：把当前表格内所有可编辑单元格写回 exams（仅在"完成编辑"时调用） */
  function commitScoreTable(){
    var table = TW.$('.score-table'); if (!table) return;
    var examId = table.dataset.exam;
    var exam = TW.exams.find(function(e){ return e.id === examId; }); if (!exam) return;
    TW.$$('.score-table tbody tr').forEach(function(row){
      var name = (TW.$('td', row) ? TW.$('td', row).textContent : '').trim();
      if (!name) return;
      var rec = exam.scores.find(function(s){ return s.name === name; });
      if (!rec) { rec = { name: name }; exam.scores.push(rec); }
      TW.$$('.score-cell', row).forEach(function(cell){
        var sub = cell.dataset.subject;
        var raw = cell.textContent.trim();
        rec[sub] = raw === '' ? '' : (isNaN(Number(raw)) ? raw : Number(raw));
      });
    });
    cw('exams', TW.exams);
    updateScoreStats(); drawScoresCharts();
  }

  /* ================= 动作分发 ================= */
  function action(a, el){
    var f = {
      'new-record': function(){ genericRecordModal('新增记录'); },
      'new-student': newStudent,
      'view-student': function(){ var name = el.dataset.name || (el.closest('tr') ? TW.$('td', el.closest('tr')).textContent.trim() : ''); if (name) viewStudent(name); },
      'export-students': function(){ var rows = TW.students; downloadCSV(classNameOf() + '学生名单.csv', [['姓名','学籍号','性别','学籍状态','宿舍','家长','联系电话']].concat(rows.map(function(s){ return [s.name, s.id, s.gender, s.status, s.dorm, s.parent, s.phone]; }))); TW.toast('已导出学生名单'); },
      'new-attendance': newAttendance,
      'settle-attendance': function(){ var r = TW.attendance.find(function(x){ return x.id === el.dataset.attId; }); if (r) { r.settled = true; r.settledAt = fmtNow(); cw('attendance', TW.attendance); renderShell(); logRecord('考勤管理：销假', r.name); TW.toast(r.name + ' 已销假'); } else { TW.toast('未找到该考勤记录', 'danger'); } },
      'edit-attendance': function(){ var r = TW.attendance.find(function(x){ return x.id === el.dataset.attId; }); if (r) editAttendance(r); else TW.toast('未找到该考勤记录', 'danger'); },
      'del-attendance': function(){ var r = TW.attendance.find(function(x){ return x.id === el.dataset.attId; }); if (!r) { TW.toast('记录不存在', 'danger'); return; } if (confirm('确认删除「' + r.name + ' ' + r.date + '」的考勤记录吗？')) { TW.attendance = TW.attendance.filter(function(x){ return x.id !== r.id; }); cw('attendance', TW.attendance); renderShell(); TW.toast('已删除'); } },
      'export-attendance': function(){ downloadCSV(classNameOf() + '异常考勤.csv', [['日期','学生','类型','备注']].concat(TW.attendance.map(function(r){ return [r.date, r.name, r.type, r.note || '']; }))); TW.toast('已导出异常考勤'); },
      'manage-subjects': manageSubjects,
      'new-exam': newExam,
      'seed-scores': function(){
        var exam = TW.exams.find(function(e){ return e.id === state.examId; }) || TW.exams[0];
        if (!exam) { TW.toast('暂无可用的考试', 'danger'); return; }
        exam.scores = TW.students.map(function(s){ return { name: s.name }; });
        cw('exams', TW.exams); renderShell(); logRecord('成绩分析：生成空成绩表', exam.scores.length + ' 行'); TW.toast('已按学生名单生成 ' + exam.scores.length + ' 行空成绩表');
      },
      'score-toggle-edit': function(){ if (scoreEditing) commitScoreTable(); scoreEditing = !scoreEditing; renderShell(); if (!scoreEditing) TW.toast('成绩已保存到本机'); },
      'import-exam': importExam,
      'export-exam': exportExam,
      'new-homework': newHomework,
      'edit-homework': function(){ openHomeworkModal(el.dataset.hwDate, Number(el.dataset.hwIdx)); },
      'hw-week-prev': function(){ var d = weekMonday(state.hwWeekStart); d.setDate(d.getDate() - 7); state.hwWeekStart = dateStr(d); renderShell(); },
      'hw-week-next': function(){ var d = weekMonday(state.hwWeekStart); d.setDate(d.getDate() + 7); state.hwWeekStart = dateStr(d); renderShell(); },
      'lesson-week-prev': function(){ state.hwWeekStart = dateStr(new Date(new Date(weekMonday(state.hwWeekStart)).getTime() - 7 * 86400000)); renderShell(); },
      'lesson-week-next': function(){ state.hwWeekStart = dateStr(new Date(new Date(weekMonday(state.hwWeekStart)).getTime() + 7 * 86400000)); renderShell(); },
      'lesson-edit': function(){ lessonEditModal(el.dataset.cls, el.dataset.date); },
      'lesson-add': function(){ lessonEditModal(el.dataset.cls || '', el.dataset.date || ''); },
      'lesson-class-manage': lessonClassesManage,
      'lesson-class-info-edit': function(){ lessonClassInfoEdit(el.dataset.cls); },
      'lesson-record-del': function(){
        var r = (TW.lessons || []).find(function(x){ return x.id === el.dataset.id; });
        if (!r) { TW.toast('记录不存在', 'danger'); return; }
        // 删除单条课时记录（可撤回）
        TW.lessons = TW.lessons.filter(function(x){ return x !== r; });
        lessonSave(); renderShell();
        logRecord('课时管理：删除课时记录', r.cls + ' ' + r.date);
        TW.toast('已删除课时记录');
      },
      'schedule-manage': scheduleManage,
      'schedule-upload': scheduleUpload,
      'lesson-upload': lessonUpload,
      'new-meeting': newMeeting,
      'new-meeting-plan': newMeetingPlan,
      'new-family': newFamily,
      'new-parent-meeting': newParentMeeting,
      'new-family-plan': newFamilyPlan,
      'new-dorm': newDorm,
      'edit-dorm': function(){ editDorm(Number(el.dataset.idx)); },
      'new-dorm-visit': newDormVisit,
      'view-talks': function(){ var name = el.dataset.name || (el.closest('tr') ? TW.$('td', el.closest('tr')).textContent.trim() : ''); if (name) viewTalks(name); },
      'new-quality': newQuality,
      'new-selection': newSelection,
      'export-selection': function(){ var sel = TW.selection || {}; downloadCSV(classNameOf() + '选科意向.csv', [['姓名','首选','再选组合']].concat((sel.intents || []).map(function(i){ return [i.name, i.first, i.combos]; }))); TW.toast('已导出选科意向'); },
      'cal-prev': function(){ state.calMonth--; if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; } renderShell(); },
      'cal-next': function(){ state.calMonth++; if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; } renderShell(); },
      'pcal-prev': function(){ state.pCalMonth--; if (state.pCalMonth < 0) { state.pCalMonth = 11; state.pCalYear--; } renderShell(); },
      'pcal-next': function(){ state.pCalMonth++; if (state.pCalMonth > 11) { state.pCalMonth = 0; state.pCalYear++; } renderShell(); },
      'goto-task': gotoTask,
      'goto-lessons': function(){ gotoModule('lessons'); },
      'goto-affair': gotoAffair,
      'new-affair': newAffair,
      'edit-affair': function(){ editAffair(el.dataset.affairDate, Number(el.dataset.affairIdx)); },
      'delete-affair': function(){ deleteAffair(el.dataset.affairDate, Number(el.dataset.affairIdx)); },
      'new-personal': newPersonal,
      'edit-personal': function(){ editPersonal(el.dataset.pmId); },
      'delete-personal': function(){ deletePersonal(el.dataset.pmId); },
      'new-cleaning': newCleaning,
      'edit-user-record': editUserRecord,
      'delete-user-record': deleteUserRecord,
      'goto-context': function(){
        var parts = String(el.dataset.context || '').split('|');
        if (parts.length >= 3) {
          state.area = parts[0]; state.classId = parts[1]; state.module = parts[2];
          hydrate(); persistContext(); renderShell();
          TW.toast('已前往' + (MODULE_NAMES[parts[2]] || parts[2]));
        }
      },
      'view-points': viewPoints,
      'add-point': function(){ pointModal(el.dataset.sid, 1); },
      'deduct-point': function(){ pointModal(el.dataset.sid, -1); },
      'goto-alert': function(){ gotoModule(el.dataset.target); },
      'edit-list-row': editListRow,
      'delete-list-row': deleteListRow,
      'view-list-row': viewListRow,
      'edit-record': function(){ genericRecordModal('查看记录'); },
      'profile-edit-class': profileEditClass,
      'profile-edit-semester': profileEditSemester
    };
    var h = f[a];
    if (h) { h(el); return; }
    TW.toast('操作未实现：' + a);
  }

  function genericRecordModal(title){
    var key = 'modal_draft_' + contextId();
    TW.modal(title, '<div class="form-grid"><div class="field"><label class="required">事项</label><input id="gTitle" placeholder="请输入名称"></div><div class="field"><label class="required">日期</label><input id="gDate" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field full"><label>备注</label><textarea id="gNote" placeholder="补充说明"></textarea></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="gSave">保存到本机</button>');
    bindDraftFields(TW.$('.modal-body'), key);
    TW.$('#gSave').onclick = function(){ var t = TW.$('#gTitle').value.trim(); if (!t) { TW.toast('请填写事项名称', 'danger'); return; } saveUserRecord({ id: uid('r'), context: contextId(), kind: 'record', title: t, date: TW.$('#gDate').value, note: TW.$('#gNote').value.trim(), status: '已保存', createdAt: new Date().toISOString(), updatedAt: TW.format.now() }); TW.store.remove(key); TW.$('#modalRoot').innerHTML = ''; renderShell(); TW.toast('已保存到本机'); };
  }

  /* ============ 学校/教务板块专属新增表单（写入对应台账，全局持久化） ============ */
  function newPersonal(){
    var d = new Date();
    quickAddPersonal(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'));
  }
  function quickAddPersonal(date){
    var list = (TW.personalMemo || []).filter(function(x){ return x.date === date; });
    var listHtml = list.length
      ? '<ul class="mini-list affair-mini-list" style="max-height:30vh;overflow:auto">' + list.map(function(x){
          var m = x.color ? macaronById(x.color) : null;
          return '<li class="affair-item" data-pm-id="' + x.id + '"' + (m ? ' style="--affair-bg:' + m.bg + ';--affair-fg:' + m.fg + '"' : '') + '><span class="affair-dot" ' + (m ? 'style="background:' + m.bg + ';border-color:' + m.fg + '"' : '') + '></span><span class="affair-main"><strong>' + TW.escape(x.title) + '</strong>' + (x.kind ? '<span class="status-badge info">' + TW.escape(x.kind) + '</span>' : '') + (x.note ? '<div class="note">' + TW.escape(x.note) + '</div>' : '') + '</span><span class="affair-ops"><button class="button text" data-action="edit-personal" data-pm-id="' + TW.escape(x.id) + '">编辑</button><button class="button text danger-text" data-action="delete-personal" data-pm-id="' + TW.escape(x.id) + '">删除</button></span></li>';
        }).join('') + '</ul>'
      : '<div class="alert info">当日暂无备忘，可直接录入</div>';
    TW.modal(date + ' 个人备忘',
      '<div class="section-title" style="margin-bottom:10px">快速录入</div>'
      + '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="pmDate" type="date" value="' + date + '" disabled style="background:var(--table-head)"></div><div class="field"><label class="required">事项</label><input id="pmTitle" placeholder="如：备课、家长会、提交材料"></div><div class="field"><label>类型</label><input id="pmKind" list="pmKindList" placeholder="如：工作 / 生活 / 学习（可自定义）" autocomplete="off"><datalist id="pmKindList"><option>工作</option><option>生活</option><option>学习</option><option>健康</option><option>家庭</option></datalist></div><div class="field full"><label>颜色</label>' + macaronPickerHtml('', 'pmColor') + '</div><div class="field full"><label>备注</label><input id="pmNote" placeholder="补充说明（可选）"></div></div>'
      + '<div class="toolbar" style="margin:12px 0 4px;justify-content:flex-end"><button class="button" id="pmSave">保存到该日</button><button class="button secondary" data-close>关闭</button></div>'
      + '<div class="section-title" style="margin:16px 0 10px">当日备忘 <small>点击「编辑」可修改事项、类型、备注与颜色</small></div>'
      + listHtml,
      ' ');
    var _pmFoot = TW.$('#modalRoot .modal-foot');
    if (_pmFoot && _pmFoot.style) _pmFoot.style.display = 'none';
    setTimeout(function(){ var i = TW.$('#pmTitle'); if (i) i.focus(); }, 50);
    bindMacaronPicker('pmColor');
    TW.$('#pmSave').onclick = function(){
      var t = TW.$('#pmTitle').value.trim();
      if (!t) { TW.toast('请填写事项', 'danger'); return; }
      TW.personalMemo.push({ id: uid('pm'), date: date, title: t, kind: TW.$('#pmKind').value.trim(), note: TW.$('#pmNote').value.trim(), color: selectedMacaron('pmColor') });
      gw('personal_memo', TW.personalMemo); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('个人事务：新增备忘', date + ' ' + t); TW.toast('已添加到 ' + date);
    };
  }
  /* 编辑个人备忘（事项/类型/备注/颜色全自定义） */
  function editPersonal(id){
    var row = (TW.personalMemo || []).find(function(x){ return x.id === id; });
    if (!row) { TW.toast('记录不存在', 'danger'); return; }
    TW.modal('编辑备忘 · ' + row.title, '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="pmDate" type="date" value="' + TW.escape(row.date) + '"></div><div class="field"><label class="required">事项</label><input id="pmTitle" value="' + TW.escape(row.title) + '"></div><div class="field"><label>类型</label><input id="pmKind" list="pmKindList" autocomplete="off" value="' + TW.escape(row.kind || '') + '"><datalist id="pmKindList"><option>工作</option><option>生活</option><option>学习</option><option>健康</option><option>家庭</option></datalist></div><div class="field full"><label>颜色</label>' + macaronPickerHtml(row.color || '', 'pmColor') + '</div><div class="field full"><label>备注</label><input id="pmNote" value="' + TW.escape(row.note || '') + '"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="pmSave">保存修改</button>');
    bindMacaronPicker('pmColor');
    TW.$('#pmSave').onclick = function(){
      var t = TW.$('#pmTitle').value.trim();
      if (!t) { TW.toast('请填写事项', 'danger'); return; }
      row.date = TW.$('#pmDate').value;
      row.title = t;
      row.kind = TW.$('#pmKind').value.trim();
      row.note = TW.$('#pmNote').value.trim();
      row.color = selectedMacaron('pmColor');
      gw('personal_memo', TW.personalMemo); TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('个人事务：编辑备忘', row.title);
      TW.toast('已保存修改');
    };
  }
  function deletePersonal(id){
    var row = (TW.personalMemo || []).find(function(x){ return x.id === id; });
    if (!row) return;
    // 个人备忘删除不做二次确认（点击即删，可撤回）
    TW.personalMemo = TW.personalMemo.filter(function(x){ return x.id !== id; });
    gw('personal_memo', TW.personalMemo); TW.$('#modalRoot').innerHTML = ''; renderShell();
    logRecord('个人事务：删除备忘', row.title);
    TW.toast('已删除');
  }
  function newCleaning(){
    var weekOpts = CLEAN_WEEKS.map(function(w){ return '<option' + (w === todayLabel() ? ' selected' : '') + '>' + w + '</option>'; }).join('');
    var memberOpts = (TW.students || []).map(function(s){ return '<button type="button" class="member-option" data-name="' + TW.escape(s.name) + '">' + TW.escape(s.name) + '</button>'; }).join('');
    TW.modal('新增值日排班', '<div class="form-grid"><div class="field"><label class="required">星期</label><select id="clWeek">' + weekOpts + '</select></div><div class="field full"><label class="required">值日学生</label><div class="member-picker"><input id="clMembers" placeholder="如：张雨桐、李明轩" autocomplete="off"><div class="member-chips" id="clChips"></div></div><small class="note">从下方名单点选学生（可多选，再次点击取消），或直接输入姓名，用顿号分隔</small><div class="member-options" id="clOptions">' + memberOpts + '</div></div><div class="field full"><label class="required">值日内容</label><input id="clTask" placeholder="如：扫地、拖地、擦黑板（可自定义）"><div class="task-quick" id="clQuick"></div></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="clSave">保存排班</button>');
    // 常用值日内容快捷标签（点击填入）
    var quick = ['扫地','拖地','擦黑板','擦窗台','倒垃圾','擦讲台','大扫除'];
    TW.$('#clQuick').innerHTML = quick.map(function(q){ return '<button type="button" class="button secondary small" data-quick="' + q + '">' + q + '</button>'; }).join('');
    TW.$$('#clQuick [data-quick]').forEach(function(b){ b.onclick = function(){
      var inp = TW.$('#clTask'), cur = inp.value.trim();
      inp.value = cur ? cur + '、' + b.dataset.quick : b.dataset.quick;
      inp.focus();
    }; });
    // 学生点选 chips
    function refreshChips(){
      var names = String(TW.$('#clMembers').value || '').split(/[、,，]/).map(function(n){ return n.trim(); }).filter(Boolean);
      TW.$('#clChips').innerHTML = names.map(function(n){ return '<span class="member-chip" data-name="' + TW.escape(n) + '">' + TW.escape(n) + ' ×</span>'; }).join('');
      TW.$$('#clChips .member-chip').forEach(function(c){ c.onclick = function(){ removeMember(c.dataset.name); }; });
      TW.$$('#clOptions .member-option').forEach(function(o){
        var on = names.indexOf(o.dataset.name) >= 0;
        o.classList.toggle('selected', on);
        o.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    function addMember(name){
      var cur = String(TW.$('#clMembers').value || '').split(/[、,，]/).map(function(n){ return n.trim(); }).filter(Boolean);
      if (cur.indexOf(name) < 0) cur.push(name);
      TW.$('#clMembers').value = cur.join('、');
      refreshChips();
    }
    function removeMember(name){
      var cur = String(TW.$('#clMembers').value || '').split(/[、,，]/).map(function(n){ return n.trim(); }).filter(Boolean).filter(function(n){ return n !== name; });
      TW.$('#clMembers').value = cur.join('、');
      refreshChips();
    }
    TW.$('#clMembers').addEventListener('input', refreshChips);
    // 名单按钮点选：选中/取消切换（替代原 select，修复无法单选的问题）
    TW.$$('#clOptions .member-option').forEach(function(b){
      b.onclick = function(){
        var name = b.dataset.name;
        var cur = String(TW.$('#clMembers').value || '').split(/[、,，]/).map(function(n){ return n.trim(); }).filter(Boolean);
        if (cur.indexOf(name) >= 0) removeMember(name); else addMember(name);
      };
    });
    refreshChips();
    TW.$('#clSave').onclick = function(){
      var week = TW.$('#clWeek').value, members = String(TW.$('#clMembers').value || '').trim().replace(/[,,，]+/g, '、').replace(/^[、]+|[、]+$/g, '');
      var task = TW.$('#clTask').value.trim();
      if (!members) { TW.toast('请选择值日学生', 'danger'); return; }
      if (!task) { TW.toast('请填写值日内容', 'danger'); return; }
      // 同星期已有排班则覆盖（避免重复）
      var idx = TW.cleaning.findIndex(function(x){ return x.week === week; });
      if (idx >= 0) {
        TW.cleaning[idx].members = members; TW.cleaning[idx].task = task;
        TW.toast('已更新' + week + '的值日安排');
      } else {
        TW.cleaning.push({ week: week, members: members, task: task });
        TW.toast('已新增' + week + '的值日安排');
      }
      cw('cleaning', TW.cleaning); TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('值日表：' + (idx >= 0 ? '更新' : '新增') + '排班', week + ' ' + task);
    };
  }
  function todayLabel(){
    var idx = (new Date().getDay() + 6) % 7;
    return CLEAN_WEEKS[idx];
  }
  /* 分数管理 · 明细弹窗（该生全部加减分记录，按时间倒序） */
  function viewPoints(el){
    var sid = el.dataset.sid;
    var st = studentBySid(sid);
    var name = st ? st.name : (el.dataset.name || '');
    var logs = pointLogs(sid);
    var total = pointTotal(sid);
    var rowsHtml = logs.length
      ? '<table class="data-table no-edit-table"><thead><tr><th>时间</th><th>变动</th><th>原因</th></tr></thead><tbody>' + logs.slice().reverse().map(function(l){
          var d = Number(l.delta) || 0;
          return '<tr><td class="mono">' + TW.escape(l.time || '—') + '</td><td><span class="' + (d > 0 ? 'ok-text' : 'danger-text') + '">' + (d > 0 ? '+' : '') + d + '</span></td><td>' + TW.escape(l.reason || '') + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="alert info">暂无加减分记录，当前保持初始 100 分。</div>';
    TW.modal('积分明细 · ' + name + '（当前 ' + total + ' 分）', rowsHtml);
  }
  /* 分数管理 · 加减分弹窗（分数 / 原因 / 时间，时间必填） */
  function pointModal(sid, dir){
    var st = studentBySid(sid);
    var name = st ? st.name : '';
    if (!sid || !name) { TW.toast('未指定学生', 'danger'); return; }
    var isAdd = dir > 0;
    var quickReasons = isAdd ? ['主动值日','积极回答','课堂表现好','帮助同学','作业优秀'] : ['迟到','未交作业','课堂纪律','卫生不合格','手机违规'];
    TW.modal((isAdd ? '加分' : '扣分') + ' · ' + name + '（当前 ' + pointTotal(sid) + ' 分）',
      '<div class="form-grid"><div class="field"><label class="required">' + (isAdd ? '加' : '扣') + '分分数</label><input id="ptDelta" type="number" min="1" max="100" value="1" autocomplete="off"><div class="task-quick" id="ptQuickDelta">' + [1,2,3,5,10].map(function(v){ return '<button type="button" class="button secondary small" data-quickdelta="' + v + '">' + (isAdd ? '+' : '-') + v + '</button>'; }).join('') + '</div></div><div class="field"><label class="required">时间</label><input id="ptTime" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field full"><label class="required">原因</label><input id="ptReason" placeholder="如：' + (isAdd ? '主动值日、积极回答问题' : '迟到、未交作业、扰乱课堂') + '" autocomplete="off" list="ptReasonList"><datalist id="ptReasonList">' + quickReasons.map(function(r){ return '<option value="' + r + '">'; }).join('') + '</datalist></div></div>',
      '<button class="button secondary" data-close>取消</button><button class="button ' + (isAdd ? '' : 'danger') + '" id="ptSave">确认' + (isAdd ? '加分' : '扣分') + '</button>');
    TW.$$('#ptQuickDelta [data-quickdelta]').forEach(function(b){ b.onclick = function(){ TW.$('#ptDelta').value = b.dataset.quickdelta; TW.$('#ptReason').focus(); }; });
    TW.$('#ptSave').onclick = function(){
      var delta = Number(TW.$('#ptDelta').value);
      var time = TW.$('#ptTime').value;
      var reason = TW.$('#ptReason').value.trim();
      if (!delta || delta <= 0) { TW.toast('请输入大于 0 的分数', 'danger'); return; }
      if (!time) { TW.toast('请选择时间', 'danger'); return; }
      if (!reason) { TW.toast('请填写原因', 'danger'); return; }
      var rec = pointOf(sid);
      if (!rec) { rec = { sid: sid, name: name, logs: [] }; TW.points.push(rec); }
      rec.logs.push({ delta: isAdd ? delta : -delta, reason: reason, time: time });
      cw('points', TW.points);
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('分数管理：' + (isAdd ? '加' : '扣') + '分', name + ' ' + (isAdd ? '+' : '') + (isAdd ? delta : -delta) + ' 分 · ' + reason);
      TW.toast(name + (isAdd ? ' 加' : ' 扣') + delta + ' 分成功');
    };
    var inp = TW.$('#ptReason'); if (inp) inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); TW.$('#ptSave').click(); } });
    var d = TW.$('#ptDelta'); if (d) d.focus();
  }
  function editUserRecord(el){
    var r = TW.userRecords.find(function(x){ return x.id === el.dataset.recordId; });
    if (!r) { TW.toast('记录不存在', 'danger'); return; }
    TW.modal('编辑本机记录', '<div class="form-grid"><div class="field"><label class="required">事项</label><input id="erTitle" value="' + TW.escape(r.title) + '"></div><div class="field"><label>日期</label><input id="erDate" type="date" value="' + TW.escape(r.date || '') + '"></div><div class="field full"><label>备注</label><textarea id="erNote">' + TW.escape(r.note || '') + '</textarea></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="erSave">保存</button>');
    TW.$('#erSave').onclick = function(){ var t = TW.$('#erTitle').value.trim(); if (!t) { TW.toast('事项名称不能为空', 'danger'); return; } r.title = t; r.date = TW.$('#erDate').value; r.note = TW.$('#erNote').value.trim(); r.updatedAt = TW.format.now(); TW.store.write('user_records', TW.userRecords); TW.$('#modalRoot').innerHTML = ''; renderShell(); TW.toast('修改已保存'); };
  }
  function deleteUserRecord(el){
    var r = TW.userRecords.find(function(x){ return x.id === el.dataset.recordId; });
    if (r && confirm('确认删除“' + r.title + '”吗？')) { TW.userRecords = TW.userRecords.filter(function(x){ return x.id !== r.id; }); TW.store.write('user_records', TW.userRecords); renderShell(); TW.toast('已删除'); }
  }

  function newStudent(){
    TW.modal('新增学生', '<div class="form-grid"><div class="field"><label class="required">姓名</label><input id="sName"></div><div class="field"><label>学籍号</label><input id="sId" placeholder="G2026..."></div><div class="field"><label>性别</label><select id="sGender"><option>女</option><option>男</option></select></div><div class="field"><label>学籍状态</label><select id="sStatus"><option>在籍</option><option>住宿</option><option>休学</option><option>转学</option></select></div><div class="field"><label>宿舍</label><input id="sDorm" placeholder="如 A401"></div><div class="field"><label>家长</label><input id="sParent"></div><div class="field"><label>联系电话</label><input id="sPhone"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="sSave">保存学生</button>');
    TW.$('#sSave').onclick = function(){ var name = TW.$('#sName').value.trim(); if (!name) { TW.toast('请填写姓名', 'danger'); return; }
      var focusMark = '';
      TW.students.push({ name: name, id: TW.$('#sId').value.trim(), gender: TW.$('#sGender').value, status: TW.$('#sStatus').value, dorm: TW.$('#sDorm').value.trim(), parent: TW.$('#sParent').value.trim(), phone: TW.$('#sPhone').value.trim(), focus: 0, classId: state.classId });
      cw('students', TW.students);
      // 同步进可编辑表格存储，保证学生档案表立即可见
      var rosterKey = contextId() + '::table_0';
      TW.store.update('editable_tables_v2', function(d){ d = d || {}; d[rosterKey] = d[rosterKey] || []; d[rosterKey].push([name, TW.$('#sId').value.trim(), TW.$('#sGender').value, TW.$('#sStatus').value, TW.$('#sDorm').value.trim(), TW.$('#sParent').value.trim(), TW.$('#sPhone').value.trim(), focusMark]); return d; }, {});
      TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('学生档案：新增学生', name); TW.toast('已新增学生 ' + name); };
  }
  /* 学生成长档案：聚合该生跨板块数据（分数/考勤/心理/成绩/值日/家校/综评） */
  function viewStudent(name){
    var s = TW.students.find(function(x){ return x.name === name; }); if (!s) return;
    var sid = s.sid;
    var parts = [];
    // 基本信息（含全局班级代码）
    parts.push('<section class="section"><div class="section-title">基本信息</div><div class="section-body"><div class="grid-2">' + [['所属班级', classNameOfClassId(s.classId)], ['学籍号', s.id || '—'], ['性别', s.gender || '—'], ['学籍状态', s.status || '—'], ['宿舍', s.dorm || '—'], ['家长', s.parent || '—'], ['联系电话', s.phone || '—'], ['重点关注', s.focus > 0 ? ('L' + s.focus + ' · ' + (s.focusReason || '')) : '无'], ['当前积分', pointTotal(sid) + ' 分']].map(function(p){ return '<div class="stat-card"><div class="stat-label">' + p[0] + '</div><div class="stat-value" style="font-size:15px">' + TW.escape(String(p[1])) + '</div></div>'; }).join('') + '</div></div></section>');
    // 分数明细（最近 8 条）
    var logs = pointLogs(sid);
    parts.push('<section class="section"><div class="section-title">积分明细 <small>当前 ' + pointTotal(sid) + ' 分 · 共 ' + logs.length + ' 条</small></div><div class="section-body">' + (logs.length ? '<table class="data-table no-edit-table"><thead><tr><th>时间</th><th>变动</th><th>原因</th></tr></thead><tbody>' + logs.slice().reverse().slice(0, 8).map(function(l){ var d = Number(l.delta) || 0; return '<tr><td class="mono">' + TW.escape(l.time || '—') + '</td><td><span class="' + (d > 0 ? 'ok-text' : 'danger-text') + '">' + (d > 0 ? '+' : '') + d + '</span></td><td>' + TW.escape(l.reason || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="alert info">暂无加减分记录。</div>') + '</div></section>');
    // 考勤
    var atts = (TW.attendance || []).filter(function(a){ return recSid(a) === sid; });
    parts.push('<section class="section"><div class="section-title">考勤记录 <small>' + atts.length + ' 条异常</small></div><div class="section-body">' + (atts.length ? '<table class="data-table no-edit-table"><thead><tr><th>日期</th><th>类型</th><th>备注</th></tr></thead><tbody>' + atts.slice().reverse().slice(0, 6).map(function(a){ return '<tr><td class="mono">' + a.date + '</td><td>' + a.type + '</td><td>' + TW.escape(a.note || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="alert info">无异常考勤记录。</div>') + '</div></section>');
    // 心理关注
    var m = (TW.mental || []).find(function(x){ return recSid(x) === sid; });
    parts.push('<section class="section"><div class="section-title">心理关注</div><div class="section-body">' + (m ? '<div class="alert ' + (m.level >= 2 ? 'danger' : 'info') + '">等级 ' + levelBadge(m.level) + ' · ' + TW.escape(m.reason || '') + '</div>' : '<div class="alert info">未在心理关注名单。</div>') + '</div></section>');
    // 谈话记录（归总到学生档案）
    var talkRows = talksOf(s.name);
    parts.push('<section class="section"><div class="section-title">谈话记录 <small>' + talkRows.length + ' 条 · 成绩/个人/宿舍/其他</small></div><div class="section-body">' + (talkRows.length ? talkRows.slice().reverse().slice(0, 6).map(function(t){ return '<div class="note" style="margin-top:6px"><span class="status-badge info">' + TW.escape(t.type || '其他') + '</span> [' + TW.escape(t.time || '') + '] ' + TW.escape(t.content || '') + (t.audioId ? ' <a href="/api/attachments/' + t.audioId + '" download class="button text">录音</a>' : '') + '</div>'; }).join('') : '<div class="alert info">暂无谈话记录。</div>') + '</div></section>');
    // 成绩
    var exams = TW.exams || [];
    var scoreRows = exams.map(function(e){
      var r = (e.scores || []).find(function(x){ return x.name === s.name; });
      if (!r) return null;
      var total = TW.subjects.reduce(function(sum, k){ return sum + (Number(r[k]) || 0); }, 0);
      return { name: e.name, date: e.date, total: total };
    }).filter(Boolean);
    parts.push('<section class="section"><div class="section-title">考试成绩 <small>总分</small></div><div class="section-body">' + (scoreRows.length ? '<table class="data-table no-edit-table"><thead><tr><th>考试</th><th>日期</th><th>总分</th></tr></thead><tbody>' + scoreRows.map(function(x){ return '<tr><td>' + TW.escape(x.name) + '</td><td class="mono">' + x.date + '</td><td class="numeric">' + x.total + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="alert info">暂无成绩记录。</div>') + '</div></section>');
    // 值日
    var duty = (TW.cleaning || []).filter(function(c){ return String(c.members || '').split(/[、,，]/).indexOf(s.name) >= 0; });
    parts.push('<section class="section"><div class="section-title">值日安排</div><div class="section-body">' + (duty.length ? duty.map(function(c){ return '<div class="note">' + c.week + ' · ' + TW.escape(c.task || '') + '</div>'; }).join('') : '<div class="alert info">未排值日。</div>') + '</div></section>');
    // 家校沟通
    var fams = (TW.family || []).filter(function(f){ return String(f.target || '').indexOf(s.name) >= 0; });
    parts.push('<section class="section"><div class="section-title">家校沟通 <small>' + fams.length + ' 条</small></div><div class="section-body">' + (fams.length ? fams.slice().reverse().slice(0, 4).map(function(f){ return '<div class="note" style="margin-top:4px">[' + f.date + ' · ' + TW.escape(f.type || '') + '] ' + TW.escape(f.content || '') + (f.feedback ? ' — ' + TW.escape(f.feedback) : '') + '</div>'; }).join('') : '<div class="alert info">暂无沟通记录。</div>') + '</div></section>');
    // 综评
    var q = (TW.quality || []).find(function(x){ return recSid(x) === sid; });
    if (q) parts.push('<section class="section"><div class="section-title">综合素质评价</div><div class="section-body"><div class="grid-5" style="margin-bottom:8px">' + ['道德','学业','健康','艺术','劳动'].map(function(k){ var e = {道德:q.moral,学业:q.academic,健康:q.health,艺术:q.art,劳动:q.labor}[k]; return '<div class="stat-card"><div class="stat-label">' + k + '</div><div class="stat-value">' + (e || '—') + '</div></div>'; }).join('') + '</div>' + (q.comment ? '<div class="note">' + TW.escape(q.comment) + '</div>' : '') + '</div></section>');
    TW.modal('成长档案 · ' + s.name, parts.join(''), '<button class="button secondary" data-close>关闭</button>');
  }

  function newAttendance(){
    TW.modal('记录异常考勤', '<div class="form-grid"><div class="field"><label class="required">学生</label><select id="aName">' + TW.students.map(function(s){ return '<option value="' + TW.escape(s.sid) + '">' + TW.escape(s.name) + '</option>'; }).join('') + '</select></div><div class="field"><label class="required">类型</label><select id="aType"><option>迟到</option><option>缺勤</option><option>请假</option></select></div><div class="field"><label class="required">日期</label><input id="aDate" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field full"><label>备注</label><input id="aNote" placeholder="如：07:42 到校 / 请假原因"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="aSave">保存</button>');
    TW.$('#aSave').onclick = function(){ var sid = TW.$('#aName').value, st = studentBySid(sid); TW.attendance.push({ id: uid('att'), sid: sid, name: st ? st.name : TW.$('#aName').value, date: TW.$('#aDate').value, type: TW.$('#aType').value, note: TW.$('#aNote').value.trim() }); cw('attendance', TW.attendance); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('考勤管理：新增异常记录', (st ? st.name : '') + ' ' + TW.$('#aType').value); TW.toast('已记录'); };
  }
  function editAttendance(r){
    TW.modal('编辑考勤 · ' + r.name, '<div class="form-grid"><div class="field"><label class="required">学生</label><select id="aName">' + TW.students.map(function(s){ return '<option value="' + TW.escape(s.sid) + '"' + (recSid(r) === s.sid ? ' selected' : '') + '>' + TW.escape(s.name) + '</option>'; }).join('') + '</select></div><div class="field"><label class="required">类型</label><select id="aType"><option' + (r.type === '迟到' ? ' selected' : '') + '>迟到</option><option' + (r.type === '缺勤' ? ' selected' : '') + '>缺勤</option><option' + (r.type === '请假' ? ' selected' : '') + '>请假</option></select></div><div class="field"><label class="required">日期</label><input id="aDate" type="date" value="' + TW.escape(r.date || '') + '"></div><div class="field full"><label>备注</label><input id="aNote" value="' + TW.escape(r.note || '') + '"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="aSave">保存</button>');
    TW.$('#aSave').onclick = function(){ var sid = TW.$('#aName').value, st = studentBySid(sid); r.sid = sid; r.name = st ? st.name : r.name; r.date = TW.$('#aDate').value; r.type = TW.$('#aType').value; r.note = TW.$('#aNote').value.trim(); cw('attendance', TW.attendance); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('考勤管理：编辑记录', r.name + ' ' + r.type); TW.toast('已保存修改'); };
  }

  function manageSubjects(){
    TW.modal('学科设置', '<div class="note" style="margin-bottom:10px">自定义本班成绩科目（不限于语数英物化生）。删除科目会同时从成绩表隐藏该列，历史数据保留。</div><div id="subjList">' + TW.subjects.map(function(k){ return '<div class="task-row"><span>' + TW.escape(k) + '</span><button class="button text danger-text" data-delsubj="' + TW.escape(k) + '">删除</button></div>'; }).join('') + '</div>', '<button class="button secondary" data-close>关闭</button><button class="button" id="addSubjBtn">+ 新增学科</button>');
    TW.$('#addSubjBtn').onclick = function(){ var k = prompt('新学科名称（如：政治、地理、信息）'); if (!k || !k.trim()) return; if (TW.subjects.indexOf(k.trim()) >= 0) { TW.toast('该学科已存在', 'danger'); return; } TW.subjects.push(k.trim()); cw('subjects', TW.subjects); TW.$('#modalRoot').innerHTML = ''; renderShell(); TW.toast('已新增学科 ' + k.trim()); };
    TW.$$('[data-delsubj]', TW.$('#modalRoot')).forEach(function(b){ b.onclick = function(){ if (TW.subjects.length <= 1) { TW.toast('至少保留一个学科', 'danger'); return; } TW.subjects = TW.subjects.filter(function(x){ return x !== b.dataset.delsubj; }); cw('subjects', TW.subjects); TW.$('#modalRoot').innerHTML = ''; renderShell(); TW.toast('已删除学科'); }; });
  }
  function exportExam(){
    var exams = TW.exams || [], exam = exams.find(function(e){ return e.id === state.examId; }) || exams[0], rows = (exam && exam.scores) || [], subj = TW.subjects;
    function total(r){ return subj.reduce(function(s,k){ return s + (Number(r[k]) || 0); }, 0); }
    downloadCSV((exam ? exam.name : '成绩') + '.csv', [['姓名'].concat(subj, ['总分'])].concat(rows.map(function(r){ return [r.name].concat(subj.map(function(k){ return r[k] || 0; }), [total(r)]); })));
    TW.toast('已导出' + rows.length + '条成绩');
  }

  /* 成绩 CSV 上传：表头「姓名,学科1,学科2,…」与当前学科一致，支持合并/替换导入 */
  /* 新增考试：教师可自行创建任意考试（月考/期中/期末/周测…），空表可手动录入或上传成绩 CSV */
  function newExam(){
    TW.modal('新增考试', '<div class="form-grid"><div class="field"><label class="required">考试名称</label><input id="neName" placeholder="如：10月月考、期中考试、期末模拟"></div><div class="field"><label class="required">考试日期</label><input id="neDate" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="neSave">创建考试</button>');
    TW.$('#neSave').onclick = function(){
      var name = TW.$('#neName').value.trim();
      if (!name) { TW.toast('请填写考试名称', 'danger'); return; }
      var date = TW.$('#neDate').value;
      if (!date) { TW.toast('请选择考试日期', 'danger'); return; }
      var ex = { id: uid('ex'), name: name, date: date, scores: [] };
      TW.exams.push(ex);
      state.examId = ex.id;
      TW.store.write('exam_selected', ex.id);
      cw('exams', TW.exams);
      TW.$('#modalRoot').innerHTML = '';
      renderShell();
      TW.toast('已创建考试「' + name + '」，可在录入表直接填写或上传成绩 CSV'); logRecord('成绩分析：新增考试', name + '（' + date + '）');
    };
    var inp = TW.$('#neName'); if (inp) inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); TW.$('#neSave').click(); } });
  }

  function importExam(){
    var exams = TW.exams || [];
    var exam = exams.find(function(e){ return e.id === state.examId; }) || exams[0];
    if (!exam) { TW.toast('暂无可导入的考试', 'danger'); return; }
    var subj = TW.subjects;
    var m = TW.modal('上传成绩 · ' + exam.name, '<div class="import-dialog"><div class="alert info">CSV 格式：首行表头「姓名,' + subj.join('、') + '」，共 ' + (subj.length + 1) + ' 列，顺序须与学科设置一致；支持 UTF-8 CSV（Excel 请"另存为 CSV"）；系统先校验并预览，不会直接覆盖。可先下载模板对照填写。</div><div class="toolbar" style="margin:10px 0"><button class="button secondary" id="examTemplate">⬇ 下载成绩模板</button></div><div class="field"><label class="required">选择成绩 CSV</label><input id="examImportFile" type="file" accept=".csv,text/csv"></div><div id="examImportPreview" class="import-preview note">尚未选择文件</div></div>', '<button class="button secondary" data-close>取消</button><button class="button secondary" id="examAppend" disabled>合并导入</button><button class="button" id="examReplace" disabled>替换导入</button>');
    var modalEl = m.root.querySelector('.modal'); if (modalEl) modalEl.classList.add('import-modal');
    var input = TW.$('#examImportFile'), preview = TW.$('#examImportPreview'), append = TW.$('#examAppend'), replace = TW.$('#examReplace');
    var parsed = null;
    TW.$('#examTemplate').onclick = function(){
      var headers = ['姓名'].concat(subj);
      var example = ['示例学生'].concat(subj.map(function(k, i){ return String(60 + i * 5); }));
      downloadCSV(exam.name + '-成绩模板.csv', [headers, example]);
      TW.toast('成绩模板已下载（含表头与示例行，导入前可删除示例行）');
    };
    function num(v){ var n = Number(String(v == null ? '' : v).trim()); return isNaN(n) ? '' : String(n); }
    input.onchange = function(){
      var file = input.files && input.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) { preview.textContent = '文件超过 5MB，已拒绝导入。'; return; }
      var reader = new FileReader();
      reader.onload = function(){
        try {
          var rows = TW.editable.parseCSV(reader.result);
          if (!rows.length) throw new Error('文件没有有效数据');
          var expect = subj.length + 1;
          var first = rows[0].map(function(v){ return String(v).trim(); });
          var headerMatch = first[0] === '姓名' && subj.filter(function(k){ return first.indexOf(k) >= 0; }).length >= Math.max(1, Math.floor(subj.length / 2));
          if (headerMatch) rows.shift();
          if (!rows.length) throw new Error('文件只有表头，没有数据');
          var bad = rows.findIndex(function(row){ return row.length !== expect; });
          if (bad >= 0) throw new Error('第 ' + (bad + 1) + ' 行有 ' + rows[bad].length + ' 列，应为 ' + expect + ' 列（姓名 + ' + subj.length + ' 个学科）');
          parsed = rows.map(function(row){ var o = { name: String(row[0]).trim() }; subj.forEach(function(k, i){ o[k] = num(row[i + 1]); }); return o; });
          preview.innerHTML = '<strong>校验通过：' + parsed.length + ' 条、' + subj.length + ' 科</strong><div class="import-preview-grid">' + parsed.slice(0, 4).map(function(r){ return '<span>' + TW.escape(r.name) + '：' + subj.map(function(k){ return k + ' ' + (r[k] || '—'); }).join(' ｜ ') + '</span>'; }).join('') + '</div>';
          append.disabled = false; replace.disabled = false;
        } catch (error) { parsed = null; append.disabled = true; replace.disabled = true; preview.textContent = '校验失败：' + error.message; }
      };
      reader.onerror = function(){ preview.textContent = '文件读取失败，请重新选择。'; };
      reader.readAsText(file, 'utf-8');
    };
    function commit(mode){
      if (!parsed) return;
      var current = exam.scores || [];
      var next = current.slice();
      if (mode === 'replace') next = parsed.slice();
      else parsed.forEach(function(r){
        var hit = next.find(function(x){ return x.name === r.name; });
        if (hit) subj.forEach(function(k){ hit[k] = r[k]; });
        else next.push(r);
      });
      exam.scores = next;
      cw('exams', exams);
      TW.$('#modalRoot').innerHTML = '';
      renderShell();
      logRecord('成绩分析：导入成绩', exam.name + ' ' + parsed.length + ' 条（' + (mode === 'replace' ? '替换' : '合并') + '）');
      TW.toast('已' + (mode === 'replace' ? '替换' : '合并') + '导入 ' + parsed.length + ' 条成绩');
    }
    append.onclick = function(){ commit('append'); };
    replace.onclick = function(){ commit('replace'); };
  }
  function openHomeworkModal(date, idx){
    var isEdit = (idx != null) && TW.homework[idx];
    var h = isEdit ? TW.homework[idx] : { subject: TW.subjects[0] || '', date: date || new Date().toISOString().slice(0, 10), content: '', minutes: 30, difficulty: '中' };
    var subjOpts = TW.subjects.map(function(k){ return '<option value="' + TW.escape(k) + '"' + (h.subject === k ? ' selected' : '') + '>' + TW.escape(k) + '</option>'; }).join('');
    TW.modal((isEdit ? '编辑作业' : '布置作业') + ' · ' + h.date, '<div class="form-grid"><div class="field"><label class="required">学科</label><select id="hSubject">' + subjOpts + '</select></div><div class="field"><label class="required">日期</label><input id="hDate" type="date" value="' + TW.escape(h.date) + '"></div><div class="field"><label>时长(分钟)</label><input id="hMin" type="number" min="0" step="5" value="' + (h.minutes || '') + '"></div><div class="field"><label>难度</label><select id="hDiff"><option' + ((h.difficulty || '中') === '易' ? ' selected' : '') + '>易</option><option' + ((h.difficulty || '中') === '中' ? ' selected' : '') + '>中</option><option' + ((h.difficulty || '中') === '难' ? ' selected' : '') + '>难</option></select></div><div class="field full"><label>内容</label><input id="hContent" placeholder="如：背诵《师说》、完成练习册 P12-15" value="' + TW.escape(h.content || '') + '"></div></div>', '<button class="button secondary" data-close>取消</button>' + (isEdit ? '<button class="button danger" id="hDel">删除</button>' : '') + '<button class="button" id="hSave">保存</button>');
    function submit(){
      var s = TW.$('#hSubject').value, d = TW.$('#hDate').value;
      if (!s) { TW.toast('请填写学科', 'danger'); return; }
      if (!d) { TW.toast('请选择日期', 'danger'); return; }
      var obj = { subject: s, date: d, content: TW.$('#hContent').value.trim(), minutes: Math.max(0, Number(TW.$('#hMin').value) || 0), difficulty: TW.$('#hDiff').value };
      if (isEdit) TW.homework[idx] = obj; else TW.homework.push(obj);
      cw('homework', TW.homework); TW.$('#modalRoot').innerHTML = ''; renderShell();
      TW.toast(isEdit ? '作业已更新' : '已布置作业');
    }
    TW.$('#hSave').onclick = submit;
    if (isEdit) TW.$('#hDel').onclick = function(){ if (confirm('确认删除这条作业吗？')) { TW.homework.splice(idx, 1); cw('homework', TW.homework); TW.$('#modalRoot').innerHTML = ''; renderShell(); TW.toast('已删除'); } };
    ['hSubject','hDate','hMin','hDiff','hContent'].forEach(function(id){ var e2 = TW.$('#' + id); if (e2) e2.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); submit(); } }); });
  }
  function newHomework(){ openHomeworkModal(new Date().toISOString().slice(0, 10), null); }

  /* ============ 课时管理：录入/编辑/课表/上传 ============ */
  function lessonEditModal(cls, date){
    var l = cls && date ? lessonFind(cls, date) : null;
    var d0 = date || todayStr();
    var isFuture = d0 >= todayStr();
    var color = l && l.color ? l.color : '';
    var title = l ? ('课时 · ' + cls + ' · ' + date) : (isFuture ? '录入课时计划' : '录入课时');
    TW.modal(title, '<div class="form-grid"><div class="field"><label class="required">班级</label><input id="lsCls" list="lsClsList" value="' + TW.escape(cls || '') + '" placeholder="如：高一16班（可自定义）" autocomplete="off"><datalist id="lsClsList">' + TW.lessonClasses.map(function(c){ return '<option value="' + TW.escape(c) + '">'; }).join('') + '</datalist></div><div class="field"><label class="required">日期</label><input id="lsDate" type="date" value="' + TW.escape(d0) + '"></div><div class="field full"><label>' + (isFuture ? '上课计划' : '上课内容') + '</label><textarea id="lsContent" style="min-height:80px" placeholder="' + (isFuture ? '如：讲 1.1.1 从原始社会到奴隶社会' : '如：开学第一课：完成导学案填空') + '">' + TW.escape((l && (isFuture ? (l.plan || l.content) : (l.content || l.plan))) || '') + '</textarea></div><div class="field full"><label>应收作业</label><textarea id="lsHomework" style="min-height:64px" placeholder="如：完成01导学案填空（收）">' + TW.escape((l && l.homework) || '') + '</textarea></div><div class="field full"><label>颜色</label>' + macaronPickerHtml(color, 'lsColor') + '</div><div class="field full"><label>备注</label><input id="lsNote" value="' + TW.escape((l && l.note) || '') + '"></div></div>', '<button class="button secondary" data-close>取消</button>' + (l ? '<button class="button danger" id="lsDel">删除</button>' : '') + '<button class="button" id="lsSave">保存</button>');
    bindMacaronPicker('lsColor');
    setTimeout(function(){ var i = TW.$('#lsContent'); if (i) i.focus(); }, 50);
    TW.$('#lsSave').onclick = function(){
      var c = TW.$('#lsCls').value.trim(), d = TW.$('#lsDate').value;
      if (!c) { TW.toast('请填写班级', 'danger'); return; }
      if (!d) { TW.toast('请选择日期', 'danger'); return; }
      var rec = l;
      var isNew = false;
      if (!rec) {
        // 班级/日期改变或新建：确保唯一记录
        rec = lessonFind(c, d);
        if (!rec) { rec = { id: uid('ls'), cls: c, date: d, content: '', plan: '', homework: '', note: '', color: '' }; TW.lessons.push(rec); isNew = true; }
        else if (rec !== l && l) { TW.lessons = TW.lessons.filter(function(x){ return x !== l; }); }
      } else {
        rec.cls = c; rec.date = d;
      }
      var future = d > todayStr();
      var content = TW.$('#lsContent').value.trim();
      if (future) { rec.plan = content; rec.content = l && l.content ? l.content : rec.content || ''; }
      else { rec.content = content; }
      rec.homework = TW.$('#lsHomework').value.trim();
      rec.note = TW.$('#lsNote').value.trim();
      rec.color = selectedMacaron('lsColor');
      // 教学班列表同步（新班级自动加入）
      if (TW.lessonClasses.indexOf(c) < 0) { TW.lessonClasses.push(c); lessonClassesSave(); }
      lessonSave();
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('课时管理：' + (isNew ? '记录' : '更新') + '课时', c + ' ' + d);
      TW.toast('已保存 ' + c + ' ' + d);
    };
    if (l) TW.$('#lsDel').onclick = function(){
      TW.lessons = TW.lessons.filter(function(x){ return x !== l; });
      lessonSave();
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('课时管理：删除课时', cls + ' ' + date);
      TW.toast('已删除');
    };
  }
  /* 教学班管理：自定义增删改班级名（删除时级联清理课表与课时记录） */
  function lessonClassesManage(){
    var rows = TW.lessonClasses.map(function(c){
      return '<div class="task-row"><div><strong>' + TW.escape(c) + '</strong><div class="note">课时 ' + (TW.lessons || []).filter(function(l){ return l.cls === c; }).length + ' 条 · 课表 ' + ['odd','even'].reduce(function(n, k){ return n + Object.keys(TW.schedule[k] || {}).filter(function(key){ return TW.schedule[k][key] === c; }).length; }, 0) + ' 节</div></div><span><button class="button text" data-rename-cls="' + TW.escape(c) + '">改名</button><button class="button text danger-text" data-del-cls="' + TW.escape(c) + '">删除</button></span></div>';
    }).join('');
    TW.modal('教学班管理', '<div class="alert info">教学班仅记录班级名称（不含学生数据），用于课时管理与课表。可自由新增、改名、删除。</div>' + (rows || '<div class="alert info">暂无教学班</div>'), '<button class="button secondary" data-close>关闭</button><button class="button" id="addClsBtn">＋ 新增教学班</button>');
    TW.$('#addClsBtn').onclick = function(){
      var name = prompt('输入教学班名称（如：高一(3)班、政治3班）：');
      if (!name || !name.trim()) return;
      name = name.trim();
      if (TW.lessonClasses.indexOf(name) >= 0) { TW.toast('该教学班已存在', 'danger'); return; }
      TW.lessonClasses.push(name); lessonClassesSave();
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('课时管理：新增教学班', name);
      TW.toast('已新增教学班 ' + name);
    };
    TW.$$('[data-rename-cls]', TW.$('#modalRoot')).forEach(function(b){ b.onclick = function(){
      var old = b.dataset.renameCls;
      var name = prompt('修改教学班名称：', old);
      if (name == null) return;
      name = name.trim();
      if (!name) { TW.toast('名称不能为空', 'danger'); return; }
      if (name !== old && TW.lessonClasses.indexOf(name) >= 0) { TW.toast('该教学班已存在', 'danger'); return; }
      // 级联改名：课时记录 + 课表 + 班级列表
      (TW.lessons || []).forEach(function(l){ if (l.cls === old) l.cls = name; });
      ['odd', 'even'].forEach(function(k){
        Object.keys(TW.schedule[k] || {}).forEach(function(key){ if (TW.schedule[k][key] === old) TW.schedule[k][key] = name; });
      });
      var i = TW.lessonClasses.indexOf(old);
      if (i >= 0) TW.lessonClasses[i] = name;
      lessonSave(); scheduleSave(); lessonClassesSave();
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('课时管理：教学班改名', old + ' → ' + name);
      TW.toast('已改名为 ' + name);
    }; });
    TW.$$('[data-del-cls]', TW.$('#modalRoot')).forEach(function(b){ b.onclick = function(){
      var c = b.dataset.delCls;
      if (!confirm('确认删除教学班「' + c + '」？\n将同时删除该班全部课时记录与课表安排（可撤回）。')) return;
      TW.lessonClasses = TW.lessonClasses.filter(function(x){ return x !== c; });
      TW.lessons = (TW.lessons || []).filter(function(l){ return l.cls !== c; });
      ['odd', 'even'].forEach(function(k){
        Object.keys(TW.schedule[k] || {}).forEach(function(key){ if (TW.schedule[k][key] === c) delete TW.schedule[k][key]; });
      });
      lessonSave(); scheduleSave(); lessonClassesSave();
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('课时管理：删除教学班', c);
      TW.toast('已删除教学班 ' + c);
    }; });
  }

  function scheduleManage(){
    var isOdd = true;
    function gridHtml(){
      var rows = '';
      for (var p = 1; p <= LESSON_PERIODS; p++) {
        var cells = '<div class="sch-period">第' + p + '节</div>';
        for (var d = 0; d < 7; d++) {
          var key = LESSON_DAY_NAMES[d] + '-第' + p + '节';
          var week = isOdd ? TW.schedule.odd : TW.schedule.even;
          var val = week[key] || '';
          cells += '<div class="sch-cell" data-day="' + LESSON_DAY_NAMES[d] + '" data-period="' + p + '" data-action="schedule-edit-cell" role="button" tabindex="0">' + (val ? '<span class="sch-cls">' + TW.escape(val) + '</span>' : '<span class="sch-empty">＋</span>') + '</div>';
        }
        rows += cells;
      }
      var head = '<div class="sch-period sch-head">节次</div>' + LESSON_DAY_NAMES.map(function(d){ return '<div class="sch-head">' + d + '</div>'; }).join('');
      return '<div class="schedule-grid">' + head + rows + '</div>';
    }
    TW.modal('课表管理（单双周）', '<div class="alert info">单周 / 双周可分开排课（支持调课自定义）；点击格子选择或清空班级。学期起始：<input id="schStart" type="date" value="' + semesterStartDate() + '" style="margin-left:6px"> <button class="button secondary small" id="schStartSave">设置学期起始</button></div><div class="toolbar" style="margin:10px 0;flex-wrap:wrap;gap:8px"><button class="button ' + (isOdd ? '' : 'secondary') + '" id="schTabOdd">单周</button><button class="button ' + (isOdd ? 'secondary' : '') + '" id="schTabEven">双周</button><button class="button secondary" id="schCopyOddEven">将单周复制到双周</button><button class="button secondary" id="schCopyEvenOdd">将双周复制到单周</button><button class="button secondary" id="schClear">清空当前周</button><button class="button secondary" id="schAddCls">＋ 教学班</button></div><div id="schGrid">' + gridHtml() + '</div>', '<button class="button secondary" data-close>关闭</button>');
    var modalEl = TW.$('#modalRoot .modal'); if (modalEl) modalEl.style.width = 'min(860px,94vw)';
    function rerender(){ TW.$('#schGrid').innerHTML = gridHtml(); }
    TW.$('#schTabOdd').onclick = function(){ isOdd = true; TW.$('#schTabOdd').className = 'button'; TW.$('#schTabEven').className = 'button secondary'; rerender(); };
    TW.$('#schTabEven').onclick = function(){ isOdd = false; TW.$('#schTabEven').className = 'button'; TW.$('#schTabOdd').className = 'button secondary'; rerender(); };
    TW.$('#schCopyOddEven').onclick = function(){ TW.schedule.even = JSON.parse(JSON.stringify(TW.schedule.odd)); scheduleSave(); rerender(); TW.toast('已把单周课表复制到双周'); };
    TW.$('#schCopyEvenOdd').onclick = function(){ TW.schedule.odd = JSON.parse(JSON.stringify(TW.schedule.even)); scheduleSave(); rerender(); TW.toast('已把双周课表复制到单周'); };
    TW.$('#schClear').onclick = function(){ if (!confirm('确认清空' + (isOdd ? '单周' : '双周') + '课表？')) return; if (isOdd) TW.schedule.odd = {}; else TW.schedule.even = {}; scheduleSave(); rerender(); TW.toast('已清空'); };
    TW.$('#schStartSave').onclick = function(){ var v = TW.$('#schStart').value; if (v) { TW.store.write('semester_start', v); TW.toast('学期起始已设为 ' + v + '（单双周判定随之更新）'); } };
    TW.$('#schAddCls').onclick = function(){
      var name = prompt('输入教学班名称（如：高一30班）');
      if (!name || !name.trim()) return;
      name = name.trim();
      if (TW.lessonClasses.indexOf(name) < 0) { TW.lessonClasses.push(name); lessonClassesSave(); }
      TW.toast('已添加教学班 ' + name);
    };
    // 点击格子：选择班级
    TW.$('#modalRoot').addEventListener('click', function(e){
      var cell = e.target && e.target.closest ? e.target.closest('[data-action="schedule-edit-cell"]') : null;
      if (!cell || !TW.$('#schGrid') || !TW.$('#schGrid').contains(cell)) return;
      var key = cell.dataset.day + '-第' + cell.dataset.period + '节';
      var week = isOdd ? TW.schedule.odd : TW.schedule.even;
      var opts = ['（清空）'].concat(TW.lessonClasses).map(function(c){ return '<button class="button ' + ((week[key] === c) || (c === '（清空）' && !week[key]) ? '' : 'secondary') + ' sch-option" data-cls="' + TW.escape(c) + '">' + TW.escape(c) + '</button>'; }).join('');
      TW.modal('排课 · ' + cell.dataset.day + ' 第' + cell.dataset.period + '节（' + (isOdd ? '单周' : '双周') + '）', '<div class="sch-options">' + opts + '</div><div class="note" style="margin-top:8px">也可输入新班级名直接排课</div><div class="toolbar" style="margin-top:8px"><input id="schNewCls" placeholder="新班级名称" style="flex:1"><button class="button" id="schNewSave">排到新班级</button></div>', '<button class="button secondary" data-close>关闭</button>');
      TW.$$('.sch-option').forEach(function(b){ b.onclick = function(){
        var c = b.dataset.cls;
        if (c === '（清空）') delete week[key]; else week[key] = c;
        scheduleSave(); TW.$('#modalRoot').innerHTML = ''; rerender();
      }; });
      TW.$('#schNewSave').onclick = function(){
        var c = TW.$('#schNewCls').value.trim();
        if (!c) { TW.toast('请输入班级名称', 'danger'); return; }
        week[key] = c;
        if (TW.lessonClasses.indexOf(c) < 0) { TW.lessonClasses.push(c); lessonClassesSave(); }
        scheduleSave(); TW.$('#modalRoot').innerHTML = ''; rerender();
      };
    });
  }
  function scheduleUpload(){
    TW.modal('上传课表', '<div class="import-dialog"><div class="alert info">CSV 格式：表头「星期,节次,单周班级,双周班级」；双周列留空则与单周相同。星期=周一~周日，节次=第1节~第8节。</div><div class="toolbar" style="margin:10px 0"><button class="button secondary" id="schTplBtn">⬇ 下载课表模板</button></div><div class="field"><label class="required">选择课表 CSV</label><input id="schFile" type="file" accept=".csv,text/csv"></div><div id="schPreview" class="import-preview note">尚未选择文件</div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="schApply" disabled>确认导入</button>');
    TW.$('#schTplBtn').onclick = function(){
      downloadCSV('课表模板.csv', [['星期','节次','单周班级','双周班级'], ['周一','第1节','高一16班','高一24班'], ['周一','第2节','高一25班',''], ['周二','第1节','高一26班','高一27班']]);
      TW.toast('课表模板已下载');
    };
    var parsedRows = null;
    TW.$('#schFile').onchange = function(){
      var file = this.files && this.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function(){
        try {
          var rows = (window.TW && TW.editable && TW.editable.parseCSV) ? TW.editable.parseCSV(reader.result) : [];
          if (!rows.length) throw new Error('文件没有有效数据');
          var first = rows[0].map(function(v){ return String(v).trim(); });
          if (first[0] === '星期') rows.shift();
          parsedRows = rows.map(function(r){
            return { day: String(r[0] || '').trim(), period: String(r[1] || '').trim(), odd: String(r[2] || '').trim(), even: String(r[3] || '').trim() || String(r[2] || '').trim() };
          }).filter(function(r){ return r.day && r.period; });
          if (!parsedRows.length) throw new Error('没有有效行');
          TW.$('#schPreview').innerHTML = '<strong>校验通过：' + parsedRows.length + ' 条</strong><div class="import-preview-grid">' + parsedRows.slice(0, 6).map(function(r){ return '<span>' + TW.escape(r.day + ' ' + r.period + '：单周「' + r.odd + '」双周「' + r.even + '」') + '</span>'; }).join('') + '</div>';
          TW.$('#schApply').disabled = false;
        } catch (e) { parsedRows = null; TW.$('#schApply').disabled = true; TW.$('#schPreview').textContent = '校验失败：' + e.message; }
      };
      reader.readAsText(file, 'utf-8');
    };
    TW.$('#schApply').onclick = function(){
      if (!parsedRows) return;
      parsedRows.forEach(function(r){
        var key = r.day + '-' + r.period;
        if (r.odd) TW.schedule.odd[key] = r.odd;
        if (r.even) TW.schedule.even[key] = r.even;
        [r.odd, r.even].forEach(function(c){ if (c && TW.lessonClasses.indexOf(c) < 0) TW.lessonClasses.push(c); });
      });
      scheduleSave(); lessonClassesSave();
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('课时管理：导入课表', parsedRows.length + ' 条');
      TW.toast('已导入课表 ' + parsedRows.length + ' 条');
    };
  }
  function lessonUpload(){
    var m = TW.modal('上传课时模板', '<div class="import-dialog"><div class="alert info">支持 <strong>xlsx / csv</strong>：① 课时模板表头「班级,日期,上课内容,上课计划,应收作业,备注」；② 原「高一各班记录跟踪」xlsx（周次表头布局，自动按周拆分为逐日课时）。</div><div class="toolbar" style="margin:10px 0"><button class="button secondary" id="lsTplBtn">⬇ 下载课时模板</button></div><div class="field"><label class="required">选择模板文件</label><input id="lsFile" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div><div id="lsPreview" class="import-preview note">尚未选择文件</div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="lsApply" disabled>确认导入</button>');
    var modalEl = m.root.querySelector('.modal'); if (modalEl) modalEl.classList.add('import-modal');
    TW.$('#lsTplBtn').onclick = function(){
      downloadCSV('课时管理模板.csv', [['班级','日期','上课内容','上课计划','应收作业','备注'], ['高一16班','2026-09-03','开学第一课：完成导学案填空','','完成01导学案填空（收）',''], ['高一16班','2026-09-08','','1.1.1从原始社会到奴隶社会','预习5分钟','']]);
      TW.toast('课时模板已下载');
    };
    var parsed = null;
    TW.$('#lsFile').onchange = function(){
      var file = this.files && this.files[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) { TW.$('#lsPreview').textContent = '文件超过 10MB，已拒绝。'; return; }
      var isXlsx = /\.xlsx$/i.test(file.name);
      var reader = new FileReader();
      reader.onload = function(){
        try {
          var payload;
          if (isXlsx) {
            var bytes = new Uint8Array(reader.result);
            var binary = ''; var CHUNK = 0x8000;
            for (var i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
            payload = { name: file.name, base64: btoa(binary) };
          } else {
            payload = { name: file.name, text: reader.result };
          }
          fetch('/api/parse-weekly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function(resp){ return resp.json().then(function(j){ return { status: resp.status, json: j }; }); })
            .then(function(r){
              if (r.status !== 200 || !r.json.ok) { parsed = null; TW.$('#lsApply').disabled = true; TW.$('#lsPreview').textContent = '解析失败：' + (r.json && r.json.error || '未知错误'); return; }
              parsed = r.json.rows;
              TW.$('#lsPreview').innerHTML = '<strong>校验通过：' + parsed.length + ' 条</strong><div class="import-preview-grid">' + parsed.slice(0, 5).map(function(x){ return '<span>' + TW.escape(x.cls + ' · ' + (x.week || '') + '：' + Object.keys(x.days || {}).filter(function(d){ return x.days[d]; }).length + ' 天有内容') + '</span>'; }).join('') + '</div>';
              TW.$('#lsApply').disabled = false;
            })
            .catch(function(err){ parsed = null; TW.$('#lsApply').disabled = true; TW.$('#lsPreview').textContent = '请求失败：' + (err && err.message || err); });
        } catch (error) { parsed = null; TW.$('#lsApply').disabled = true; TW.$('#lsPreview').textContent = '读取失败：' + error.message; }
      };
      reader.onerror = function(){ TW.$('#lsPreview').textContent = '文件读取失败，请重新选择。'; };
      if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file, 'utf-8');
    };
    TW.$('#lsApply').onclick = function(){
      if (!parsed || !parsed.length) return;
      var added = 0, updated = 0;
      parsed.forEach(function(x){
        // 将周次+days 拆为逐日课时：第X周 → 学期起始推算日期
        var weekNum = Number(String(x.week || '').replace(/[^\d]/g, '')) || 1;
        var start = semesterStartDate();
        var base = new Date(start + 'T00:00:00');
        base.setDate(base.getDate() + (weekNum - 1) * 7);
        var dayMap = { 周一: 0, 周二: 1, 周三: 2, 周四: 3, 周五: 4, 周六: 5, 周日: 6 };
        Object.keys(x.days || {}).forEach(function(d){
          var v = x.days[d];
          if (!v) return;
          var offset = dayMap[d];
          if (offset == null) return;
          var dt = new Date(base); dt.setDate(base.getDate() + offset);
          var ds = dateStr(dt);
          var rec = lessonFind(x.cls, ds);
          if (rec) { if (!rec.homework) rec.homework = v; updated++; }
          else { TW.lessons.push({ id: uid('ls'), cls: x.cls, date: ds, content: '', plan: '', homework: v, note: '', color: '' }); added++; }
          if (TW.lessonClasses.indexOf(x.cls) < 0) TW.lessonClasses.push(x.cls);
        });
      });
      lessonSave(); lessonClassesSave();
      TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('课时管理：导入课时模板', '新增 ' + added + ' 条、更新 ' + updated + ' 条');
      TW.toast('导入完成：新增 ' + added + ' 条、更新 ' + updated + ' 条');
    };
  }

  function newMeeting(){
    TW.modal('记录班会', '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="mDate" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field"><label class="required">主题</label><input id="mTopic"></div><div class="field full"><label>内容</label><textarea id="mContent" placeholder="班会讲了什么"></textarea></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="mSave">保存</button>');
    TW.$('#mSave').onclick = function(){ var t = TW.$('#mTopic').value.trim(); if (!t) { TW.toast('请填写主题', 'danger'); return; } TW.meetings.push({ date: TW.$('#mDate').value, topic: t, content: TW.$('#mContent').value.trim(), status: '已归档' }); cw('meetings', TW.meetings); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('班会与德育：记录班会', t); TW.toast('已记录班会'); };
  }
  function newMeetingPlan(){
    TW.modal('新增班会计划', '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="mpDate" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field"><label class="required">主题</label><input id="mpTopic"></div><div class="field full"><label>目标</label><input id="mpGoal" placeholder="这次班会要达到什么目的"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="mpSave">保存</button>');
    TW.$('#mpSave').onclick = function(){ var t = TW.$('#mpTopic').value.trim(); if (!t) { TW.toast('请填写主题', 'danger'); return; } TW.meetingPlan.push({ date: TW.$('#mpDate').value, topic: t, goal: TW.$('#mpGoal').value.trim() }); cw('meeting_plan', TW.meetingPlan); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('班会与德育：新增计划', t); TW.toast('已新增计划'); };
  }
  function newFamily(){
    TW.modal('记录沟通', '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="fDate" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field"><label>方式</label><select id="fType"><option>家访</option><option>电话</option><option>微信</option><option>面谈</option></select></div><div class="field"><label class="required">对象</label><input id="fTarget" placeholder="学生家长 / 学生"></div><div class="field full"><label>沟通内容（说过什么）</label><textarea id="fContent"></textarea></div><div class="field full"><label>家长反馈</label><textarea id="fFeedback"></textarea></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="fSave">保存</button>');
    TW.$('#fSave').onclick = function(){ var t = TW.$('#fTarget').value.trim(); if (!t) { TW.toast('请填写对象', 'danger'); return; } TW.family.push({ date: TW.$('#fDate').value, type: TW.$('#fType').value, target: t, content: TW.$('#fContent').value.trim(), feedback: TW.$('#fFeedback').value.trim(), status: '已完成' }); cw('family', TW.family); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('家校沟通：记录沟通', t); TW.toast('已记录沟通'); };
  }
  function newParentMeeting(){
    TW.modal('记录家长会', '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="pmDate" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field"><label class="required">主题</label><input id="pmTopic"></div><div class="field"><label>出勤</label><input id="pmAtt" placeholder="如 41/48"></div><div class="field full"><label>内容</label><textarea id="pmContent"></textarea></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="pmSave">保存</button>');
    TW.$('#pmSave').onclick = function(){ var t = TW.$('#pmTopic').value.trim(); if (!t) { TW.toast('请填写主题', 'danger'); return; } TW.parentMeetings.push({ date: TW.$('#pmDate').value, topic: t, attendance: TW.$('#pmAtt').value.trim() || '—', content: TW.$('#pmContent').value.trim(), status: '已完成' }); cw('parent_meetings', TW.parentMeetings); TW.$('#modalRoot').innerHTML = ''; renderShell(); TW.toast('已记录家长会'); };
  }
  function newFamilyPlan(){
    TW.modal('新增沟通计划', '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="fpDate" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field"><label class="required">对象</label><input id="fpTarget"></div><div class="field full"><label>原因</label><input id="fpReason"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="fpSave">保存</button>');
    TW.$('#fpSave').onclick = function(){ var t = TW.$('#fpTarget').value.trim(); if (!t) { TW.toast('请填写对象', 'danger'); return; } TW.familyPlan.push({ date: TW.$('#fpDate').value, target: t, reason: TW.$('#fpReason').value.trim() }); cw('family_plan', TW.familyPlan); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('班会与德育：新增计划', t); TW.toast('已新增计划'); };
  }
  function dormFormModal(idx){
    var isEdit = (idx != null) && TW.dorm[idx];
    var d = isEdit ? TW.dorm[idx] : { room: '', leader: '', members: '', note: '', score: '' };
    TW.modal((isEdit ? '宿舍详情 · ' + d.room : '新增宿舍'), '<div class="form-grid"><div class="field"><label class="required">宿舍号</label><input id="dRoom" value="' + TW.escape(d.room || '') + '" placeholder="如 A403"></div><div class="field"><label>舍长</label><input id="dLeader" value="' + TW.escape(d.leader || '') + '"></div><div class="field"><label>当前宿舍分数</label><input id="dScore" type="number" min="0" step="1" value="' + TW.escape(d.score != null ? String(d.score) : '') + '" placeholder="如 95"></div><div class="field full"><label>成员名单</label><input id="dMembers" value="' + TW.escape(d.members || '') + '" placeholder="如 张三、李四、王五"></div><div class="field full"><label>备注</label><input id="dNote" value="' + TW.escape(d.note || '') + '" placeholder="如 就寝纪律、卫生情况"></div></div>', '<button class="button secondary" data-close>取消</button>' + (isEdit ? '<button class="button danger" id="dDel">删除宿舍</button>' : '') + '<button class="button" id="dSave">保存</button>');
    TW.$('#dSave').onclick = function(){
      var r = TW.$('#dRoom').value.trim();
      if (!r) { TW.toast('请填写宿舍号', 'danger'); return; }
      var obj = { room: r, leader: TW.$('#dLeader').value.trim(), members: TW.$('#dMembers').value.trim(), note: TW.$('#dNote').value.trim(), score: TW.$('#dScore').value.trim() };
      if (isEdit) TW.dorm[idx] = obj; else TW.dorm.push(obj);
      cw('dorm', TW.dorm); TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('宿舍管理：' + (isEdit ? '编辑' : '新增') + '宿舍', r); TW.toast(isEdit ? '宿舍信息已更新' : '已新增宿舍');
    };
    if (isEdit) TW.$('#dDel').onclick = function(){ if (confirm('确认删除宿舍 ' + d.room + ' 吗？')) { TW.dorm.splice(idx, 1); cw('dorm', TW.dorm); TW.$('#modalRoot').innerHTML = ''; renderShell(); TW.toast('已删除宿舍'); } };
  }
  function newDorm(){ dormFormModal(null); }
  function editDorm(idx){ dormFormModal(idx); }
  function newDormVisit(){
    TW.modal('探访记录', '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="dvDate" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field"><label class="required">宿舍</label><input id="dvRoom" placeholder="如 A401"></div><div class="field full"><label>备注</label><textarea id="dvNote" placeholder="探访情况、发现的问题"></textarea></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="dvSave">保存</button>');
    TW.$('#dvSave').onclick = function(){ var r = TW.$('#dvRoom').value.trim(); if (!r) { TW.toast('请填写宿舍', 'danger'); return; } TW.dormVisits.push({ date: TW.$('#dvDate').value, room: r, note: TW.$('#dvNote').value.trim() }); cw('dorm_visits', TW.dormVisits); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('宿舍管理：记录探访', r); TW.toast('已记录探访'); };
  }
  function viewTalks(name){
    var s = (TW.students || []).find(function(x){ return x.name === name; });
    var talks = talksOf(name);
    var rowsHtml = talks.length
      ? '<div class="data-table-wrap"><table class="data-table no-edit-table"><thead><tr><th>时间</th><th>类型</th><th>内容</th><th>录音</th><th>操作</th></tr></thead><tbody>' + talks.map(function(t, i){ return '<tr><td class="mono">' + TW.escape(t.time || '—') + '</td><td><span class="status-badge info">' + TW.escape(t.type || '其他') + '</span></td><td>' + TW.escape(t.content || '') + (t.note ? '<div class="note">' + TW.escape(t.note) + '</div>' : '') + '</td><td>' + (t.audioId ? '<a href="/api/attachments/' + t.audioId + '" download class="button text">播放/下载</a>' : '—') + '</td><td><button class="button text danger-text" data-talk-del="' + i + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="alert info">暂无谈话记录，点击下方「+ 新增谈话」录入。</div>';
    var dlg = TW.modal('谈话记录 · ' + name, '<div class="note" style="margin-bottom:8px">' + (s && s.id ? '学籍号 ' + TW.escape(s.id) + ' · ' : '') + '共 ' + talks.length + ' 条 · 类型含成绩/个人/宿舍/其他</div>' + rowsHtml, '<button class="button secondary" data-close>关闭</button><button class="button" id="addTalkBtn">+ 新增谈话</button>');
    var me = dlg && dlg.root && dlg.root.querySelector('.modal'); if (me) me.classList.add('wide-modal');
    TW.$$('[data-talk-del]', TW.$('#modalRoot')).forEach(function(b){ b.onclick = function(){ var idx = Number(b.dataset.talkDel); var t = talks[idx]; if (!t) return; if (confirm('确认删除该条谈话记录吗？')) { TW.talks = TW.talks.filter(function(x){ return x !== t; }); cw('talks', TW.talks); TW.$('#modalRoot').innerHTML = ''; renderShell(); TW.toast('已删除谈话记录'); } }; });
    TW.$('#addTalkBtn').onclick = function(){ TW.$('#modalRoot').innerHTML = ''; addTalk(name); };
  }
  function addTalk(name){
    var dlg = TW.modal('新增谈话 · ' + name, '<div class="form-grid"><div class="field"><label class="required">时间</label><input id="tkTime" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div><div class="field"><label class="required">类型</label><select id="tkType"><option>成绩谈话</option><option>个人谈话</option><option>宿舍谈话</option><option>其他</option></select></div><div class="field full"><label>谈话内容</label><textarea id="tkContent" style="min-height:120px"></textarea></div><div class="field full"><label>备注（如学生反应）</label><textarea id="tkNote" style="min-height:90px"></textarea></div><div class="field full"><label>录音文件（可选，支持 mp3/wav/m4a）</label><input id="tkAudio" type="file" accept="audio/*"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="tkSave">保存谈话</button>');
    var me = dlg && dlg.root && dlg.root.querySelector('.modal'); if (me) me.classList.add('wide-modal');
    TW.$('#tkSave').onclick = function(){
      var content = TW.$('#tkContent').value.trim();
      if (!content) { TW.toast('请填写谈话内容', 'danger'); return; }
      var s = (TW.students || []).find(function(x){ return x.name === name; });
      var rec = { name: name, sid: s ? s.sid : sidOfName(name), type: TW.$('#tkType').value, time: TW.$('#tkTime').value, content: content, note: TW.$('#tkNote').value.trim(), audioId: '' };
      var fileInput = TW.$('#tkAudio');
      function doSave(){ TW.talks.push(rec); cw('talks', TW.talks); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('学生档案：新增谈话', name + ' ' + rec.type); TW.toast('已保存谈话记录'); }
      if (fileInput && fileInput.files && fileInput.files[0]) {
        var file = fileInput.files[0];
        if (file.size > 70 * 1024 * 1024) { rec.audioId = ''; doSave(); TW.toast('录音文件超过 70MB，已跳过上传', 'danger'); return; }
        TW.files.put(file, { kind: 'talk', student: name }).then(function(info){ rec.audioId = info.id; doSave(); }).catch(function(){ rec.audioId = ''; doSave(); TW.toast('录音上传失败，文字已保存', 'danger'); });
      } else { doSave(); }
    };
  }
  function newQuality(){
    TW.modal('新增评价', '<div class="form-grid"><div class="field"><label class="required">学生</label><select id="qName">' + TW.students.map(function(s){ return '<option value="' + TW.escape(s.sid) + '">' + TW.escape(s.name) + '</option>'; }).join('') + '</select></div>' + ['道德','学业','健康','艺术','劳动'].map(function(k){ return '<div class="field"><label>' + k + '</label><select id="q' + k + '"><option>优</option><option>良</option><option>中</option></select></div>'; }).join('') + '<div class="field full"><label>学期评语</label><textarea id="qComment"></textarea></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="qSave">保存</button>');
    TW.$('#qSave').onclick = function(){ var sid = TW.$('#qName').value, st = studentBySid(sid); var q = { sid: sid, name: st ? st.name : TW.$('#qName').value, comment: TW.$('#qComment').value.trim() }; ['道德','学业','健康','艺术','劳动'].forEach(function(k){ q[({道德:'moral',学业:'academic',健康:'health',艺术:'art',劳动:'labor'})[k]] = TW.$('#q' + k).value; }); TW.quality.push(q); cw('quality', TW.quality); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('综合素质：新增评价', q.name); TW.toast('已新增评价'); };
  }
  function newSelection(){
    TW.modal('录入选科意向', '<div class="form-grid"><div class="field"><label class="required">学生</label><select id="seName">' + TW.students.map(function(s){ return '<option value="' + TW.escape(s.sid) + '">' + TW.escape(s.name) + '</option>'; }).join('') + '</select></div><div class="field"><label class="required">首选</label><select id="seFirst"><option>物理</option><option>历史</option></select></div><div class="field full"><label>再选组合</label><input id="seCombo" placeholder="如 物理+化学+生物"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="seSave">保存</button>');
    TW.$('#seSave').onclick = function(){ var first = TW.$('#seFirst').value, combo = TW.$('#seCombo').value.trim(); if (!combo) { TW.toast('请填写再选组合', 'danger'); return; } var sid = TW.$('#seName').value, st = studentBySid(sid); var sel = TW.selection; sel.first[first === '物理' ? 'physics' : 'history'] = (sel.first[first === '物理' ? 'physics' : 'history'] || 0) + 1; sel.combos[combo] = (sel.combos[combo] || 0) + 1; sel.intents = sel.intents || []; sel.intents.push({ sid: sid, name: st ? st.name : TW.$('#seName').value, first: first, combos: combo }); cw('selection', sel); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('选科意向：录入意向', (st ? st.name : '') + ' ' + first + '+' + combo); TW.toast('已录入意向'); };
  }
  function newAffair(){
    TW.modal('新增班级事务', '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="afDate" type="date" value="' + (state.calYear + '-' + String(state.calMonth + 1).padStart(2,'0') + '-01') + '"></div><div class="field"><label class="required">标题</label><input id="afTitle"></div><div class="field"><label>类型</label><select id="afKind"><option>德育</option><option>家校</option><option>活动</option><option>教学</option><option>考试</option></select></div><div class="field full"><label>颜色</label>' + macaronPickerHtml('', 'afColor') + '</div><div class="field full"><label>备注</label><input id="afNote"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="afSave">保存</button>');
    bindMacaronPicker('afColor');
    TW.$('#afSave').onclick = function(){ var t = TW.$('#afTitle').value.trim(); if (!t) { TW.toast('请填写标题', 'danger'); return; } TW.affairs.push({ date: TW.$('#afDate').value, title: t, kind: TW.$('#afKind').value, note: TW.$('#afNote').value.trim(), color: selectedMacaron('afColor') }); cw('affairs', TW.affairs); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('班级事务：新增事务', t); TW.toast('已新增事务'); };
  }
  /* 点击日历日期格：查看当日事务 + 快速录入该日工作（日期锁定）
   * 布局：快速录入（新增）在上，当日已有事务在下，操作按钮紧随表单（上方） */
  function quickAddAffair(date){
    var list = (TW.affairs || []).filter(function(x){ return x.date === date; });
    var listHtml = list.length
      ? '<ul class="mini-list affair-mini-list" style="max-height:30vh;overflow:auto">' + list.map(function(x, i){
          var m = x.color ? macaronById(x.color) : null;
          return '<li class="affair-item" data-affair-idx="' + i + '" data-affair-date="' + TW.escape(date) + '"' + (m ? ' style="--affair-bg:' + m.bg + ';--affair-fg:' + m.fg + '"' : '') + '><span class="affair-dot" ' + (m ? 'style="background:' + m.bg + ';border-color:' + m.fg + '"' : '') + '></span><span class="affair-main"><strong>' + TW.escape(x.title) + '</strong><span class="status-badge info">' + TW.escape(x.kind || '') + '</span>' + (x.note ? '<div class="note">' + TW.escape(x.note) + '</div>' : '') + '</span><span class="affair-ops"><button class="button text" data-action="edit-affair" data-affair-date="' + TW.escape(date) + '" data-affair-idx="' + i + '">编辑</button><button class="button text danger-text" data-action="delete-affair" data-affair-date="' + TW.escape(date) + '" data-affair-idx="' + i + '">删除</button></span></li>';
        }).join('') + '</ul>'
      : '<div class="alert info">当日暂无事务，可直接录入</div>';
    TW.modal(date + ' 班级事务',
      '<div class="section-title" style="margin-bottom:10px">快速录入</div>'
      + '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="afDate" type="date" value="' + date + '" disabled style="background:var(--table-head)"></div><div class="field"><label class="required">标题</label><input id="afTitle" placeholder="如：主题班会、家长会、考试"></div><div class="field"><label>类型</label><select id="afKind"><option>德育</option><option>家校</option><option>活动</option><option>教学</option><option>考试</option></select></div><div class="field full"><label>颜色</label>' + macaronPickerHtml('', 'afColor') + '</div><div class="field full"><label>备注</label><input id="afNote" placeholder="补充说明（可选）"></div></div>'
      + '<div class="toolbar" style="margin:12px 0 4px;justify-content:flex-end"><button class="button" id="afSave">保存到该日</button><button class="button secondary" data-close>关闭</button></div>'
      + '<div class="section-title" style="margin:16px 0 10px">当日事务 <small>点击「编辑」可修改标题、类型、备注与颜色</small></div>'
      + listHtml,
      ' ');
    // 按钮已置于表单下方（弹窗上部），隐藏底部空操作条
    var _afModal = TW.$('#modalRoot .modal-foot');
    if (_afModal) _afModal.style.display = 'none';
    setTimeout(function(){ var i = TW.$('#afTitle'); if (i) i.focus(); }, 50);
    bindMacaronPicker('afColor');
    TW.$('#afSave').onclick = function(){ var t = TW.$('#afTitle').value.trim(); if (!t) { TW.toast('请填写标题', 'danger'); return; } TW.affairs.push({ date: date, title: t, kind: TW.$('#afKind').value, note: TW.$('#afNote').value.trim(), color: selectedMacaron('afColor') }); cw('affairs', TW.affairs); TW.$('#modalRoot').innerHTML = ''; renderShell(); logRecord('班级事务：新增事务', date + ' ' + t); TW.toast('已添加到 ' + date); };
  }
  /* 编辑当日事务（标题/类型/备注/颜色全自定义） */
  function editAffair(date, idx){
    var all = TW.affairs || [];
    var i = all.findIndex(function(x){ return x.date === date; });
    var row = i >= 0 && idx != null ? all.filter(function(x){ return x.date === date; })[idx] : null;
    if (!row) { TW.toast('记录不存在', 'danger'); return; }
    var absIdx = all.indexOf(row);
    TW.modal('编辑事务 · ' + row.title, '<div class="form-grid"><div class="field"><label class="required">日期</label><input id="afDate" type="date" value="' + TW.escape(row.date) + '"></div><div class="field"><label class="required">标题</label><input id="afTitle" value="' + TW.escape(row.title) + '"></div><div class="field"><label>类型</label><select id="afKind">' + ['德育','家校','活动','教学','考试'].map(function(k){ return '<option' + (row.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div><div class="field full"><label>颜色</label>' + macaronPickerHtml(row.color || '', 'afColor') + '</div><div class="field full"><label>备注</label><input id="afNote" value="' + TW.escape(row.note || '') + '"></div></div>', '<button class="button secondary" data-close>取消</button><button class="button" id="afSave">保存修改</button>');
    bindMacaronPicker('afColor');
    TW.$('#afSave').onclick = function(){
      var t = TW.$('#afTitle').value.trim();
      if (!t) { TW.toast('请填写标题', 'danger'); return; }
      row.date = TW.$('#afDate').value;
      row.title = t;
      row.kind = TW.$('#afKind').value;
      row.note = TW.$('#afNote').value.trim();
      row.color = selectedMacaron('afColor');
      cw('affairs', TW.affairs); TW.$('#modalRoot').innerHTML = ''; renderShell();
      logRecord('班级事务：编辑事务', row.title);
      TW.toast('已保存修改');
    };
  }
  function deleteAffair(date, idx){
    var i = TW.affairs.findIndex(function(x){ return x.date === date; });
    if (i < 0) return;
    var rows = TW.affairs.filter(function(x){ return x.date === date; });
    var row = rows[idx];
    if (!row) return;
    // 每日事务删除不做二次确认（点击即删，可撤回）
    TW.affairs.splice(TW.affairs.indexOf(row), 1);
    cw('affairs', TW.affairs); TW.$('#modalRoot').innerHTML = ''; renderShell();
    logRecord('班级事务：删除事务', row.title);
    TW.toast('已删除');
  }

  /* ================= 数据管理 ================= */
  function renderDataManager(root){
    var backup = TW.store.exportData(), count = Object.keys(backup.records).length;
    root.innerHTML = '<div class="section-title">本机数据</div><div class="grid-3"><div class="stat-card"><div class="stat-label">本机数据集</div><div class="stat-value">' + count + '</div><div class="stat-sub">版本 ' + backup.schemaVersion + '</div></div><div class="stat-card"><div class="stat-label">个人记录</div><div class="stat-value">' + TW.userRecords.length + '</div><div class="stat-sub">刷新后保留</div></div><div class="stat-card"><div class="stat-label">本机附件</div><div id="attachmentCount" class="stat-value">…</div><div class="stat-sub">本地磁盘</div></div></div><div class="alert info" style="margin-top:14px"><strong>单机离线边界：</strong>数据以 JSON 文件保存在本机磁盘（data 目录），无账号、无云同步、无加密。建议定期导出完整 JSON 备份。</div><div class="toolbar" style="margin-top:14px"><button class="button" id="exportLocalBackup">导出完整备份</button><button class="button secondary" id="importLocalBackup">导入并合并</button><button class="button secondary" id="replaceLocalBackup">导入并覆盖</button><button class="button danger" id="clearLocalData">清空本机数据</button><input id="backupFileInput" type="file" accept="application/json,.json" hidden></div><div id="backupFeedback" class="note" aria-live="polite"></div><section class="section" style="margin-top:14px"><div class="section-title">附件管理 <small>可下载或删除本机附件</small></div><div id="attachmentManager" class="section-body"><div class="note">正在读取附件…</div></div></section>';
    function renderAttachments(){
      TW.files.list().then(function(files){
        TW.$('#attachmentCount').textContent = files.length;
        var manager = TW.$('#attachmentManager');
        manager.innerHTML = files.length ? '<div class="data-table-wrap"><table class="data-table"><thead><tr><th>文件名</th><th>大小</th><th>保存时间</th><th>操作</th></tr></thead><tbody>' + files.map(function(file){ return '<tr><td>' + TW.escape(file.name) + '</td><td>' + Math.max(1, Math.round(file.size / 1024)) + ' KB</td><td>' + TW.escape(file.savedAt || '—') + '</td><td><button class="button text" data-file-download="' + file.id + '">下载</button><button class="button text danger-text" data-file-delete="' + file.id + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty-state">尚未保存附件</div>';
        TW.$$('[data-file-download]', manager).forEach(function(button){ button.onclick = function(){ var file = files.find(function(x){ return x.id === button.dataset.fileDownload; }); if (!file) return; var a = document.createElement('a'); a.href = '/api/attachments/' + file.id; a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(function(){ a.remove(); }, 100); }; });
        TW.$$('[data-file-delete]', manager).forEach(function(button){ button.onclick = function(){ if (!confirm('确认删除该附件吗？')) return; TW.files.remove(button.dataset.fileDelete).then(function(){ renderAttachments(); TW.toast('附件已删除'); }).catch(function(error){ TW.toast('删除失败：' + error.message, 'danger'); }); }; });
      }).catch(function(){ TW.$('#attachmentCount').textContent = '不可用'; TW.$('#attachmentManager').innerHTML = '<div class="alert danger">无法读取附件库。</div>'; });
    }
    renderAttachments();
    TW.$('#exportLocalBackup').onclick = function(){ var button = this, feedback = TW.$('#backupFeedback'); button.disabled = true; button.textContent = '正在整理…'; TW.files.exportData().then(function(attachments){ var payload = TW.store.exportData(); payload.attachments = attachments; downloadJSON('教师工作台-本机备份-' + new Date().toISOString().slice(0,10) + '.json', payload); feedback.textContent = '完整备份已导出，共 ' + attachments.length + ' 个附件。'; button.disabled = false; button.textContent = '导出完整备份'; }).catch(function(error){ feedback.textContent = '导出失败：' + error.message; button.disabled = false; button.textContent = '导出完整备份'; }); };
    var replaceMode = false, fileInput = TW.$('#backupFileInput');
    TW.$('#importLocalBackup').onclick = function(){ replaceMode = false; fileInput.value = ''; fileInput.click(); };
    TW.$('#replaceLocalBackup').onclick = function(){ replaceMode = true; fileInput.value = ''; fileInput.click(); };
    fileInput.onchange = function(){
      var file = fileInput.files && fileInput.files[0]; if (!file) return;
      if (file.size > 80 * 1024 * 1024) { TW.$('#backupFeedback').textContent = '备份超过80MB，已拒绝。'; return; }
      var reader = new FileReader();
      reader.onload = function(){
        try {
          var payload = JSON.parse(reader.result), before = TW.store.exportData(), result = TW.store.importData(payload, { replace: replaceMode });
          if (!result.ok) { TW.$('#backupFeedback').textContent = '导入失败：' + (result.error || (result.failed || []).join('、')); return; }
          TW.files.importData(payload.attachments || [], replaceMode).then(function(fileResult){ TW.$('#backupFeedback').textContent = '已恢复 ' + result.imported + ' 组数据和 ' + fileResult.imported + ' 个附件，即将刷新。'; setTimeout(function(){ location.reload(); }, 450); }).catch(function(error){ TW.store.importData(before, { replace: true }); TW.$('#backupFeedback').textContent = '附件恢复失败，普通数据已回滚：' + error.message; });
        } catch (error) { TW.$('#backupFeedback').textContent = '导入失败：文件不是有效的教师工作台备份。'; }
      };
      reader.onerror = function(){ TW.$('#backupFeedback').textContent = '文件读取失败。'; };
      reader.readAsText(file);
    };
    TW.$('#clearLocalData').onclick = function(){ var phrase = prompt('此操作会清空当前工作台在本机保存的全部数据。请输入"确认清空"继续：'); if (phrase !== '确认清空') { TW.$('#backupFeedback').textContent = '未清空：确认文字不匹配。'; return; } TW.store.clear(); TW.files.clear().catch(function(){}).then(function(){ location.reload(); }); };
  }

  function openProfile(){
    TW.modal('个人信息', '<div class="grid-3">' + [['当前班级', classNameOf(), 'profile-edit-class'], ['身份', classNameOf() + '班主任', ''], ['学期', TW.semester, 'profile-edit-semester']].map(function(p){
      return '<div class="stat-card' + (p[2] ? ' profile-editable' : '') + '"' + (p[2] ? ' data-action="' + p[2] + '" role="button" tabindex="0" title="点击修改"' : '') + '><div class="stat-label">' + p[0] + '</div><div class="stat-value" style="font-size:22px">' + TW.escape(p[1]) + '</div>' + (p[2] ? '<div class="stat-sub">点击修改</div>' : '') + '</div>';
    }).join('') + '</div><div style="max-height:58vh;overflow:auto;padding-right:6px;margin-top:4px"><div id="themeSection" style="margin-bottom:10px"></div><div id="lockSection" style="margin-bottom:10px"></div><div id="dataSection"></div></div>', '<button class="button secondary" data-close>关闭</button>');
    renderThemeSection(TW.$('#themeSection'));
    renderLockSettings(TW.$('#lockSection'));
    renderDataManager(TW.$('#dataSection'));
  }
  /* 修改班级名称（单班级：只改名称不改结构） */
  function profileEditClass(){
    var name = prompt('修改班级名称（如：高一(7)班）：', classNameOf());
    if (name == null) return;
    name = name.trim();
    if (!name) { TW.toast('班级名称不能为空', 'danger'); return; }
    classes[0].name = name;
    TW.store.write('classes', classes);
    TW.$('#modalRoot').innerHTML = ''; renderShell();
    logRecord('个人信息：修改班级名称', name);
    TW.toast('班级已更名为 ' + name);
  }
  /* 修改学期名称（如：2026—2027学年第二学期） */
  function profileEditSemester(){
    var v = prompt('修改学期名称：', TW.semester || '');
    if (v == null) return;
    v = v.trim();
    if (!v) { TW.toast('学期名称不能为空', 'danger'); return; }
    TW.semester = v;
    TW.store.write('semester', v);
    TW.$('#modalRoot').innerHTML = ''; renderShell();
    logRecord('个人信息：修改学期', v);
    TW.toast('学期已设为 ' + v);
  }

  /* 界面主题：配色1（默认雅致绿）/ 配色2（烟洲中学校徽：暗红+纯白）/ 深夜模式（护眼深色） */
  function renderThemeSection(root){
    var cur = document.documentElement.dataset.theme || 'default';
    root.innerHTML = '<div class="section-title">界面主题</div><div class="toolbar" style="margin-top:8px;flex-wrap:wrap"><button class="button ' + (cur === 'default' ? '' : 'secondary') + '" id="themeDefault">配色1</button><button class="button ' + (cur === 'badge' ? '' : 'secondary') + '" id="themeBadge">配色2</button><button class="button ' + (cur === 'dark' ? '' : 'secondary') + '" id="themeDark">深夜模式</button></div><p class="note" style="margin-top:8px">配色1为默认雅致绿；配色2为暗红 + 纯白经典双色；深夜模式为护眼深色。切换即时生效并自动记忆。</p>';
    TW.$('#themeDefault').onclick = function(){ setTheme('default'); };
    TW.$('#themeBadge').onclick = function(){ setTheme('badge'); };
    TW.$('#themeDark').onclick = function(){ setTheme('dark'); };
  }
  function setTheme(t){
    document.documentElement.dataset.theme = t;
    TW.store.write('theme', t);
    openProfile();
    TW.toast('已切换为' + ({ default: '配色1', badge: '配色2', dark: '深夜模式' }[t] || t));
  }

  function downloadCSV(name, rows){ var csv = '\ufeff' + rows.map(function(r){ return r.map(function(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'); var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 100); }
  function downloadJSON(name, data){ var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 100); }

  /* ================= 页面锁（密码保护） =================
   * 规则：不输入密码无法观看；无操作 10 分钟自动锁定；左上角 🔒 手动锁定；
   *      系统内可自定义/清除密码（右上角"锁屏密码"）。
   * 说明：密码以加盐 SHA-256 哈希存于 lock_config 数据键（磁盘明文 JSON 中不含密码原文），
   *      这是便利性界面锁，不是加密；忘记密码可删除 data\records\lock_config.json 重置。
   */
  var lockConfig = TW.store.read('lock_config', null);
  var locked = false;
  var idleTimer = null;

  function sha256hex(text){
    try {
      var data = new TextEncoder().encode(text);
      if (w.crypto && w.crypto.subtle) {
        return w.crypto.subtle.digest('SHA-256', data).then(function(buf){
          return Array.prototype.map.call(new Uint8Array(buf), function(b){ return b.toString(16).padStart(2, '0'); }).join('');
        });
      }
    } catch (e) {}
    // 兜底：FNV-1a 双哈希（无 WebCrypto 环境）
    var h1 = 0x811c9dc5, h2 = 0x811c9dc5, data2 = new TextEncoder().encode(text);
    for (var i = 0; i < data2.length; i++){ h1 = Math.imul(h1 ^ data2[i], 16777619); h2 = Math.imul(h2 ^ data2[i], 16777619) ^ (data2[i] << 8); }
    return Promise.resolve((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16));
  }
  function genSalt(){
    var a = new Uint8Array(16);
    if (w.crypto && w.crypto.getRandomValues) w.crypto.getRandomValues(a);
    else for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function(b){ return b.toString(16).padStart(2, '0'); }).join('');
  }
  function hashPassword(pw, salt){ return sha256hex(salt + '::' + pw); }

  function showLock(setupMode){
    locked = true;
    clearTimeout(idleTimer);
    document.body.classList.add('wb-locked');
    var screen = TW.$('#lockScreen');
    screen.classList.remove('hidden');
    TW.$('#lockTitle').textContent = setupMode ? '首次使用' : '已锁定';
    TW.$('#lockSub').textContent = setupMode ? '请设置锁屏密码（设置后每次进入都需输入）' : '请输入锁屏密码继续使用';
    TW.$('#lockInput').value = '';
    TW.$('#lockInput').placeholder = setupMode ? '设置新密码' : '锁屏密码';
    TW.$('#lockError').textContent = '';
    TW.$('#lockConfirm').textContent = setupMode ? '设置并进入' : '解锁';
    TW.$('#lockConfirm').dataset.mode = setupMode ? 'setup' : 'unlock';
    setTimeout(function(){ TW.$('#lockInput').focus(); }, 50);
  }
  function hideLock(){
    locked = false;
    document.body.classList.remove('wb-locked');
    TW.$('#lockScreen').classList.add('hidden');
    armIdleLock();
  }
  function lockNow(){ showLock(false); }
  function armIdleLock(){
    clearTimeout(idleTimer);
    if (locked || !(lockConfig && lockConfig.hash)) return;
    idleTimer = setTimeout(function(){ lockNow(); }, (Number(lockConfig.timeoutMin) || 10) * 60 * 1000);
  }
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function(evt){
    document.addEventListener(evt, function(){ if (!locked) armIdleLock(); }, { passive: true });
  });

  function submitLock(){
    var val = TW.$('#lockInput').value;
    var mode = TW.$('#lockConfirm').dataset.mode;
    var err = TW.$('#lockError');
    if (!val) { err.textContent = '请输入密码'; return; }
    if (mode === 'setup') {
      if (val.length < 4) { err.textContent = '密码至少 4 位'; return; }
      var salt = genSalt();
      hashPassword(val, salt).then(function(h){
        lockConfig = { salt: salt, hash: h, timeoutMin: 10, updatedAt: new Date().toISOString() };
        TW.store.write('lock_config', lockConfig);
        hideLock();
        TW.toast('锁屏密码已设置，无操作 10 分钟自动锁定');
      });
      return;
    }
    if (!lockConfig || !lockConfig.hash) { err.textContent = '尚未设置密码，请先设置'; return; }
    hashPassword(val, lockConfig.salt).then(function(hash){
      if (hash === lockConfig.hash) { hideLock(); TW.toast('已解锁'); }
      else { err.textContent = '密码错误'; TW.$('#lockInput').value = ''; TW.$('#lockInput').focus(); }
    });
  }

  function renderLockSettings(root){
    var has = !!(lockConfig && lockConfig.hash);
    root.innerHTML = '<div class="section-title">锁屏密码</div>' + '<div class="note" style="margin-bottom:10px">无操作 ' + (lockConfig && lockConfig.timeoutMin || 10) + ' 分钟自动锁定；左上角 🔒 可立即锁定。密码以加盐哈希存储，不含明文。</div>' + (has ? '<div class="field"><label class="required">当前密码</label><input id="lsCur" type="password" autocomplete="off"></div>' : '') + '<div class="form-grid"><div class="field"><label class="required">新密码</label><input id="lsNew" type="password" autocomplete="off"></div><div class="field"><label class="required">确认新密码</label><input id="lsNew2" type="password" autocomplete="off"></div></div><div id="lsError" class="note danger-text" aria-live="polite"></div><div class="toolbar" style="margin-top:12px"><button class="button secondary danger-text" id="lsClear"' + (has ? '' : ' disabled') + '>清除密码</button><button class="button" id="lsSave">保存</button></div>';
    TW.$('#lsSave').onclick = function(){
      var err = TW.$('#lsError');
      var np = TW.$('#lsNew').value, np2 = TW.$('#lsNew2').value;
      if (!np || np.length < 4) { err.textContent = '新密码至少 4 位'; return; }
      if (np !== np2) { err.textContent = '两次输入不一致'; return; }
      function finish(newSalt, newHash){
        lockConfig = { salt: newSalt, hash: newHash, timeoutMin: lockConfig ? (lockConfig.timeoutMin || 10) : 10, updatedAt: new Date().toISOString() };
        TW.store.write('lock_config', lockConfig);
        renderLockSettings(TW.$('#lockSection'));
        TW.toast('锁屏密码已更新');
      }
      if (has) {
        var cur = TW.$('#lsCur').value;
        if (!cur) { err.textContent = '请输入当前密码'; return; }
        hashPassword(cur, lockConfig.salt).then(function(h){
          if (h !== lockConfig.hash) { err.textContent = '当前密码错误'; return; }
          var salt = genSalt();
          return hashPassword(np, salt).then(function(hh){ finish(salt, hh); });
        });
      } else {
        var salt = genSalt();
        hashPassword(np, salt).then(function(hh){ finish(salt, hh); });
      }
    };
    TW.$('#lsClear').onclick = function(){
      var cur = TW.$('#lsCur').value;
      if (!cur) { TW.$('#lsError').textContent = '请输入当前密码后清除'; return; }
      hashPassword(cur, lockConfig.salt).then(function(h){
        if (h !== lockConfig.hash) { TW.$('#lsError').textContent = '当前密码错误'; return; }
        TW.store.remove('lock_config'); lockConfig = null;
        renderLockSettings(TW.$('#lockSection'));
        TW.toast('已清除锁屏密码');
      });
    };
  }
  TW.$('#lockConfirm') && (TW.$('#lockConfirm').onclick = function(){ submitLock(); });
  TW.$('#lockInput') && (TW.$('#lockInput').addEventListener('keydown', function(e){ if (e.key === 'Enter') submitLock(); }));

  init();
})(window);
