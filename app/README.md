# 教师工作台（本地离线桌面应用）

基于 [build-professional-workbench](https://github.com/cylqwe7855-alt/build-professional-workbench) skill 定制的**教师工作台**：班级自定义与切换、班级日历事务、学生档案、异常考勤、成绩分析（核心）、作业负荷、班会记录与计划、家校沟通、宿舍管理、心理关注谈话记录、综合素质评价、选科意向等模块，全部数据以 JSON 文件保存在本机磁盘，支持 AI 通过 CLI / HTTP / 文件三种方式读写。

> 本仓库已经过完整安全审计（无网络外泄、无 RCE、无敏感路径读取、无隐藏载荷），并补修了原 skill 校验脚本在 Windows 上的路径分隔符 bug。

## 功能要点（V2 产品化改造）

- **班级自定义**：首次打开可新增/改名/删除班级（如"高一(7)班"），顶栏下拉一键切换；每个班级的数据完全隔离（学生、成绩、考勤、事务等按班级分键存储），新班级从空开始。
- **楷体界面**：全局使用楷体（KaiTi），字号已调大优化。
- **班级事务日历**：月度日历视图，德育/家校/活动/教学/考试五类着色事件，可翻月、点日期查看、新增事务。
- **成绩分析（核心）**：多考试多学科录入（单元格直接编辑、失焦自动保存）、自定义学科（不限于语数英物化生）、**折线图**（选中学生各科历次考试变化 / 全班总分趋势）+ **柱状图**（各科班级均分）、总分/最高分/达标人数统计、CSV 导出。
- **作业负荷**：柱状图按实际作业台账统计每日总时长（分钟），非装饰图。
- **考勤管理**：只记录异常（迟到/缺勤/请假+销假），正常出勤无需登记；已取消独立的"请假与销假"板块。
- **班会与德育**：班会记录（讲过的）+ 班会计划（要讲的）。
- **家校沟通**：沟通历史（说过什么 + 家长反馈）+ 家长会记录 + 沟通计划。
- **宿舍管理**：宿舍号/舍长/成员名单/备注表格 + 班主任探访记录。
- **心理关注**：完整关注名单（等级 L1-L3 + 原因），每个学生的**谈话记录**（时间/内容/反应）随"谈话记录"按钮打开并可新增。
- **综合素质评价**：评价档案 + 查看按钮打开**完整学期评语**。
- **选科意向**：首选/组合**饼状图**；意向名单支持编辑/CSV 导入导出/新增（无冗余操作列）。
- **已全局删除**所有模块的"健康指数"仪表盘、箱线图、关系网络图、六维图、日历热力图等冗余装饰。
- **页面锁**：不输入密码无法观看；首次使用必须先设置锁屏密码；无操作 **10 分钟自动锁定**；左上角"🔒 锁定"按钮一键立即锁定（带悬停/按压反馈）；锁屏密码设置与修改已并入**侧栏底部"个人信息"**模块。
- **字号**：全站最小字号 19px（以首页"已保存"为基准），楷体渲染，弱化文字加深对比。

## 个人信息（侧栏底部）

侧栏最下方"个人信息"汇总：当前班级/身份/学期 + 两个功能区：
- **锁屏密码**：设置/修改/清除密码（修改与清除需当前密码）。
- **本机数据**：数据集/记录/附件统计、导出完整备份、导入并合并/覆盖、清空本机数据、附件管理。

## 页面锁说明

- 密码以**加盐 SHA-256 哈希**存于 `lock_config` 数据键（磁盘上不含密码明文）；这是便利性界面锁，**不是加密**——`data\` 下的数据文件本身仍是明文，共享电脑上他人可直接读取文件。
- 无操作（鼠标/键盘/滚轮/滚动）10 分钟自动锁定；解锁后计时重新开始。
- **忘记密码**：删除 `data\records\lock_config.json`（或 `wb del lock_config`）即可重置，下次进入重新设置。
- 首次使用强制设置密码；设置后可随时在右上角"锁屏密码"修改或清除。

---

## 一、快速开始（Windows）

| 操作 | 方式 |
|---|---|
| **启动** | 双击桌面快捷方式「教师工作台」（或 `start.vbs`）——无控制台窗口，后台起服务并自动打开浏览器 |
| **停止** | 双击 `stop.vbs`（或命令行 `node wb.js stop`） |
| **命令行** | `wb.cmd status`（即 `node wb.js status`） |
| **调试启动** | `start.cmd`（前台，显示日志） |

浏览器访问 `http://127.0.0.1:8731/` 即进入工作台。首次打开选择所带班级。

## 二、环境要求与可迁移性

- **唯一依赖：Node.js**（≥ 14 即可）。DeepSeek Harness / OpenClaw 运行环境自带 Node，因此**整个文件夹拷到另一台电脑即可直接运行**。
- **零 npm 依赖**：服务端、CLI、前端全部使用 Node 标准库与原生浏览器 API，无需 `npm install`、无需联网。
- **无绝对路径**：所有路径相对本文件夹解析；数据目录默认为文件夹内的 `data\`，**移动文件夹 = 移动数据**。
- 端口可通过 `config.json` 或环境变量 `WB_PORT` 修改（默认 `127.0.0.1:8731`）。
- 服务只监听 `127.0.0.1`，不对外网开放。

## 三、数据存储（本地磁盘）

| 内容 | 位置 | 格式 |
|---|---|---|
| 业务记录 | `data\records\*.json` | 信封格式 `{version, updatedAt, data}`，每个业务键一个文件（如 `leave_requests.json`、`exams.json`、`editable_tables_v2.json`） |
| 附件 | `data\attachments\` | 真实文件 + 元数据 JSON |
| 定时备份 | `data\backup\` | 完整备份 JSON（`wb backup` / UI「本机数据」导出） |
| 服务日志 | `data\server.log`、`data\server-console.log` | |

浏览器页面本身**不再使用** localStorage / IndexedDB 作为数据源——前端通过本地 API 读写上面的磁盘文件（`js/remote-store.js` 适配器）。刷新/重启浏览器数据不丢；把 `data\` 单独拷走即是数据迁移。

## 四、AI 调用方式（双向：写入 + 读取）

### 1. CLI（推荐给 AI agent，`wb.cmd` / `node wb.js`）

```bash
node wb.js status                        # 状态总览（端口、数据量、服务是否运行）
node wb.js keys                          # 列出所有数据键
node wb.js get <key>                     # 读取某个键
node wb.js set <key> @file.json          # 写入（@file 最可靠，UTF-8 中文无损）
node wb.js del <key>                     # 删除
node wb.js export [file.json]            # 导出完整备份
node wb.js import <file.json> [--replace]  # 导入（默认合并，失败自动回滚）
node wb.js migrate <旧浏览器备份.json>     # 迁移旧备份（自动剥离命名空间前缀）
node wb.js backup                        # 生成带日期备份
node wb.js start | stop | serve          # 服务管理
```

**AI 录入示例**（把一份请假单写进工作台）：

```bash
# 1) 构造 JSON 文件（AI 直接写文件）
echo '{"id":"lv_ai_001","name":"张三","type":"事假","from":"2026-09-10","to":"2026-09-11","reason":"家庭事务","guardian":"张家长","status":"待批","appliedAt":"2026-09-03 08:00"}' > /tmp/leave.json
# 2) 合并写入 leave_requests（先读旧值再写回）
node wb.js get leave_requests > /tmp/old.json
# 3) 打开浏览器即可看到新请假单，班主任可点「批准/驳回」
```

常用业务键：`students`（学生档案表存于 `editable_tables_v2`）、`attendance`、`leave_requests`、`exams`、`homework`、`meeting_records`、`family_records`、`dorm_records`、`mental_records`、`quality_records`、`selection_data`、`tasks`、`form_tasks`、`ui_context`、`subject`、`user_records`、`workflow_updates`。

### 2. HTTP API（同一台机器的任何进程可调）

```
GET  /api/health                健康检查
GET  /api/store                 键列表（含大小/更新时间）
GET  /api/store/<key>           读键
PUT  /api/store/<key>           body={"version":2,"data":<值>}   写键
DELETE /api/store/<key>         删键
GET  /api/export                完整导出（homeroom-workbench-backup 格式）
POST /api/import[?replace=true] body=备份 JSON（失败自动回滚）
POST /api/clear                 body={"confirm":"确认清空"}
POST /api/backup                生成服务器端备份
GET  /api/attachments           附件列表（另有 /export /import 及单附件 GET/PUT/DELETE）
```

AI 读数据示例：`curl http://127.0.0.1:8731/api/export` 一次性取回全部业务数据做分析。

### 3. 直接读写文件

数据就是 `data\records\` 下的 JSON 文件，agent 也可以直接按信封格式读写（写文件后无需通知应用，页面刷新即读新值）。

## 五、旧数据迁移

- **旧浏览器备份 JSON**（此前从工作台 UI 导出的备份，含 `teacher_workbench:` 之类前缀键）：`node wb.js migrate <文件> [--replace]`——自动剥离命名空间前缀写入磁盘仓库，已测试 `teacher-workbench-backup` 格式。
- **本应用 UI 内**：「本机数据」→ 导入/导出/清空（服务端原子导入，失败回滚）。

## 六、技术构成

| 文件 | 作用 |
|---|---|
| `server.js` | 本地 HTTP 服务：静态托管 + 文件仓库 API + 附件 API（Node 标准库） |
| `lib/store.js` | 共享存储层（CLI 与服务端共用的唯一数据约定） |
| `wb.js` | CLI（数据操作直接读写磁盘，不依赖服务运行） |
| `app/` | 前端工作台（基于 skill 模板定制：高一班主任领域建模，12+8 个模块，22 类图表，可编辑表格，CSV 导入导出，完整备份恢复） |
| `app/js/remote-store.js` | 前端存储适配器：localStorage/IndexedDB → 本地 API |
| `start.vbs` / `stop.vbs` | 无控制台窗口的启动/停止 |
| `config.json` | 端口/目录配置 |
| `skill/` | build-professional-workbench skill 完整源码（已安装到本机技能目录） |

## 七、交付边界（诚实声明）

- **单机、单用户、本地离线**：无账号、无多用户协作、无云同步。
- **数据不加密**：`data\` 下的文件是明文 JSON。**不要存放密码、令牌等高敏信息**；共享电脑上他人可读取。
- **生产级能力未实现**：无权限体系、无审计日志、无灾备（请自行定期 `wb backup`）。
- **内置数据为演示种子**：学生名单、成绩等均为模拟数据，用于演示与教学；正式使用请通过导入/编辑替换为真实数据。
- 心理关注模块仅用于记录观察事实与跟进计划，不替代专业心理评估。

## 八、更新与维护（热补丁）

**更新采用热补丁形式，绝不会清空你的数据**：

- **前端/样式更新**（`app\` 下文件）：直接替换文件后**刷新浏览器**即可生效，`data\` 数据完全不动。
- **服务端/CLI 更新**（`server.js`、`wb.js`、`lib\`）：替换文件后执行 `wb stop` + `wb start` 即可，数据同样不动。
- **数据目录隔离**：开发与测试使用独立数据目录（环境变量 `WB_DATA`、端口 `WB_PORT`），永远不会读写你的真实 `data\`。
- 如需重置/清理数据，请明确要求后再操作；日常更新一律不动数据。

## 九、常见问题

- **首次打开先设置锁屏密码**：首次使用强制设置（不输入密码无法观看）；忘记密码删除 `data\records\lock_config.json`（或 `wb del lock_config`）重置。
- **双击启动无反应**：确认已安装 Node.js；查看 `data\server-console.log` 与 `data\server.log`。
- **端口被占用**：修改 `config.json` 的 `port`，或设置环境变量 `WB_PORT`。
- **想恢复模板自带的自定义光标**：删除 `app/css/premium-minimal.css` 末尾的两行覆盖即可（默认已恢复系统光标以保证任何环境下可操作）。

## 九、教务系统测试数据

`桌面\教务系统测试\` 内含模拟 50 人高一新生班级的 5 份 CSV（**记录点：谭悦瑶**），均匹配工作台导入格式（UTF-8+BOM、表头/列数一致），在对应模块点"导入 CSV"→"替换导入"即可：

| 文件 | 导入到 | 内容 |
|---|---|---|
| 01_学生名单_高一8班.csv | 学生档案 | 50 名学生（谭悦瑶第 1 行，重点关注） |
| 02_异常考勤_高一8班.csv | 考勤管理 | 6 条异常（含谭悦瑶迟到） |
| 03_宿舍信息_高一8班.csv | 宿舍管理 | 12 间宿舍（谭悦瑶为 A101 舍长） |
| 04_综合素质评价_高一8班.csv | 综合素质评价 | 50 人五维评价 |
| 05_选科意向_高一8班.csv | 选科意向 | 50 人 3+1+2 意向 |

生成脚本 `gen_test_csv.js` 可重复运行（数据确定性）。

## 十、许可

MIT。基于 [cylqwe7855-alt/build-professional-workbench](https://github.com/cylqwe7855-alt/build-professional-workbench)（原项目 MIT 许可）定制。
