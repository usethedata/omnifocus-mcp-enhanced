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

如果你想继续看这个项目接下来准备往哪里走，可以直接看[路线图](docs/roadmap/2026-02-25-batch-move-tasks-plan.zh.md)。

## 🆕 版本发布

每个版本的完整说明见 [Releases 页面](https://github.com/jqlts1/omnifocus-mcp-enhanced/releases)。当前工具面：**26 个工具、5 个 Prompts、3 个 Resources**。

| 版本 | 日期 | 主要变化 |
| --- | --- | --- |
| **v2.2.0** | 2026-08-04 | `batch_edit_items`——单次验证事务内批量修改最多 100 个任务的字段、标签和相对日期偏移，失败回滚。同时修复互斥标签组：此前从未真正移除过冲突的同组标签 |
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
| **v1.8.0** | 2026-07-25 | Folder 管理：`add_folder`、`edit_folder`、`remove_folder`、`list_folders`、`get_folder` |
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
- **💬 MCP Prompts** - 5 个引导式工作流（每日、每周、Inbox、项目规划、项目塑形）
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

下面这些说法，在 Claude Code 或其他支持 MCP 的客户端里都很适合直接用。

### 1. 每日规划

你可以直接说：

```text
看看我今天的 Forecast 和已标记任务，然后告诉我今天最重要的 3 件事。
优先考虑 60 分钟以内能完成的任务。
```

### 2. 清理 Inbox

你可以直接说：

```text
帮我看一下 Inbox，把这些任务分成：
1. 今天做
2. 以后安排
3. 应该升级成项目
然后顺手把明显的项整理掉。
```

### 3. 把一个想法变成项目

你可以直接说：

```text
创建一个项目，名字叫“春季 newsletter 发布”。
把主要步骤拆成子任务，补上预计时间，并把最关键的一步设成 flagged。
```

### 4. 使用自定义透视

你可以直接说：

```text
打开我的自定义透视“今日工作安排”，帮我总结：
- 哪些快到期
- 哪些像是卡住了
- 哪些可以快速做完
```

### 5. 根据笔记批量创建任务

你可以直接说：

```text
把这段会议纪要整理成 OmniFocus 任务，放到“网站改版”项目下。
该拆成子任务的就拆，任务名尽量简短。
```

### 6. 只在需要时查看附件

你可以直接说：

```text
找到“检查设计稿”这个任务。
先告诉我它有哪些附件。
如果里面有图片，再帮我打开图片附件。
```

## 🧭 实用建议

- 如果你想更稳一点，可以先让 AI **先查看，再修改**。
- 如果有重名任务，优先用 **task ID**。
- 创建**子任务**时，让父任务决定项目，不要再额外传 `projectName`。
- 在 `mcporter` 里，复杂数组参数尽量用 `--args '{...}'`。

## 🎯 核心功能

### 1. 🏗️ 子任务管理

轻松创建复杂的任务层级：

```json
// 通过父任务名称创建子任务
{
  "name": "分析竞争对手关键词",
  "parentTaskName": "SEO 策略",
  "note": "重点关注前 10 名竞争对手",
  "dueDate": "2025-01-15",
  "estimatedMinutes": 120,
  "tags": ["SEO", "研究"]
}

// 通过父任务 ID 创建子任务
{
  "name": "编写内容大纲",
  "parentTaskId": "loK2xEAY4H1",
  "flagged": true,
  "estimatedMinutes": 60
}
```

### 2. 🔍 透视视图

程序化访问所有主要 OmniFocus 透视：

```bash
# 收件箱透视
get_tasks {"source": "inbox", "hideCompleted": true}

# 已标记任务
get_tasks {"source": "flagged", "projectFilter": "SEO 项目"}

# 预测（未来 7 天）
get_tasks {"source": "forecast", "days": 7, "hideCompleted": true}

# 按标签查找任务
get_tasks {"source": "tag", "tagName": "AI", "exactMatch": false}

# 每条结果都会显示直属子任务数量；需要时再展开任务树
get_tasks {"source": "inbox", "showSubtasks": true, "maxSubtaskDepth": 2}
```

`showSubtasks` 默认为 `false`。`maxSubtaskDepth` 必须是非负整数：`0` 不展开，`1` 只显示直属子任务，不传则允许完整递归。列表命令对子任务沿用完成状态可见性规则；展开的子任务用于说明结构，本身不需要命中顶层过滤条件。

详细任务读取会保留实际分配的叶标签，并显示完整层级路径。例如任务分配的是“团队”下的“守一”，输出显示为 `团队 / 守一`；结构化结果保留叶标签的 `id`/`name`，并新增 `path` 与 `ancestorIds`。Compact 输出仍省略标签。

### 3. 🚀 终极任务过滤器

创建任何可想象的透视，使用高级过滤：

```bash
# 时间管理视图（本周截止的 30 分钟任务）
filter_tasks {
  "taskStatus": ["Available", "Next"],
  "estimateMax": 30,
  "dueThisWeek": true
}

# 深度工作视图（60+ 分钟带备注的任务）
filter_tasks {
  "estimateMin": 60,
  "hasNote": true,
  "taskStatus": ["Available"]
}

# 计划日期视图（今天计划任务）
filter_tasks {
  "plannedToday": true,
  "sortBy": "plannedDate"
}

# 项目逾期任务
filter_tasks {
  "projectFilter": "网站重设计",
  "taskStatus": ["Overdue", "DueSoon"]
}

# 保持相同匹配规则，同时展示两层任务结构
filter_tasks {
  "flagged": true,
  "showSubtasks": true,
  "maxSubtaskDepth": 2
}

# 每日规划的紧凑型广泛发现（不返回备注和完整标签）
filter_tasks {
  "plannedToday": true,
  "limit": 30,
  "outputMode": "compact"
}
```

`daily_review` 是一句话每日规划入口，可选传入 `availableMinutes`；不传时不会假设一天有八小时。它会先精确统计，再有界读取候选任务，在条件允许时自动选择三个重点，并固定输出 `今日重点`、`可执行下一步`、`阻塞项` 和 `容量/截止风险`。所有 OmniFocus 调整建议会合并成一次确认请求。

当筛选结果还有更多任务时，`filter_tasks` 会返回不透明的下一页游标。使用相同筛选和排序参数原样传回：

```json
{
  "flagged": true,
  "limit": 30,
  "sortBy": "dueDate",
  "outputMode": "compact",
  "cursor": "<下一页游标>"
}
```

修改筛选或排序会使游标失效；翻页时可以修改 `limit`、`outputMode` 和任务树展示参数。每页都会读取 OmniFocus 当前状态，因此这是实时最佳努力分页，而不是固定快照。

### 4. 🌟 **新功能：原生自定义透视访问**

通过层级任务显示访问您的 OmniFocus 自定义透视：

```bash
# 列出所有自定义透视
manage_perspectives {"action": "list"}

# 读取透视的筛选规则，并以自然语言解释
manage_perspectives {"action": "get", "name": "今日工作安排"}

# 🌳 新功能：项目树视图（默认）
get_tasks {
  "source": "custom",
  "perspectiveName": "今日工作安排",  # 您的自定义透视名称
  "displayMode": "project_tree",    # project_tree | task_tree | flat
  "hideCompleted": true
}

# 全局任务树（等价于旧参数 showHierarchy=true）
get_tasks {
  "source": "custom",
  "perspectiveName": "今日复盘",
  "displayMode": "task_tree"
}

# 平铺视图（等价于旧参数 groupByProject=false）
get_tasks {
  "source": "custom",
  "perspectiveName": "本周项目",
  "displayMode": "flat"
}
```

**功能强大的原因：**

- ✅ **原生集成** - 直接使用 OmniFocus `Perspective.Custom` API
- ✅ **树状结构** - 使用 ├─、└─ 符号显示父子任务关系
- ✅ **项目优先分组** - 先按项目分组，再展示子任务层级
- ✅ **信息表达清晰** - 详细任务读取展示完整备注和 `#团队 / 守一` 形式的标签路径；Compact 仍省略标签
- ✅ **AI 友好** - 增强的描述防止工具选择混淆
- ✅ **专业输出** - 清晰、可读的任务层级

### 5. 🎯 批量操作

高效管理多个任务：

```json
{
  "items": [
    {
      "type": "task",
      "name": "网站技术 SEO",
      "projectName": "SEO 项目",
      "note": "优化技术方面"
    },
    {
      "type": "task",
      "name": "页面速度优化",
      "parentTaskName": "网站技术 SEO",
      "estimatedMinutes": 180,
      "flagged": true
    },
    {
      "type": "task",
      "name": "移动端响应式",
      "parentTaskName": "网站技术 SEO",
      "estimatedMinutes": 90
    }
  ]
}
```

`mcporter` 调用提示：

```bash
# 复杂数组 / 嵌套对象，建议明确使用 --args JSON
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "网站技术 SEO",
      "projectName": "SEO 项目"
    }
  ]
}'
```

如果某条子任务传了 `parentTaskId` 或 `parentTaskName`，就不要再传 `projectName`。子任务会自动继承父任务所在项目。

可直接运行的 `mcporter` 示例：

```bash
# 1）批量创建项目下的顶层任务
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "父任务：分类A",
      "projectName": "OmniFocus MCP 批量测试"
    },
    {
      "type": "task",
      "name": "父任务：分类B",
      "projectName": "OmniFocus MCP 批量测试"
    }
  ]
}'
```

```bash
# 2）单次批量里同时创建父任务和子任务
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "父任务：分类A",
      "projectName": "OmniFocus MCP 批量测试"
    },
    {
      "type": "task",
      "name": "子任务：A1",
      "parentTaskName": "父任务：分类A"
    }
  ]
}'
```

```bash
# 3）更稳妥的两步法：父任务已存在时，再批量创建多个子任务
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "子任务：A1",
      "parentTaskName": "父任务：分类A"
    },
    {
      "type": "task",
      "name": "子任务：A2",
      "parentTaskName": "父任务：分类A"
    },
    {
      "type": "task",
      "name": "子任务：B1",
      "parentTaskName": "父任务：分类B"
    }
  ]
}'
```

下面这种写法会失败，这属于预期行为：

```bash
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "子任务：A1",
      "projectName": "OmniFocus MCP 批量测试",
      "parentTaskName": "父任务：分类A"
    }
  ]
}'
```

因为子任务必须继承父任务所在项目，不能再单独传 `projectName`。

### 6. 项目塑形

使用 `project_shaping` 把会议纪要、脑暴或任务清单整理成可读的项目树。助手会标明推断出的元数据，解析 Folder 与 Tag 的稳定 ID，并在调用一次 `create_project_from_outline` 前，要求用户明确确认最终项目树。

```json
{
  "project": {
    "name": "发布新网站",
    "folderId": "folder-id",
    "tagIds": ["tag-id"],
    "sequential": true,
    "tasks": [
      {
        "name": "确认信息架构",
        "estimatedMinutes": 60,
        "children": [{ "name": "评审导航" }]
      }
    ]
  }
}
```

操作工具只接受经过审阅的结构化字段，不接收原始会议纪要。最多支持 200 个任务、8 层任务层级。引用缺失时零写入；执行或读回验证失败时仅执行一次受限 OmniFocus Undo；如果无法确认清理完整，错误会返回残留项目 ID。

### 7. 重复任务

重复规则现在是一等字段：创建、读取、修改、清除都会经过验证。

```json
{
  "name": "每周行政检查清单",
  "repetition": {
    "ruleString": "FREQ=WEEKLY;BYDAY=FR",
    "scheduleType": "Regularly",
    "anchorDateKey": "DueDate",
    "catchUpAutomatically": true
  }
}
```

- `add_omnifocus_task` 和 `create_project_from_outline` 的任务节点使用同一个对象。`UNTIL` 和 `COUNT` 请编码进 `ruleString`；已废弃的 `method` 参数不对外暴露。
- `get_task_by_id` 返回已保存的规则和下次发生时间；列表读取只增加 `isRepeating`，保持响应精简。
- `set_repetition_rule` 会逐字段验证保存结果。写入失败或不匹配时恢复原规则；无法确认恢复时，错误会指出需要人工检查的任务。
- 创建过程中验证失败会删除该任务，或回滚整棵项目树，确保不会留下用户没有确认过的重复规则。

### 8. 🖼️ 附件查看

先读取任务和附件元信息，再按需打开具体附件：

```bash
# 读取任务详情和附件元信息
get_task_by_id {
  "taskId": "abc123"
}

# 打开 get_task_by_id 返回的某个附件
read_task_attachment {
  "taskId": "abc123",
  "attachmentId": "embedded-1"
}
```

`get_task_by_id` 现在会返回附件 ID、名称、推断出的 MIME 类型、来源（`embedded` 或 `linked`）以及可用时的大小。`read_task_attachment` 会尽量把图片作为 MCP 图片内容直接返回，这样 AI 客户端可以直接查看图片，而不是只能读一段 base64 文本。

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
9. **batch_edit_items** - 原子修改最多 100 个任务的字段与标签，支持相对日期偏移
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

接下来的 AI 任务助手计划：[docs/plans/2026-07-27-ai-task-assistant-roadmap-design.md](docs/plans/2026-07-27-ai-task-assistant-roadmap-design.md)

## 🚀 快速开始示例

### 基础任务创建

```bash
# 简单任务
add_omnifocus_task {
  "name": "回顾季度目标",
  "projectName": "规划",
  "dueDate": "2025-01-31",
  "plannedDate": "2025-01-28"
}
```

### 高级任务管理

```bash
# 创建父任务
add_omnifocus_task {
  "name": "启动产品活动",
  "projectName": "营销",
  "dueDate": "2025-02-15",
  "tags": ["活动", "优先级"]
}

# 添加子任务
add_omnifocus_task {
  "name": "设计落地页",
  "parentTaskName": "启动产品活动",
  "estimatedMinutes": 240,
  "flagged": true
}
```

### 任务转移操作

```bash
# 转移到项目
move_task {
  "id": "task-id-123",
  "targetProjectName": "规划"
}

# 转移到父任务下
move_task {
  "id": "task-id-123",
  "targetParentTaskId": "parent-task-id-456"
}

# 转移回 Inbox
move_task {
  "id": "task-id-123",
  "targetInbox": true
}

# 用户确认整理方案后，一次原子执行整批移动
batch_move_tasks {
  "moves": [
    { "taskId": "task-1", "projectId": "project-1" },
    { "taskId": "task-2", "parentTaskId": "parent-task-1" }
  ]
}
```

`batch_move_tasks` 只接受稳定 ID，会在修改前验证完整方案、拒绝循环移动和无效目标，并在执行后验证每个任务的最终位置。预检失败时不会移动任何任务；只有用户确认已经展示的整理方案后才应调用。

### 智能任务发现

```bash
# 找到高优先级工作
filter_tasks {
  "flagged": true,
  "taskStatus": ["Available"],
  "estimateMax": 120,
  "hasEstimate": true
}

# 今日完成的工作
filter_tasks {
  "completedToday": true,
  "taskStatus": ["Completed"],
  "sortBy": "project"
}
```

### 🌟 自定义透视使用

```bash
# 列出您的自定义透视
manage_perspectives {"action": "list"}

# 访问带项目树的自定义透视
get_tasks {
  "source": "custom",
  "perspectiveName": "今日复盘",
  "displayMode": "project_tree",
  "hideCompleted": true
}

# 快速查看周计划的平铺视图
get_tasks {
  "source": "custom",
  "perspectiveName": "本周项目",
  "displayMode": "flat"
}
```

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
- **GitHub 仓库**: https://github.com/jqlts1/omnifocus-mcp-enhanced
- **OmniFocus**: https://www.omnigroup.com/omnifocus/
- **模型上下文协议**: https://modelcontextprotocol.io/
- **Claude Code**: https://docs.anthropic.com/en/docs/claude-code

## 🙏 致谢

基于 [themotionmachine](https://github.com/themotionmachine/OmniFocus-MCP) 的原始 OmniFocus MCP 服务器。增强了透视视图、高级过滤和完整的子任务支持。

---

**⭐ 如果这个项目帮助提升了您的生产力，请给仓库点个星！**
