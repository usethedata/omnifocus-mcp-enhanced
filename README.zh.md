# 🚀 OmniFocus MCP Enhanced

[![npm version](https://img.shields.io/npm/v/omnifocus-mcp-enhanced.svg)](https://www.npmjs.com/package/omnifocus-mcp-enhanced)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![macOS](https://img.shields.io/badge/macOS-only-blue.svg)](https://www.apple.com/macos/)

> **🌟 新功能：原生自定义透视访问与层级显示！**

> **将 OmniFocus 转换为 AI 驱动的生产力强化工具，支持自定义透视**

增强版 OmniFocus 模型上下文协议（MCP）服务器，具备**原生自定义透视访问**、层级任务显示、AI 优化工具选择和全面的任务管理功能。

说人话：它可以让你的 AI 助手直接读取 OmniFocus、创建任务和项目、拆子任务、查看透视、做每日规划，不需要你自己在 OmniFocus 里来回点很多次。

## 🌠 这个项目为什么存在

OmniFocus 本身已经很强了，但它大多数时候仍然是一个需要你手动操作的工具。

这个项目想做的，其实很简单：

- 少点很多次按钮，多用自然对话
- 少做手工整理，多让 AI 帮你规划
- 少记工具名，多直接说你想完成什么

目标不只是继续往外暴露更多 OmniFocus 命令。
更重要的是，让你以后可以这样使用 OmniFocus：

```text
帮我规划今天。
帮我清理 Inbox。
把这段笔记变成一个项目。
告诉我哪些事情卡住了。
把这批任务安全地重新整理一下。
```

如果 README 读到这里，你已经能感受到这个方向，那这段说明就有价值了。

如果你想继续看这个项目接下来准备往哪里走，可以直接看[路线图](https://github.com/jqlts1/omnifocus-mcp-enhanced/blob/main/docs/roadmap/2026-02-25-batch-move-tasks-plan.zh.md)。

## 🆕 版本发布

每个版本的完整说明见 [Releases 页面](https://github.com/jqlts1/omnifocus-mcp-enhanced/releases)。当前工具面：**26 个工具（其中 11 个带结构化输出）、6 个 Prompts、3 个 Resources**。

| 版本 | 日期 | 主要变化 |
| --- | --- | --- |
| **v2.3.0** | 2026-08-04 | 结构化输出：11 个工具在文本之外同时返回 MCP `structuredContent`，助手可以直接读到稳定 ID 和逐项结果，不必再解析散文。覆盖全部读取工具（`filter_tasks`、`get_tasks`、`get_projects`、`manage_folders`、`manage_tags`）、五个批量工具和 `count_tasks`。渲染文本保持不变 |
| **v2.2.0** | 2026-08-04 | `batch_edit_items`——单次验证事务内批量修改最多 100 个任务或项目的字段、标签、相对日期偏移和项目复习周期，失败回滚。同时修复互斥标签组（此前从未真正移除过冲突的同组标签），并移除复习间隔输出中恒为 false 的 `fixed` 字段 |
| **v2.1.1** | 2026-08-04 | 截止、推迟、计划日期保留具体时间，不再塌缩到零点 |
| **v2.1.0** | 2026-07-31 | `manage_perspectives` 可读取、解释并编辑自定义透视的筛选规则；Skill CLI 提速 2.1 倍 |
| **v2.0.0** | 2026-07-31 | **破坏性变更：** 41 个工具收敛为 25 个（`get_tasks`、`get_projects`、`manage_*`），旧工具名直接移除 |
| **v1.21.0** | 2026-07-29 | `batch_complete_tasks`——单次验证事务最多完成 100 个任务，失败回滚 |
| **v1.20.0** | 2026-07-29 | 重复规则处处可读可验证，创建时即可传入 `repetition` |
| **v1.19.0** | 2026-07-28 | `create_project_from_outline` 把确认过的方案一次建成完整项目树 |
| **v1.18.0** | 2026-07-28 | 可靠性：MCP SDK 1.30.0、Resource 快照有界、重建 `batch_remove_items` |
| **v1.17.1** | 2026-07-27 | 迁移到现代 MCP 注册 API，运行时基线提到 Node.js 22，npm 包 2.27 MB → 117 KB |
| **v1.17.0** | 2026-07-27 | `filter_tasks` 无状态游标分页 |
| **v1.16.0** | 2026-07-27 | `daily_review` 改为先精确计数，输出容量与截止风险 |
| **v1.15.0** | 2026-07-27 | `mark_projects_reviewed` 补齐每周回顾闭环 |
| **v1.14.0** | 2026-07-27 | `batch_move_tasks` 提供完整预检的安全 Inbox 整理 |

<details>
<summary><b>更早的版本</b>（v1.13.1 及以前）</summary>

| 版本 | 日期 | 主要变化 |
| --- | --- | --- |
| **v1.13.1** | 2026-07-26 | 服务端版本号改为从 `package.json` 读取，消除版本漂移 |
| **v1.13.0** | 2026-07-26 | 读取接口支持任务树：子任务计数与 `showSubtasks` / `maxSubtaskDepth` |
| **v1.12.0** | 2026-07-26 | `filter_tasks` / `count_tasks` 重建在统一 OmniJS 谓词上，新增 `get_projects` |
| **v1.11.1** | 2026-07-26 | `install-skill` 默认装到当前项目，`--global` 可切回全局 |
| **v1.11.0** | 2026-07-26 | 内置 `omnifocus-cli` Skill——用 shell 命令驱动，不必加载全部工具 schema |
| **v1.10.0** | 2026-07-25 | 标签管理、任务通知，以及 MCP Prompts 和 Resources |
| **v1.9.0** | 2026-07-25 | `append_to_note`、`count_tasks`、`duplicate_task` |
| **v1.8.0** | 2026-07-25 | Folder 管理：创建、重命名、移动和查看嵌套文件夹（v2.0.0 起合并为 `manage_folders`） |
| **v1.7.0** | 2026-07-24 | `set_repetition_rule`（OmniFocus 4.7+ ICS 规则）与 `exclusiveTags` |
| **v1.6.10** | 2026-03-22 | 修复 Inbox 任务完成、AppleScript 转义与 JSON 转义 |
| **v1.6.9** | 2026-03-17 | 任务附件支持：读取返回附件元数据，新增 `read_task_attachment` |
| **v1.6.8** | 2026-02-25 | `move_task` 支持稳定移动，带重名与环路保护 |
| **v1.6.6** | 2026-02-12 | Planned Date 全链路支持：创建、编辑、读取、筛选、排序、导出 |

</details>

## ✨ 核心特性

### 🌟 **新功能：原生自定义透视访问**

- **🎯 直接集成** - 通过 `Perspective.Custom` API 原生访问您的 OmniFocus 自定义透视
- **🌳 层级显示** - 树状任务可视化，显示父子关系
- **🧠 AI 优化** - 增强的工具描述防止 AI 混淆透视和标签概念
- **⚡ 零配置** - 与您现有的自定义透视无缝工作

### 🏗️ **完整任务管理**

- **🏗️ 完整子任务支持** - 创建带有父子关系的层级任务
- **🔍 内置透视** - 访问收件箱、已标记、预测和基于标签的视图
- **🚀 终极任务过滤器** - 超越 OmniFocus 原生功能的高级过滤
- **🎯 批量操作** - 高效添加/删除多个任务
- **📊 智能查询** - 通过 ID、名称或复杂条件查找任务
- **🔄 完整 CRUD 操作** - 创建、读取、更新、删除任务和项目
- **🌳 项目塑形** - 把确认过的文本方案安全创建为经过读回验证的完整项目树
- **💬 MCP Prompts** - 6 个引导式工作流（每日、每周、Inbox、项目规划、项目塑形、任务健康扫描）
- **🛠️ Agent Skill** - 本地 CLI 覆盖全部 26 个聚合工具，减少 AI 上下文占用
- **📅 时间管理** - 截止日期、推迟日期、计划日期、估时和计划
- **🏷️ 高级标签** - 基于标签的精确/模糊匹配过滤
- **🚫 互斥标签** - 应用标签时自动遵守互斥标签组规则
- **🔁 重复规则** - 完整支持 OmniFocus 4.7+ 重复任务（ICS 规则、重复方式、锚定日期、自动追平、结束日期、重复次数）
- **🤖 AI 集成** - 与 Claude AI 无缝集成，实现智能工作流
- **🖼️ 附件感知读取** - 先暴露备注附件和链接文件的元信息，再决定是否让 AI 继续查看附件内容

## 📦 安装

### 快速安装（推荐）

```bash
# 一键安装
claude mcp add omnifocus-enhanced -- npx -y omnifocus-mcp-enhanced
```

### 其他安装方式

```bash
# 升级到最新版
npm install -g omnifocus-mcp-enhanced@latest

# 全局安装
npm install -g omnifocus-mcp-enhanced
claude mcp add omnifocus-enhanced -- omnifocus-mcp-enhanced

# 本地项目安装
git clone https://github.com/jqlts1/omnifocus-mcp-enhanced.git
cd omnifocus-mcp-enhanced
npm install && npm run build
claude mcp add omnifocus-enhanced -- node "/path/to/omnifocus-mcp-enhanced/dist/server.js"
```

### 安装 Claude Skill（默认仅当前项目）

在希望使用 OmniFocus 的 Claude Code 项目根目录运行：

```bash
npx -y omnifocus-mcp-enhanced@latest install-skill
```

它会生成：

```text
当前项目/
├── .claude/skills/omnifocus-cli/
│   ├── SKILL.md
│   └── bin/omnifocus-enhanced.cjs
└── config/mcporter.json
```

只有确实希望所有项目都能使用时才执行：

```bash
npx -y omnifocus-mcp-enhanced@latest install-skill --global
```

安装器会以 `lifecycle: "keep-alive"` 注册 server，让多次调用复用同一个热进程，而不是每次重新解析 `npx -y` 并冷启；生成的 CLI 固定使用 Node 运行时，因此在 `PATH` 更窄的 shell 里同样可执行。

升级 server 后请重新运行 `install-skill` 来刷新 CLI。不要用 `mcporter generate-cli --from <bundle>`（即使 `mcporter inspect-cli` 这样建议）：它的回放元数据会丢掉 `lifecycle`，从而静默关闭 keep-alive，让每条命令的耗时翻倍。

keep-alive daemon 运行在生成 CLI 自己的配置上，所以直接执行 `mcporter daemon status` 读的是另一个文件，永远显示 “not running”。查看真正的 daemon：

```bash
npx -y mcporter@latest --config $(ls -t ~/.mcporter/generated/*.json | head -1) daemon status
```

## 📋 系统要求

- **macOS 10.15+** - OmniFocus 仅支持 macOS
- **OmniFocus 3+** - 必须安装并运行该应用程序
- **OmniFocus Pro** - 自定义透视功能需要 Pro 版本（v1.6.0 新功能）
- **Node.js 18+** - 运行 MCP 服务器
- **任意支持 MCP 的客户端** - 比如 Claude Code、`mcporter` 或其他 MCP Host

## 🚦 先看这里

如果你想最快理解这个项目，只要记住这 3 件事：

1. 把这个 MCP server 接到你的 AI 客户端里。
2. 直接用自然语言和 AI 说你要做什么。
3. 让 AI 帮你读 OmniFocus、整理任务、创建项目、拆子任务、做规划。

你一开始不需要背所有工具名。

## 🙋 这个项目最适合拿来做什么

- **每日规划**：让 AI 看今天到期、已标记、可快速完成的任务。
- **项目拆解**：给 AI 一个目标，让它自动建项目并拆成子任务。
- **Inbox 清理**：让 AI 帮你把收件箱分成“今天做 / 以后排 / 变项目”。
- **透视复盘**：让 AI 打开你的自定义透视并做总结。
- **批量录入**：把会议纪要、脑暴清单直接变成一批任务。
- **按需看附件**：先看任务有哪些附件，再决定要不要让 AI 打开。

## 💬 和大模型对话的示例

**这才是这个 server 的主要用法。** 你不需要手动调工具——直接跟助手说话，由它决定调哪个。
下面这些说法在 Claude Code、Claude Desktop 或任何接了同一个 server 的 MCP 客户端里都能直接用。

### 安排今天

```text
看一下我的 Forecast 和旗标任务，告诉我今天最重要的三件事。
优先选 60 分钟以内能做完的。
```

```text
打开我的自定义透视「今日工作安排」，帮我总结：
- 哪些快到期了
- 哪些看起来被卡住了
- 哪些能很快做完
```

### 清理收件箱

```text
看一遍我的 Inbox，把任务分成三类：
1. 今天就做
2. 之后再排
3. 应该变成项目
然后把明显的那些帮我清掉。
```

```text
把这段会议记录变成 OmniFocus 任务，放到「Website Refresh」项目下。
该用子任务的地方用子任务，任务名尽量短。
```

### 塑形和批量修改

```text
建一个叫「春季通讯发布」的项目。
把主要子任务加上，估好工时，最关键的那步打上旗标。
```

```text
「Website Refresh」整体延期一周。
先把受影响的任务列给我看，我确认之后再把每个截止日期都往后推 7 天。
```

```text
把「每周财务复盘」设成每周一上午 9 点重复，并在到期前 30 分钟提醒我。
```

### 回顾

```text
哪些项目该做回顾了？一个一个带我过，
我确认一个你就标记一个为已回顾。
```

```text
我的「Today」透视匹配到的东西太多了。
先把它背后的筛选规则列出来，逐条解释是什么意思，先别改。
```

### 处理附件

```text
找到叫「Review design draft」的任务。
先告诉我它有哪些附件。
只有确实存在图片附件时，才打开那个图片。
```

## 🧭 实用建议

- 如果你想更稳一点，可以先让 AI **先查看，再修改**。
- 如果有重名任务，优先用 **task ID**。
- 创建**子任务**时，让父任务决定项目，不要再额外传 `projectName`。
- 在 `mcporter` 里，复杂数组参数尽量用 `--args '{...}'`。

## 🎯 核心功能

| 能力 | 说明 | 主要工具 |
| --- | --- | --- |
| 🏗️ **子任务** | 任意深度的父子任务树，带可见子任务计数和按需展开 | `add_omnifocus_task`、`batch_add_items` |
| 🔍 **透视视图** | Inbox、Flagged、Forecast、Tags 作为一等读取能力 | `get_tasks` |
| 🌟 **自定义透视** | 不只读取自己的透视，还能编辑背后的筛选规则 | `get_tasks`（`source: "custom"`）、`manage_perspectives` |
| 🚀 **任务筛选** | 日期、工时、备注、标签、状态统一在一个 OmniJS 谓词里，支持游标分页 | `filter_tasks`、`count_tasks` |
| 🎯 **批量操作** | 单次事务最多 100 项，写前预检、写后验证、失败回滚 | `batch_add_items`、`batch_move_tasks`、`batch_complete_tasks`、`batch_edit_items`、`batch_remove_items` |
| 📐 **项目塑形** | 一份确认过的方案一次建成完整项目树 | `create_project_from_outline` |
| 🔁 **重复任务** | ICS 重复规则可读可写，逐字段验证 | `set_repetition_rule` |
| 🗂️ **Folder 与标签** | 嵌套层级，带环路保护和互斥标签组 | `manage_folders`、`manage_tags` |
| 📋 **回顾流程** | 使用 OmniFocus 原生回顾元数据，批量标记并验证 | `get_projects`、`mark_projects_reviewed` |
| 🖼️ **附件** | 先看元数据，需要时才打开图片 | `read_task_attachment` |
| 📤 **结构化输出** | 11 个工具在文本旁同时返回 `structuredContent`，ID 与逐项结果以数据形式到达 | `filter_tasks`、`get_tasks`、`get_projects`、`manage_folders`、`manage_tags`、`count_tasks`、五个 `batch_*` |

每一行对应的可运行示例都在 **[示例大全](https://github.com/jqlts1/omnifocus-mcp-enhanced/blob/main/docs/cookbook.zh.md)**。

## 🛠️ 完整工具参考——26 个工具

### 任务和项目操作

1. **dump_database** - 导出 OmniFocus 数据库
2. **add_omnifocus_task** - 创建单个任务，支持子任务与重复规则
3. **add_project** - 创建单个项目
4. **remove_item** - 删除任务或项目
5. **edit_item** - 编辑或调整任务/项目位置
6. **move_task** - 移动单个任务
7. **batch_move_tasks** - 原子移动用户确认的任务集合
8. **batch_complete_tasks** - 原子完成或恢复最多 100 个任务
9. **batch_edit_items** - 原子修改最多 100 个任务或项目的字段、标签与项目复习周期，支持相对日期偏移
10. **batch_add_items** - 批量创建任务或项目
11. **batch_remove_items** - 原子删除用户确认的项目集合
12. **create_project_from_outline** - 创建并验证完整项目树
13. **get_task_by_id** - 读取单个任务及附件元信息
14. **read_task_attachment** - 读取任务报告的某个附件
15. **get_tasks** - 通过 `source` 读取 Inbox、Flagged、Forecast、Tag 或自定义透视任务
16. **filter_tasks** - 按状态、日期、项目、标签和文本等筛选；`{ "completedToday": true }` 可查看今日完成
17. **get_projects** - 读取所有项目，或使用 `view=due_for_review` 读取待回顾项目
18. **mark_projects_reviewed** - 原子标记用户确认的项目为已回顾
19. **set_repetition_rule** - 设置、更新或清除任务重复规则

### 组织与生产力

20. **manage_perspectives** - `list`、`get` 或 `update` 自定义透视及其筛选规则
21. **manage_folders** - `list`、`get`、`add`、`edit` 或 `remove` Folder
22. **manage_tags** - `list`、`search`、`add`、`edit` 或 `remove` Tag
23. **manage_task_notifications** - `list`、`add` 或 `remove` 任务提醒
24. **append_to_note** - 追加任务/项目备注，不覆盖原内容
25. **count_tasks** - 使用筛选引擎统计任务
26. **duplicate_task** - 复制任务，可选择包含子任务

四个 `manage_*` 工具同时包含读取和写入，因此 MCP annotation 保守地标为破坏性；`list`、`get`、`search` 不会修改数据，`remove` 则必须遵循与独立删除工具相同的确认流程。`manage_perspectives` 不会创建或删除透视（OmniFocus 没有提供对应的自动化接口），唯一的写操作是原地编辑。

## 💬 MCP Prompts

| Prompt               | 参数      | 用途                                       |
| -------------------- | --------- | ------------------------------------------ |
| **daily_review**     | –         | 按精确统计和有界候选生成每日计划           |
| **weekly_review**    | –         | 完成项目风险检查和周回顾闭环               |
| **inbox_processing** | –         | 引导 Inbox 澄清、建议、确认和执行          |
| **project_planning** | `project` | 把已有项目拆成有顺序、带估时的下一步       |
| **project_shaping**  | –         | 把对话文本整理成经审阅、确认和验证的项目树 |

接下来的 AI 任务助手计划：[docs/plans/2026-07-27-ai-task-assistant-roadmap-design.md](https://github.com/jqlts1/omnifocus-mcp-enhanced/blob/main/docs/plans/2026-07-27-ai-task-assistant-roadmap-design.md)

## 🚀 快速开始示例

这里只放三个有代表性的调用。完整的工具、参数和 CLI 语法都在 **[示例大全](https://github.com/jqlts1/omnifocus-mcp-enhanced/blob/main/docs/cookbook.zh.md)**。

```bash
# 创建任务，带项目、截止日期和计划日期
add_omnifocus_task {
  "name": "Review quarterly goals",
  "projectName": "Planning",
  "dueDate": "2025-01-31",
  "plannedDate": "2025-01-28"
}

# 挂一个子任务——父任务决定它属于哪个项目
add_omnifocus_task {
  "name": "Design landing page",
  "parentTaskName": "Launch Product Campaign",
  "estimatedMinutes": 240,
  "flagged": true
}

# 找出真正做得完的高优先级工作
filter_tasks {
  "flagged": true,
  "taskStatus": ["Available"],
  "estimateMax": 120,
  "hasEstimate": true
}
```

其余内容都在 **[示例大全](https://github.com/jqlts1/omnifocus-mcp-enhanced/blob/main/docs/cookbook.zh.md)**：任务移动、自定义透视、Folder 与标签管理、通知、重复规则、批量操作和附件检查。

## 🔧 配置

### 验证安装

```bash
# 检查 MCP 状态
claude mcp list

# 测试基本连接
get_tasks {"source": "inbox"}

# 测试自定义透视访问
manage_perspectives {"action": "list"}
```

### 故障排除

- 确保 OmniFocus 3+ 已安装并运行
- 验证 Node.js 18+ 已安装
- 检查 Claude Code MCP 配置
- 如需要，为终端应用启用辅助功能权限

## 🎯 使用场景

- **项目管理** - 创建带子任务的详细项目层级
- **GTD 工作流** - 利用透视进行 Getting Things Done 方法论
- **时间块规划** - 按估时过滤进行计划安排
- **回顾流程** - 使用自定义透视进行周/月回顾
- **团队协调** - 批量操作进行团队任务分配
- **AI 驱动规划** - 让 Claude 分析和组织您的任务

## 📈 性能

- **快速过滤** - 原生 AppleScript 性能
- **批量效率** - 多任务单次操作
- **内存优化** - 最小资源使用
- **可扩展** - 高效处理大型任务数据库

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 仓库
2. 创建功能分支
3. 进行更改
4. 如适用，添加测试
5. 提交 pull request

## 📄 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🔗 链接

- **NPM 包**: https://www.npmjs.com/package/omnifocus-mcp-enhanced
- **示例大全**（全部 CLI/JSON 示例）: [docs/cookbook.zh.md](https://github.com/jqlts1/omnifocus-mcp-enhanced/blob/main/docs/cookbook.zh.md)
- **GitHub 仓库**: https://github.com/jqlts1/omnifocus-mcp-enhanced
- **OmniFocus**: https://www.omnigroup.com/omnifocus/
- **模型上下文协议**: https://modelcontextprotocol.io/
- **Claude Code**: https://docs.anthropic.com/en/docs/claude-code

## 🙏 致谢

基于 [themotionmachine](https://github.com/themotionmachine/OmniFocus-MCP) 的原始 OmniFocus MCP 服务器。增强了透视视图、高级过滤和完整的子任务支持。

---

**⭐ 如果这个项目帮助提升了您的生产力，请给仓库点个星！**
