# 教师工作台 · Agent 操作指南（AGENT-GUIDE）

> 写给 AI agent（WorkBuddy / CodeBuddy / Claude Code / DeepSeek Harness 等）。
> 本文件回答一个问题：**如何安全、正确地读写这个系统的数据**。

---

## 0. AI 开场话术（用户询问 agent 时的引导词）

> 用户通过 agent 操作工作台时,agent 应先用下面这段话术开场并完成"三问澄清",
> 确认模块、操作类型、以及成绩的追加/覆盖语义,再动手执行。

### 0.1 开场白（agent 对用户说）

> "您好,我是**班主任工作台**的数据助手,可以帮您查询、录入和修改工作台里的数据
> （学生档案、考勤、成绩、作业、班会、宿舍、心理、选科、课时、值日、积分等）。
> 在开始之前,请先告诉我三件事,避免改错数据："

### 0.2 澄清一：要动哪个板块？

请用户从下列板块中选择：

| 编号 | 板块 | 典型内容 |
|---|---|---|
| 1 | **学生档案** | 名单、学籍号、性别、学籍状态、宿舍、家长、电话 |
| 2 | **考勤管理** | 迟到 / 缺勤 / 请假记录、销假 |
| 3 | **成绩分析** | 各场考试的每生每科分数、达标线 |
| 4 | **作业与自习** | 作业台账、负荷 |
| 5 | **班会 / 家校 / 宿舍 / 心理 / 综评 / 选科** | 各业务台账与谈话记录 |
| 6 | **课时 / 课表 / 值日 / 积分 / 预警** | 跨班上课、排班、加减分 |
| 7 | **表格填报 / 通知 / 年级事务** | 填报任务（含网址）、通知、台账 |
| 8 | **待办 / 班级事务** | 首页待办、日历事件 |

### 0.3 澄清二：做什么操作？

| 操作 | 说明 | 风险 |
|---|---|---|
| 查看 / 统计 | 只读查询、导出 | 无 |
| 新增（追加） | 在现有数据后追加记录 | 低 |
| 修改 | 更新指定记录（按学籍号/姓名定位） | 中 |
| 删除 | 移除记录（跨板块引用会被保护拦截） | 高 |

### 0.4 澄清三：成绩操作专属问题（必问，缺一不可）

涉及"成绩分析"板块时，必须再确认：

1. **哪场考试？** 是已有考试（如 9月月考、期中考试），还是需要新建一场考试？
2. **范围？** 全部学生，还是个别学生（请提供名单）？哪些学科？
3. **追加还是覆盖？**
   - **追加（合并）**：新成绩并入该场考试，已有学生/科目分数保持不变，只补缺的；
   - **覆盖（替换）**：替换该场考试的全部成绩，或替换指定学生指定学科的成绩；
   - 无论哪种，**执行前会自动备份**，可随时恢复。
4. **旧成绩怎么办？** 覆盖前是否要保留旧成绩备份（默认保留）。

### 0.5 执行前复述确认模板（agent 必须复述，用户确认后才执行）

> "我将执行以下操作，请您确认：
> 【板块】学生成绩 → 【考试】期中考试 → 【范围】按名单新增 5 名学生全部学科 → 【方式】**追加**（不动其他学生现有分数）→ 执行前自动备份。
> 确认无误请回复'确认'，需要调整请直接告诉我。"

### 0.6 红线（任何时候不可违反）

1. 写入前必须先确认操作类型与范围；`--replace`（整体覆盖）必须得到用户明确同意。
2. 不直接编辑 `data/records/*.json`（绕过信封结构会损坏数据），一律使用 `agent-import.js` / `wb.js` / HTTP API。
3. 学生主键为学籍号（sid），回退姓名；批量操作前先核对名单与档案一致。
4. 数据在本地磁盘，删除/覆盖前先备份，误操作可用 `data/backup/` 恢复。

---

## 1. 系统是什么

一个本地运行的"班主任/教师工作台"桌面应用：

- **父文件夹**：`教师工作台/`（本文件所在目录的上一级）
- `app/` — 应用代码（前端 `www/`、服务端 `server.js`、CLI `wb.js`、导入工具 `agent-import.js`）
- `data/` — 全部数据（`records/` 台账 JSON、`attachments/` 附件、`backup/` 快照）
- `templates/` — 22 张表的 CSV 模板（Excel 可直接打开）
- `打开教师工作台.vbs` — 双击启动

数据存储：**每个存储键一个 JSON 信封文件** `data/records/<key>.json`，内容形如：

```json
{ "version": 2, "updatedAt": "...", "data": [ ... ] }
```

---

## 2. 核心概念：两套存储（务必理解）

| 存储 | 说明 | 谁在读 |
|---|---|---|
| **业务键**（`students_c1`、`grade_matters`…） | 渲染表格、统计卡、查看弹窗的真实数据源 | 页面渲染、统计 |
| **editable_tables_v2** | 前端"可编辑表格"的显示源（学生/选科/作业/考勤 4 个模块被它接管） | 这 4 个模块的表格显示 |

