# 🍳 OmniFocus MCP Enhanced — 示例大全

每个能力的完整 CLI 与 JSON 示例。这里是 [README](../README.zh.md) 的配套参考，
README 里只保留少量有代表性的片段。

大部分示例使用内置的 `omnifocus-cli` Skill 或 `mcporter`。MCP 客户端直接调用工具时，
参数完全相同。

---

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

批量编辑同理。每一项用 `taskId` 或 `projectId` 指定一个对象，只带上要改的字段——没写的字段保持原样，显式写 `null` 表示清空，日期可以给绝对值，也可以给带符号的偏移：

```bash
# 把三个任务推迟一周，其中一个加标签、清空估时
mcporter call omnifocus.batch_edit_items --args '{
  "items": [
    { "taskId": "abc123", "dueDateShift": "+1w" },
    { "taskId": "def456", "dueDateShift": "+1w", "flagged": true },
    { "taskId": "ghi789", "dueDateShift": "+1m", "addTags": ["深度工作"], "estimatedMinutes": null }
  ]
}'
```

偏移单位支持 `d`、`w`、`m`。月偏移会向目标月末收敛：1 月 31 日 +1 个月落在 2 月，而不是 3 月。对某个字段本来就没有值的任务做偏移，整个请求会失败，而不是凭空造一个日期。

`estimatedMinutes` 传 `null` 是清空估时，传 `0` 是存一个零分钟的估时——两者不同。

已完成和已放弃的任务会被拒绝：OmniFocus 对它们的写入是静默接受的，而批量操作悄悄改写已完成的工作，比直接拒绝更糟。单条的刻意修改请用 `edit_item`。

项目也走同一个工具，并且额外接受 `reviewInterval`，这是修改复习周期的方式：

```bash
# 一个项目改成每月复习，另一个改成每三天
mcporter call omnifocus.batch_edit_items --args '{
  "items": [
    { "projectId": "proj123", "reviewInterval": { "steps": 1, "unit": "months" } },
    { "projectId": "proj456", "reviewInterval": { "steps": 3, "unit": "days" } }
  ]
}'
```

`unit` 只接受 `days`、`weeks`、`months`、`years`。**复数形式很关键**：写成别的拼法时 OmniFocus 不报错，而是丢弃整次赋值、留下每周复习，所以工具会在写入前直接拒绝，而不是汇报一个它并没做成的改动。`steps` 至少为 1，原因相同——App 会把 `0` 和小数静默变成 `1`。下次复习日期由 OmniFocus 自己重算，复习间隔无法清空。

项目的 ID 与其 root task 的 ID 是同一个字符串，所以把项目 ID 当 `taskId` 传会被拒绝，而不是悄悄改到 root task 上。

传 `"dryRun": true` 可以先拿到完全相同的逐字段 diff，不写入任何东西。

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

---

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

## 📤 结构化输出

26 个工具中有 11 个在文本之外同时返回 MCP `structuredContent`，客户端可以直接把稳定 ID 和逐项结果当数据读，不必解析渲染出来的散文。文本本身没有变化——两者都返回，忽略结构化输出的客户端看到的和以前完全一样。

| 工具 | 结构化字段 |
| --- | --- |
| `filter_tasks` | `tasks`、`matchedCount`、`totalCount`、`hasMore`、`nextCursor` |
| `get_tasks` | `source`、`count`、`tasks`，另有 `groups`（forecast）、`matchedTags` / `availableTags`（tag）、`totalCount`（custom） |
| `get_projects` | `view`、`count`、`projects` |
| `manage_folders` | `action`，另有 `folders`、`folder`、`folderId`、`name`、`changedProperties`、`deletedProjectCount`、`deletedTaskCount` |
| `manage_tags` | `action`，另有 `tags`、`tagId`、`name`、`changedProperties`、`affectedTaskCount`、`childTagCount` |
| `count_tasks` | `total`、`byStatus` |
| `batch_edit_items` | `dryRun`、`items[]`（含逐字段验证过的 diff） |
| `batch_complete_tasks` | `items[]`（含状态、完成时间、重复任务新生成的实例） |
| `batch_move_tasks` | `movedCount`、`unchangedCount`、`results[]` |
| `batch_remove_items` | `removedCount`、`results[]`（含级联删除计数） |
| `batch_add_items` | `addedCount`、`failedCount`、`results[]`（每项带 `id` 或 `error`） |

一个 `filter_tasks` 的返回（节选）：

```json
{
  "content": [{ "type": "text", "text": "# 🔍 FILTERED TASKS\n\nFound 2 tasks..." }],
  "structuredContent": {
    "tasks": [
      { "id": "k0a5vlqi2qo", "name": "审阅草稿", "dueDate": "2026-09-15T09:00:00.000Z" }
    ],
    "matchedCount": 2,
    "totalCount": 2,
    "hasMore": false,
    "nextCursor": null
  }
}
```

两个需要知道的细节：

- **失败不带结构化内容。** 调用失败时返回 `isError: true` 和纯文本。MCP SDK 对错误结果豁免输出校验，所以没有任何 schema 描述错误形状——先读 `isError`。
- **混合操作的工具以 `action` 为键。** `manage_folders` 和 `manage_tags` 路由五个 action，返回的东西确实不同，所以只有 `action` 一定存在，其余都是可选的。先读 `action`，再读该 action 产出的字段。

其余 15 个工具仍然只返回文本。`dump_database` 是导出格式而不是供你挑选的结果，`read_task_attachment` 返回的是图片内容，剩下的是单条写入，其文本本身已经写明了受影响的 ID。
