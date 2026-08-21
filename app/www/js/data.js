(function(w){
  var TW=w.TW;
  TW.school='烟洲中学';
  TW.grade='高一';
  TW.semester='2026—2027学年第一学期';

  // —— 班级（可自定义，顶栏下拉切换）——
  TW.defaultClasses=[{id:'c1',name:'高一(1)班'}];

  // —— 自定义学科（可在成绩分析中增删，按班级保存）——
  TW.defaultSubjects=['语文','数学','英语','物理','化学','生物'];

  // —— 学生名单（正式版不含演示数据，从空开始；可导入 CSV 或手动新增）——
  TW.studentNames=[];
  TW.studentsSeed=[];

  // —— 考勤（仅异常记录）——
  TW.attendanceSeed=[];

  // —— 成绩（多考试 · 多学科 · 趋势；可新增考试后录入/导入）——
  TW.examsSeed=[];

  // —— 作业与自习（含负荷统计）——
  TW.homeworkSeed=[];

  // —— 班会与德育（记录 + 计划）——
  TW.meetingSeed=[];
  TW.meetingPlanSeed=[];

  // —— 家校沟通（历史 + 家长会 + 计划）——
  TW.familySeed=[];
  TW.parentMeetingSeed=[];
  TW.familyPlanSeed=[];

  // —— 宿舍管理（表格 + 探访记录）——
  TW.dormSeed=[];
  TW.dormVisitSeed=[];

  // —— 心理关注（完整学生列表 + 等级 + 谈话记录）——
  TW.mentalSeed=[];

  // —— 综合素质评价（完整学期评语）——
  TW.qualitySeed=[];

  // —— 选科意向（3+1+2）——
  TW.selectionSeed={ first:{physics:0,history:0}, combos:{}, undecided:0, intents:[] };

  // —— 班级事务（日历事件）——
  TW.affairsSeed=[];

  // —— 待办 ——
  TW.tasksSeed=[];

  // —— 学生值日表（班级卫生值日排班，按星期循环；值日内容自定义）——
  TW.cleaningSeed=[];

  // —— 模块导航（班级工作 + 成绩管理两组）——
  TW.teachingModules=[
    ['dashboard','班级总览','home'],
    ['lessons','课时管理','book'],
    ['affairs','班级事务','calendar'],
    ['personal','个人事务','clipboard'],
    ['students','学生档案','list'],
    ['seating','座位表','seat'],
    ['attendance','考勤管理','check'],
    ['meeting','班会与德育','flag'],
    ['family','家校沟通','users'],
    ['dorm','宿舍管理','dorm'],
    ['quality','综合素质评价','gear'],
    ['cleaning','值日表','broom'],
    ['alerts','预警中心','alert']
  ];
  TW.scoreModules=[
    ['scores','成绩分析','chart'],
    ['homework','作业与自习','book'],
    ['selection','选科意向','selection'],
    ['points','分数管理','points']
  ];

  // —— 课时管理（任课教师的跨班上课记录；教学班列表从空开始，可在课时管理中自建）——
  TW.lessonClassesSeed=[];
  // 课表：{ odd: {'星期-节次': 班级}, even: {...} }（单双周分开，支持调课自定义）
  TW.scheduleSeed={ odd: {}, even: {} };
  // 课时记录：{ id, cls, date, content, plan, homework, note, color }
  TW.lessonsSeed=[];

  // —— 表格填报任务（提醒事项；可新增任务并记录网址/位置）——
  TW.formTasks=[];
  TW.gradeMatters=[];
  TW.dutySchedule=[];
  TW.notices=[];

  // —— 学校/教务台账（评优评先、安全与手机、卫生与健康、个人事务）——
  TW.awardsSeed=[];
  TW.safetySeed=[];
  TW.hygieneSeed=[];
  TW.personalSeed=[];
})(window);