**⚠️ 直接写业务键 `students_c1`，前端学生表格不会刷新**（表格读的是 editable_tables_v2）。

**解决办法**：永远用 `agent-import.js` 导入（自动双写），不要手写业务键。

---

## 3. 快速上手：一条命令导入数据

```bash
cd app

# 查看所有可用表
node agent-import.js list

# 打印某张表的 CSV 模板（表头）
node agent-import.js template students

# 导入学生名单（追加，班级 c1）
node agent-import.js import students 名单.csv --class c1

# 整体替换（先自动备份，可恢复）
node agent-import.js import students 名单.csv --class c1 --replace

# 导出当前数据为 CSV
node agent-import.js export students --class c1
```

**导入步骤（推荐）**：
1. `node agent-import.js template <表名>` 看表头
2. 按表头填数据（用 `templates/` 里的模板文件，或让用户提供）
3. `node agent-import.js import <表名> <文件> --class cX`
4. `node agent-import.js export <表名> --class cX` 核对结果

---

## 4. 全部表格一览

### 4.1 班级级表格（`--class cX`，默认 c1）

| 表名 | 存储键 | 必填列 | 说明 |
|---|---|---|---|
| `students` | `students_<班级>` | 姓名 | 重点标记列填"重点关注"→ focus=2 |
| `attendance` | `attendance_<班级>` | 日期/学生/类型 | 类型=迟到/缺勤/请假；销假自动识别 |
| `homework` | `homework_<班级>` | 学科/日期 | 时长(分)自动转数字 |
| `selection` | `selection_<班级>` | 姓名/首选/再选组合 | 首选=物理/历史 |
| `exams` | `exams_<班级>` | 考试名/考试日期 | **成绩请用 JSON 导入**（见 5.3） |
| `affairs` | `affairs_<班级>` | 日期/标题 | 类型=德育/家校/活动/教学/考试 |
| `tasks` | `tasks_<班级>` | 标题/截止 | 首页待办 |
| `meetings` | `meetings_<班级>` | 日期/主题 | 班会记录 |
| `meeting_plan` | `meeting_plan_<班级>` | 日期/主题 | 班会计划 |
| `family` | `family_<班级>` | 日期/对象 | 家校沟通 |
| `parent_meetings` | `parent_meetings_<班级>` | 日期/主题 | 家长会 |
| `family_plan` | `family_plan_<班级>` | 日期/对象 | 沟通计划 |
| `dorm` | `dorm_<班级>` | 宿舍号 | 宿舍信息 |
| `dorm_visits` | `dorm_visits_<班级>` | 日期/宿舍 | 探访记录 |
| `mental` | `mental_<班级>` | 学生/等级 | 等级=L1/L2；谈话记录用 JSON |
| `quality` | `quality_<班级>` | 姓名 | 道德/学业/健康/艺术/劳动 |
| `cleaning` | `cleaning_<班级>` | 星期/值日学生/值日内容 | 值日表：按星期循环排班，值日内容自定义 |
| `points` | `points_<班级>` | 姓名/变动分/原因/时间 | 分数管理：初始100分，CSV一行=一条加减分记录（变动分正=加、负=扣） |
| `weekly` | `weekly_homework` | 班级/班主任/班主任学科/政治课代表/第X周/周一~周五 | 各班作业跟踪（作业模块内新模块）：ABCD 列为模块内用户自行输入的内容；兼容原「高一各班记录跟踪」xlsx 布局 |
| `alerts` | —（只读聚合） | — | 预警中心：跨板块风险信号（积分/心理/考勤/值日），无需写 |

### ⚠️ 学生主键约定（P0 数据联动）

- 学生以 **sid（学籍号）为唯一主键**；各业务板块记录（考勤/分数/心理/综评/选科）存 `sid` + `name`。
- 匹配规则：**sid 优先，回退姓名**（兼容历史数据）。
- 导入含学生关联的数据时，`name` 须与学生档案姓名一致；`sid` 可选（自动按姓名解析）。
- **删除学生**：有跨板块引用时会被阻止（引用保护），需先清理关联记录。

### 4.2 学校/教务全局表格（跨班级共享，无需 --class）

| 表名 | 存储键 | 必填列 |
|---|---|---|
| `grade` | `grade_matters` | 日期/事项/负责/状态 |
| `notice` | `notices` | 日期/标题/来源/重要度 |
| `duty` | `duty_schedule` | 日期/类型/人员/地点/状态 |
| `awards` | `awards` | 学生/荣誉/级别/状态 |
| `safety` | `safety` | 事项/对象范围/状态 |
| `hygiene` | `hygiene` | 事项/对象范围/状态 |
| `personal` | `personal` | 事项/状态 |
| `forms` | `form_tasks` | 任务/来源单位/截止时间/字段数/预计耗时/网址/状态 |
| `lessons` | `lessons` | 班级/日期/上课内容/上课计划/应收作业/备注 | 课时管理（跨班上课记录） |

