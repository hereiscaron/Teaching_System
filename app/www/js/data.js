(function(w){
  var TW=w.TW;
  TW.school='烟洲中学';
  TW.grade='高一';
  TW.semester='2026—2027学年第一学期';

  // —— 班级（可自定义，顶栏下拉切换）——
  TW.defaultClasses=[{id:'c1',name:'高一(1)班'}];

  // —— 自定义学科（可在成绩分析中增删，按班级保存）——
  TW.defaultSubjects=['语文','数学','英语','物理','化学','生物'];

  // —— 学生名单种子（仅默认班级 c1 使用；新增班级从空开始）——
  TW.studentNames=['张雨桐','李明轩','王子涵','陈思远','刘诗涵','赵梓涵','杨晨曦','黄紫宸','周欣怡','吴俊杰','徐嘉怡','孙浩然','胡思睿','朱婉清','高宇航','林芷晴','何沐阳','郭书瑶','罗逸辰','郑雅文','梁博文','谢安琪','宋泽宇','唐可欣','韩一诺','冯子墨','曹语嫣','彭睿哲','许佳宁','邓皓文','沈佳宜','蒋承恩','袁诗琪','蔡承泽','吕欣妍','方俊熙','苏若琳','叶梓宸','贺语桐','董浩宇','魏欣然','邱梓恒','任嘉树','白若曦','程子昂','江雨桐','谭晓峰','欧阳雪'];
  TW.studentsSeed=TW.studentNames.map(function(name,i){
    return {
      name:name,
      id:'G2026'+String(100000000+i),
      gender:i%2===0?'女':'男',
      status:i===7?'休学':(i===2||i===19?'转学':(i<3||i===11||i===26?'住宿':'在籍')),
      dorm:(i%3===0?'A401':(i%3===1?'A402':'B305')),
      parent:['王','李','张','刘','陈','杨','赵','黄'][i%8]+'家长',
      phone:'138'+String(10000000+(i*7919)%100000000),
      focus:i===5?2:(i===14||i===31?1:0),
      focusReason:i===5?'入学适应困难，情绪低落':(i===14?'家庭沟通紧张':'考试焦虑')
    };
  });

  // —— 考勤（仅异常记录）——
  TW.attendanceSeed=[
    {date:'2026-09-02',name:'李明轩',type:'迟到',note:'07:42 到校'},
    {date:'2026-09-02',name:'宋泽宇',type:'缺勤',note:'未到校，家长电话未接通'},
    {date:'2026-09-03',name:'沈佳宜',type:'请假',note:'急性肠胃炎，已销假'},
    {date:'2026-09-04',name:'蒋承恩',type:'请假',note:'体育特长生区级选拔赛'}
  ];

  // —— 成绩（多考试 · 多学科 · 趋势）——
  TW.examsSeed=[
    {id:'ex_1',name:'9月月考',date:'2026-09-25',scores:[
      {name:'张雨桐',语文:118,数学:132,英语:126,物理:88,化学:82,生物:90},
      {name:'李明轩',语文:96,数学:145,英语:108,物理:95,化学:88,生物:76},
      {name:'王子涵',语文:110,数学:121,英语:130,物理:80,化学:79,生物:85},
      {name:'陈思远',语文:102,数学:98,英语:95,物理:72,化学:68,生物:70},
      {name:'刘诗涵',语文:124,数学:115,英语:128,物理:76,化学:85,生物:88},
      {name:'赵梓涵',语文:89,数学:106,英语:92,物理:66,化学:70,生物:64},
      {name:'杨晨曦',语文:116,数学:128,英语:119,物理:90,化学:86,生物:82},
      {name:'黄紫宸',语文:104,数学:112,英语:121,物理:74,化学:72,生物:78}
    ]},
    {id:'ex_2',name:'期中考试',date:'2026-11-12',scores:[
      {name:'张雨桐',语文:122,数学:138,英语:130,物理:91,化学:86,生物:93},
      {name:'李明轩',语文:100,数学:148,英语:112,物理:97,化学:90,生物:80},
      {name:'王子涵',语文:114,数学:126,英语:133,物理:83,化学:82,生物:88},
      {name:'陈思远',语文:106,数学:104,英语:99,物理:75,化学:72,生物:73},
      {name:'刘诗涵',语文:128,数学:118,英语:132,物理:80,化学:88,生物:91},
      {name:'赵梓涵',语文:93,数学:110,英语:96,物理:70,化学:73,生物:68},
      {name:'杨晨曦',语文:120,数学:132,英语:123,物理:93,化学:89,生物:85},
      {name:'黄紫宸',语文:108,数学:116,英语:125,物理:77,化学:76,生物:81}
    ]}
  ];

  // —— 作业与自习（含负荷统计）——
  TW.homeworkSeed=[
    {subject:'数学',date:'2026-09-07',content:'函数单调性练习册 P42—45',minutes:45,difficulty:'中'},
    {subject:'语文',date:'2026-09-07',content:'《劝学》背诵打卡',minutes:20,difficulty:'易'},
    {subject:'英语',date:'2026-09-08',content:'Unit 3 单词默写 + 听力',minutes:30,difficulty:'中'},
    {subject:'物理',date:'2026-09-09',content:'受力分析专题卷',minutes:50,difficulty:'难'},
    {subject:'化学',date:'2026-09-10',content:'离子方程式 20 题',minutes:35,difficulty:'中'},
    {subject:'数学',date:'2026-09-10',content:'错题订正 15 题',minutes:25,difficulty:'中'},
    {subject:'英语',date:'2026-09-11',content:'完形填空 2 篇',minutes:30,difficulty:'中'}
  ];

  // —— 班会与德育（记录 + 计划）——
  TW.meetingSeed=[
    {date:'2026-08-25',topic:'开学第一课：目标与纪律',content:'确立班级公约；手机入柜制度；作息说明。学生反响积极。',status:'已归档'},
    {date:'2026-09-01',topic:'交通安全与校园安全',content:'骑行安全、应急疏散路线讲解，配合视频案例。',status:'已归档'}
  ];
  TW.meetingPlanSeed=[
    {date:'2026-09-08',topic:'时间管理方法',goal:'帮助学生在月考前后合理安排复习与作息'},
    {date:'2026-09-15',topic:'考试诚信教育',goal:'明确考场纪律与诚信要求'},
    {date:'2026-09-22',topic:'选科指导专题',goal:'介绍新高考 3+1+2 政策与选科建议'}
  ];

  // —— 家校沟通（历史 + 家长会 + 计划）——
  TW.familySeed=[
    {date:'2026-08-30',type:'家访',target:'宋泽宇',content:'了解暑期学习与家庭沟通情况',feedback:'家长表示会加强关注，配合学校',status:'已完成'},
    {date:'2026-09-01',type:'电话',target:'李明轩家长',content:'反馈月考进步情况',feedback:'家长很满意，希望继续督促',status:'已完成'},
    {date:'2026-09-03',type:'微信',target:'沈佳宜家长',content:'告知请假期间作业安排',feedback:'已收到，会督促完成',status:'已完成'}
  ];
  TW.parentMeetingSeed=[
    {date:'2026-08-28',topic:'开学家长会',attendance:'41/48',content:'选科说明、军训安排、手机管理制度、家委会选举',status:'已完成'},
    {date:'2026-09-19',topic:'月考动员家长会',attendance:'—',content:'月考时间与复习建议、选科意向摸底',status:'计划中'}
  ];
  TW.familyPlanSeed=[
    {date:'2026-09-10',target:'赵梓涵家长',reason:'入学适应困难，需面谈沟通'},
    {date:'2026-09-17',target:'全体家长',reason:'家长群发布月考复习指引'}
  ];

  // —— 宿舍管理（表格 + 探访记录）——
  TW.dormSeed=[
    {room:'A401',members:'张雨桐、刘诗涵、杨晨曦、黄紫宸',leader:'张雨桐',note:''},
    {room:'A402',members:'赵梓涵、周欣怡、徐嘉怡、朱婉清',leader:'周欣怡',note:''},
    {room:'B305',members:'李明轩、吴俊杰、孙浩然、何沐阳',leader:'李明轩',note:'就寝后使用手机，已约谈'},
    {room:'B306',members:'陈思远、罗逸辰、梁博文、宋泽宇',leader:'罗逸辰',note:''}
  ];
  TW.dormVisitSeed=[
    {date:'2026-09-02',room:'B305',note:'就寝纪律检查，发现手机未入柜，已提醒并记录'},
    {date:'2026-09-04',room:'A401',note:'卫生检查，阳台杂物待整理'}
  ];

  // —— 心理关注（完整学生列表 + 等级 + 谈话记录）——
  TW.mentalSeed=[
    {name:'赵梓涵',level:2,reason:'入学适应困难，情绪低落',talks:[{time:'2026-08-29',content:'了解新生适应情况，情绪偏低落',reaction:'愿意倾诉，主动提出想多交朋友'},{time:'2026-09-02',content:'询问与同桌相处情况',reaction:'比上周放松，能正常交流'}]},
    {name:'宋泽宇',level:1,reason:'家庭沟通紧张，课堂注意力下降',talks:[{time:'2026-09-01',content:'询问家庭近况与学习状态',reaction:'回避家庭话题，表示会调整'}]},
    {name:'周欣怡',level:2,reason:'考试焦虑明显，失眠',talks:[{time:'2026-08-30',content:'疏导考试焦虑，建议求助心理老师',reaction:'接受建议，已约心理辅导中心'}]}
  ];

  // —— 综合素质评价（完整学期评语）——
  TW.qualitySeed=[
    {name:'张雨桐',moral:'优',academic:'优',health:'良',art:'优',labor:'良',comment:'学习主动，乐于帮助同学，是班级的得力助手。希望在体育锻炼上更加投入，注意劳逸结合。'},
    {name:'李明轩',moral:'良',academic:'优',health:'优',art:'中',labor:'良',comment:'理科思维突出，成绩名列前茅。书写不够规范，建议加强语文与英语的积累。'},
    {name:'王子涵',moral:'优',academic:'良',health:'良',art:'优',labor:'优',comment:'组织能力强，班级事务积极主动，责任心强。希望进一步夯实理科基础。'}
  ];

  // —— 选科意向（3+1+2）——
  TW.selectionSeed={
    first:{physics:26,history:22},
    combos:{'物理+化学+生物':14,'物理+化学+地理':6,'物理+生物+地理':4,'物理+政治+地理':2,'历史+政治+地理':10,'历史+化学+生物':6,'历史+政治+生物':6},
    undecided:0,
    intents:[
      {name:'张雨桐',first:'物理',combos:'物理+化学+生物'},
      {name:'李明轩',first:'物理',combos:'物理+化学+生物'},
      {name:'王子涵',first:'历史',combos:'历史+政治+地理'},
      {name:'刘诗涵',first:'物理',combos:'物理+化学+地理'}
    ]
  };

  // —— 班级事务（日历事件）——
  TW.affairsSeed=[
    {date:'2026-09-05',title:'主题班会',kind:'德育',note:'时间管理'},
    {date:'2026-09-08',title:'年级家长会',kind:'家校',note:'晚上 19:00'},
    {date:'2026-09-10',title:'教师节活动',kind:'活动',note:''},
    {date:'2026-09-12',title:'月考动员',kind:'教学',note:'班会时间'},
    {date:'2026-09-19',title:'月考家长会',kind:'家校',note:'下午 15:00'},
    {date:'2026-09-25',title:'9月月考',kind:'考试',note:'语数外 + 6选3'}
  ];

  // —— 待办 ——
  TW.tasksSeed=[
    {title:'9月月考成绩录入与班级分析',due:'今天 17:00',kind:'成绩',status:'待处理'},
    {title:'高一(1)班家长会通知回执催收',due:'明天 12:00',kind:'家校',status:'待处理'},
    {title:'本周主题班会《时间管理》准备',due:'周三',kind:'德育',status:'待处理'},
    {title:'宿舍 B305 手机问题复查',due:'今天 20:30',kind:'宿舍',status:'待处理'},
    {title:'选科意向首轮统计汇总',due:'8月15日',kind:'选科',status:'待处理'},
    {title:'心理重点关注名单月谈记录补录',due:'8月10日',kind:'心理',status:'待处理'}
  ];

  // —— 学生值日表（班级卫生值日排班，按星期循环；值日内容自定义）——
  TW.cleaningSeed=[
    {week:'周一',members:'张雨桐、李明轩、王子涵、陈思远',task:'扫地、拖地、擦黑板'},
    {week:'周二',members:'刘诗涵、赵梓涵、杨晨曦、黄紫宸',task:'扫地、拖地、擦窗台'},
    {week:'周三',members:'周欣怡、吴俊杰、徐嘉怡、孙浩然',task:'扫地、倒垃圾、擦讲台'},
    {week:'周四',members:'胡思睿、朱婉清、高宇航、林芷晴',task:'扫地、拖地、擦黑板'},
    {week:'周五',members:'郭书瑶、罗逸辰、郑雅文、梁博文',task:'大扫除（全教室）'}
  ];

  // —— 模块导航（班级工作 + 成绩管理两组）——
  TW.teachingModules=[
    ['dashboard','班级总览','home'],
    ['lessons','课时管理','book'],
    ['affairs','班级事务','calendar'],
    ['personal','个人事务','clipboard'],
    ['students','学生档案','list'],
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

  // —— 课时管理（任课教师的跨班上课记录）——
  // 教学班列表：只记录班级名称（不管理学生数据）
  TW.lessonClassesSeed=['高一16班','高一24班','高一25班','高一26班','高一27班','高一2班'];
  // 课表：{ odd: {'星期-节次': 班级}, even: {...} }（单双周分开，支持调课自定义）
  TW.scheduleSeed={ odd: {}, even: {} };
  // 课时记录：{ id, cls, date, content, plan, homework, note, color }
  TW.lessonsSeed=[

  ];

  TW.formTasks=[
    {title:'综合素质评价平台学期字段核对',source:'市教育局基教处',due:'2026-08-12',fields:18,time:'20分钟',white:true,url:'https://zhpj.ecnu.example.com ｜ 或查看市教育局基教处通知附件'},
    {title:'家庭经济困难学生认定申报',source:'校学生资助中心',due:'2026-08-15',fields:12,time:'15分钟',white:true,url:'校学生资助中心办公室（行政楼 203）领取纸质表'},
    {title:'学生视力与健康数据月报',source:'校卫生室',due:'2026-08-20',fields:9,time:'8分钟',white:true,url:'https://jkgl.example.edu.cn/monthly ｜ 校卫生室 105 室'}
  ];
  TW.gradeMatters=[
    {date:'2026-08-20',title:'高一年级军训动员会',owner:'年级组',status:'已完成'},
    {date:'2026-09-10',title:'选科指导家长宣讲会',owner:'年级组',status:'筹备中'},
    {date:'2026-09-25',title:'9月月考（全年级统一）',owner:'教务处',status:'待组织'}
  ];
  TW.dutySchedule=[
    {date:'2026-09-05',type:'午间值班',person:'班主任',location:'教学楼A区',status:'已排'},
    {date:'2026-09-06',type:'晚自习值班',person:'班主任',location:'高一(1)班教室',status:'已排'}
  ];
  TW.notices=[
    {date:'2026-09-01',title:'关于9月月考范围的通知',from:'教务处',status:'重要'},
    {date:'2026-08-28',title:'学生资助政策宣传周活动安排',from:'学生资助中心',status:'普通'}
  ];

  // —— 学校/教务台账（评优评先、安全与手机、卫生与健康、个人事务）——
  TW.awardsSeed=[
    {name:'张雨桐',honor:'三好学生',level:'校级',status:'待审核'},
    {name:'李明轩',honor:'优秀班干部',level:'校级',status:'待审核'},
    {name:'王子涵',honor:'学习之星',level:'校级',status:'已推荐'},
    {name:'刘诗涵',honor:'进步之星',level:'区级',status:'已推荐'}
  ];
  TW.safetySeed=[
    {item:'安全教育平台',scope:'全班',status:'已完成'},
    {item:'手机入柜检查',scope:'全班',status:'零带入'},
    {item:'防溺水专题教育',scope:'全班',status:'待完成'}
  ];
  TW.hygieneSeed=[
    {item:'晨午检',scope:'全班',status:'正常'},
    {item:'视力监测',scope:'全班',status:'待上报'},
    {item:'传染病防控排查',scope:'全班',status:'正常'}
  ];
  TW.personalSeed=[
    {item:'继续教育学时',status:'24/72'},
    {item:'职称评审材料',status:'已归档'},
    {item:'校级评优自荐',status:'待整理'}
  ];
})(window);