> **单班级说明**：工作台固定管理一个班级（c1），不再支持多班级；`--class` 参数保留但固定为 c1。跨班数据（课时管理 lessons / 课表 schedule / 教学班 lesson_classes）为全局键。

---

## 5. 高级用法

### 5.1 直接读数据（wb.js）

```bash
node wb.js status                 # 状态 + 数据目录
node wb.js keys                   # 所有存储键
node wb.js get students_c1        # 读某个键
```

### 5.2 通过 HTTP API（服务运行时）

```bash
curl http://127.0.0.1:8731/api/store/students_c1          # 读
curl -X PUT http://127.0.0.1:8731/api/store/students_c1 \
     -d '{"data":[{...}]}' -H "Content-Type: application/json"   # 写（注意信封结构）
curl -X POST http://127.0.0.1:8731/api/import -d @备份.json      # 导入备份
```

### 5.3 成绩（exams）JSON 格式

成绩结构是嵌套的（考试 → 每生每科分数），CSV 只支持建考试框架：

```json
{
  "name": "10月月考",
  "date": "2026-10-15",
  "scores": [
    { "name": "张三", "语文": 118, "数学": 132, "英语": 126 },
    { "name": "李四", "语文": 96, "数学": 145, "英语": 108 }
  ]
}
```

导入：`node agent-import.js import exams scores.json --class c1`

### 5.4 心理关注谈话记录（mental）JSON 格式

```json
{
  "name": "张三",
  "level": 2,
  "reason": "考试焦虑",
  "talks": [
    { "time": "2026-09-01", "content": "谈话内容", "reaction": "学生反应" }
  ]
}
```

### 5.5 分数管理（points）格式

业务键是嵌套结构（学生 → 加减分日志）；**CSV 一行 = 一条加减分记录**，工具自动按学生聚合：

```json
[
  { "name": "张雨桐", "logs": [ { "delta": 5, "reason": "主动值日", "time": "2026-09-10" } ] }
]
```

CSV 模板（`templates/24-分数管理.csv`）：`姓名,变动分,原因,时间`（变动分为正=加分、负=扣分）。

### 5.6 各班作业跟踪（weekly）格式

作业模块内的新模块「各班作业跟踪」，业务键 `weekly_homework`（跨班级全局），嵌套结构（班级+周 → 每日作业）：

```json
[
  { "cls": "高一16班", "head": "李林华", "subject": "数学", "rep": "肖玥希、谭欢", "week": "第1周", "days": { "周一": "开学第一课：完成导学案填空", "周二": "", "周三": "", "周四": "", "周五": "" } }
]
```

CSV 模板（`templates/27-周作业跟踪.csv`）：`班级,班主任,班主任学科,政治课代表,第X周,周一,周二,周三,周四,周五`。
- **ABCD 列（班级/班主任/班主任学科/政治课代表）为模块内用户自行输入的内容**，班主任学科有助于理解该班学生偏好。
- 前端上传入口（作业模块 → 各班作业跟踪 → 上传周作业模板）支持 xlsx / csv，**也兼容原「高一各班记录跟踪」xlsx 布局**（行1=周次表头、行2=日期、行3起=每班一行，自动按周拆分）。
- HTTP 解析接口：`POST /api/parse-weekly`（body: `{ name, base64 }` 或 `{ name, text }`），返回 `{ ok, format, count, rows }`。

---

## 6. 数据保护（重要）

| 场景 | 保护 |
|---|---|
| **任何导入**（append/replace） | 自动快照 `data/backup/pre-import-<时间>.json` |
| **导入失败** | 自动回滚到导入前状态 |
| **热补丁更新** | 只替换 `app/`，`data/` 完全隔离，永不丢失 |
| **误操作恢复** | `node wb.js import data/backup/pre-import-xxx.json --replace` |

**不要做的事**：
- ❌ 直接编辑 `data/records/*.json`（绕过信封结构会损坏数据）
- ❌ 删除 `data/backup/`（你的安全网）
- ❌ 导入前不确认 `--replace` 语义（会覆盖现有数据，虽可恢复但仍谨慎）

---

## 7. 常见任务速查

| 任务 | 命令 |
|---|---|
| 录入 50 人新生名单 | 填 `templates/01-学生档案.csv` → `import students ... --class c1` |
| 记录一次月考成绩 | 按 5.3 JSON → `import exams scores.json --class c1` |
| 新增一条教务通知 | 填模板 → `import notice ...` |
| 导出全部数据做备份 | `node wb.js backup` 或 `node wb.js export 备份.json` |
| 查询某班学生数 | `node wb.js get students_c1` 数长度 |
| 查当前班级 | `node wb.js get current_class` |

---

*本指南由 AI 助手生成，与 `templates/` 目录和 `app/agent-import.js` 配套使用。*
