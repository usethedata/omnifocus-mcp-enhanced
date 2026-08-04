# 🍳 OmniFocus MCP Enhanced — Cookbook

Complete CLI and JSON examples for every capability. This is the reference companion to
the [README](../README.md), which keeps only a few representative snippets.

Most examples use the bundled `omnifocus-cli` agent skill or `mcporter`. The same
arguments work when an MCP client calls the tools directly.

---

## 🎯 Core Capabilities

### 1. 🏗️ Subtask Management

Create complex task hierarchies with ease:

```json
// Create subtask by parent task name
{
  "name": "Analyze competitor keywords",
  "parentTaskName": "SEO Strategy",
  "note": "Focus on top 10 competitors",
  "dueDate": "2025-01-15",
  "estimatedMinutes": 120,
  "tags": ["SEO", "Research"]
}

// Create subtask by parent task ID
{
  "name": "Write content outline",
  "parentTaskId": "loK2xEAY4H1",
  "flagged": true,
  "estimatedMinutes": 60
}
```

### 2. 🔍 Perspective Views

Access all major OmniFocus perspectives programmatically:

```bash
# Inbox perspective
get_tasks {"source": "inbox", "hideCompleted": true}

# Flagged tasks
get_tasks {"source": "flagged", "projectFilter": "SEO Project"}

# Forecast (next 7 days)
get_tasks {"source": "forecast", "days": 7, "hideCompleted": true}

# Tasks by tag
get_tasks {"source": "tag", "tagName": "AI", "exactMatch": false}

# Every result shows its direct subtask count; expand the task tree on demand
get_tasks {"source": "inbox", "showSubtasks": true, "maxSubtaskDepth": 2}
```

`showSubtasks` defaults to `false`. `maxSubtaskDepth` is a non-negative integer: `0` expands nothing, `1` shows direct children, and omitting it allows full recursion. List commands apply their completed-task visibility to descendants. Expanded descendants provide structure and do not need to match the top-level filter themselves.

Detailed task reads preserve the assigned leaf tag and show its full hierarchy path. For example, a task assigned `守一` under `团队` is rendered as `团队 / 守一`; structured results retain the leaf `id`/`name` and add `path` plus `ancestorIds`. Compact output continues to omit tags.

### 3. 🚀 Ultimate Task Filter

Create any perspective imaginable with advanced filtering:

```bash
# Time management view (30min tasks due this week)
filter_tasks {
  "taskStatus": ["Available", "Next"],
  "estimateMax": 30,
  "dueThisWeek": true
}

# Deep work view (60+ minute tasks with notes)
filter_tasks {
  "estimateMin": 60,
  "hasNote": true,
  "taskStatus": ["Available"]
}

# Planned work view (tasks planned for today)
filter_tasks {
  "plannedToday": true,
  "sortBy": "plannedDate"
}

# Project overdue tasks
filter_tasks {
  "projectFilter": "Website Redesign",
  "taskStatus": ["Overdue", "DueSoon"]
}

# Keep the same matching rules, but include two levels of task structure
filter_tasks {
  "flagged": true,
  "showSubtasks": true,
  "maxSubtaskDepth": 2
}

# Compact broad discovery for planning (omits notes and full tags)
filter_tasks {
  "plannedToday": true,
  "limit": 30,
  "outputMode": "compact"
}
```

`daily_review` is the one-step daily-planning Prompt. Optionally provide `availableMinutes`; when omitted, it does not assume an eight-hour day. It starts with exact counts, reads bounded candidates, selects exactly three priorities when possible, and returns `今日重点`, `可执行下一步`, `阻塞项`, and `容量/截止风险`. Any proposed OmniFocus changes are grouped into one confirmation request.

When a filtered result has more tasks, `filter_tasks` returns an opaque next cursor. Pass it back with the same filters and sorting:

```json
{
  "flagged": true,
  "limit": 30,
  "sortBy": "dueDate",
  "outputMode": "compact",
  "cursor": "<next cursor>"
}
```

Changing filters or sorting invalidates the cursor. `limit`, `outputMode`, and task-tree rendering may change between pages. Each page reads current OmniFocus state, so pagination is real-time best effort rather than a snapshot.

### 4. 🌟 **NEW: Native Custom Perspective Access**

Access your OmniFocus custom perspectives with hierarchical task display:

```bash
# List all your custom perspectives
manage_perspectives {"action": "list"}

# Read a perspective's filter rules, explained in plain language
manage_perspectives {"action": "get", "name": "今日工作安排"}

# 🌳 NEW: Project tree view (default)
get_tasks {
  "source": "custom",
  "perspectiveName": "今日工作安排",  # Your custom perspective name
  "displayMode": "project_tree",    # project_tree | task_tree | flat
  "hideCompleted": true
}

# Global task tree (legacy showHierarchy=true equivalent)
get_tasks {
  "source": "custom",
  "perspectiveName": "Today Review",
  "displayMode": "task_tree"
}

# Flat list (legacy groupByProject=false equivalent)
get_tasks {
  "source": "custom",
  "perspectiveName": "Weekly Planning",
  "displayMode": "flat"
}
```

**Why This Is Powerful:**

- ✅ **Native Integration** - Uses OmniFocus `Perspective.Custom` API directly
- ✅ **Tree Structure** - Visual parent-child task relationships with ├─, └─ symbols
- ✅ **Project-First Grouping** - Project header first, then nested subtasks
- ✅ **Readable Metadata** - Detailed task reads show full notes and hierarchical tag paths such as `#Team / Member`; compact reads still omit tags
- ✅ **AI-Friendly** - Enhanced descriptions prevent tool selection confusion
- ✅ **Professional Output** - Clean, readable task hierarchies

### 5. 🎯 Batch Operations

Efficiently manage multiple tasks:

```json
{
  "items": [
    {
      "type": "task",
      "name": "Website Technical SEO",
      "projectName": "SEO Project",
      "note": "Optimize technical aspects"
    },
    {
      "type": "task",
      "name": "Page Speed Optimization",
      "parentTaskName": "Website Technical SEO",
      "estimatedMinutes": 180,
      "flagged": true
    },
    {
      "type": "task",
      "name": "Mobile Responsiveness",
      "parentTaskName": "Website Technical SEO",
      "estimatedMinutes": 90
    }
  ]
}
```

CLI tip for `mcporter`:

```bash
# Prefer explicit JSON args for complex arrays / nested objects
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "Website Technical SEO",
      "projectName": "SEO Project"
    }
  ]
}'
```

If you pass a subtask with `parentTaskId` or `parentTaskName`, do not also pass `projectName`. Subtasks inherit the project from their parent task.

Working `mcporter` examples:

```bash
# 1) Batch-create top-level tasks in a project
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "Parent: Category A",
      "projectName": "OmniFocus MCP Batch Test"
    },
    {
      "type": "task",
      "name": "Parent: Category B",
      "projectName": "OmniFocus MCP Batch Test"
    }
  ]
}'
```

```bash
# 2) Create parent + child in one batch
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "Parent: Category A",
      "projectName": "OmniFocus MCP Batch Test"
    },
    {
      "type": "task",
      "name": "Child: A1",
      "parentTaskName": "Parent: Category A"
    }
  ]
}'
```

```bash
# 3) Safer two-step flow when adding many subtasks to existing parents
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "Child: A1",
      "parentTaskName": "Parent: Category A"
    },
    {
      "type": "task",
      "name": "Child: A2",
      "parentTaskName": "Parent: Category A"
    },
    {
      "type": "task",
      "name": "Child: B1",
      "parentTaskName": "Parent: Category B"
    }
  ]
}'
```

This will fail, by design:

```bash
mcporter call omnifocus.batch_add_items --args '{
  "items": [
    {
      "type": "task",
      "name": "Child: A1",
      "projectName": "OmniFocus MCP Batch Test",
      "parentTaskName": "Parent: Category A"
    }
  ]
}'
```

Because a subtask must inherit its project from the parent task.

Editing a set of tasks works the same way. Each item names one object with
`taskId` or `projectId` and carries only the fields it changes — an omitted field
is untouched, an explicit `null` clears it, and dates take either an absolute
value or a signed shift:

```bash
# Push three tasks out a week, retag one, and clear an estimate
mcporter call omnifocus.batch_edit_items --args '{
  "items": [
    { "taskId": "abc123", "dueDateShift": "+1w" },
    { "taskId": "def456", "dueDateShift": "+1w", "flagged": true },
    { "taskId": "ghi789", "dueDateShift": "+1m", "addTags": ["Deep Work"], "estimatedMinutes": null }
  ]
}'
```

Shifts accept `d`, `w`, and `m`. A month shift clamps to the target month end, so
31 January plus one month lands in February rather than March. A shift against a
task that has no value in that field fails the whole request instead of inventing
a date.

Preview a large edit before applying it with `"dryRun": true`, which returns the
same per-field diff and writes nothing.

Completed and dropped tasks are refused: OmniFocus accepts writes to them
silently, and a bulk edit that quietly rewrites finished work is worse than a
refusal. Use `edit_item` for a single deliberate change.

Projects work the same way and additionally accept `reviewInterval`, which is how
you change review cadence:

```bash
# Review one project monthly instead of weekly, and another every three days
mcporter call omnifocus.batch_edit_items --args '{
  "items": [
    { "projectId": "proj123", "reviewInterval": { "steps": 1, "unit": "months" } },
    { "projectId": "proj456", "reviewInterval": { "steps": 3, "unit": "days" } }
  ]
}'
```

`unit` must be `days`, `weeks`, `months`, or `years`. The plural matters: given
any other spelling OmniFocus discards the whole assignment without an error and
leaves a weekly interval, so the tool rejects it up front rather than reporting a
change it did not make. `steps` must be at least 1 for the same reason — the app
silently coerces `0` and fractions to `1`. OmniFocus recomputes the next review
date itself, and the interval cannot be cleared.

A project's ID and its root task's ID are the same string, so passing a project
ID as `taskId` is rejected rather than silently editing the root task.

### 6. Project Shaping

Use `project_shaping` to turn meeting notes, brainstorming, or a task list into a readable project tree. The assistant labels inferred metadata, resolves Folder and Tag stable IDs, and asks for explicit confirmation of the final tree before calling `create_project_from_outline` once.

```json
{
  "project": {
    "name": "Website launch",
    "folderId": "folder-id",
    "tagIds": ["tag-id"],
    "sequential": true,
    "tasks": [
      {
        "name": "Confirm information architecture",
        "estimatedMinutes": 60,
        "children": [{ "name": "Review navigation" }]
      }
    ]
  }
}
```

The action accepts structured, reviewed fields—not raw meeting notes. It supports at most 200 tasks and eight task levels. Missing references cause zero writes. Execution or read-back failure triggers one bounded OmniFocus Undo; if cleanup cannot be confirmed, the error includes the residual project ID.

### 7. Repeating Tasks

Repetition is a first-class field. Create it, read it, change it, and clear it—all verified.

```json
{
  "name": "Weekly admin checklist",
  "repetition": {
    "ruleString": "FREQ=WEEKLY;BYDAY=FR",
    "scheduleType": "Regularly",
    "anchorDateKey": "DueDate",
    "catchUpAutomatically": true
  }
}
```

- `add_omnifocus_task` and task nodes of `create_project_from_outline` accept the same object. `UNTIL` and `COUNT` belong inside `ruleString`; the deprecated `method` parameter is never exposed.
- `get_task_by_id` reports the stored rule plus the next occurrence. List reads add only `isRepeating`, so broad queries stay small.
- `set_repetition_rule` verifies the saved rule field by field. A failed write or mismatch restores the previous rule; if restoration cannot be confirmed, the error names the task that needs manual review.
- A verification failure during creation removes the task, or rolls back the whole project tree, so no item keeps a recurrence the user did not confirm.

### 8. 🖼️ Attachment Inspection

Discover images and linked files on a task first, then read only the attachment you need:

```bash
# List task details plus attachment metadata
get_task_by_id {
  "taskId": "abc123"
}

# Open an attachment returned by get_task_by_id
read_task_attachment {
  "taskId": "abc123",
  "attachmentId": "embedded-1"
}
```

`get_task_by_id` now reports attachment IDs, names, MIME guesses, source (`embedded` vs `linked`), and sizes when available. `read_task_attachment` returns images as MCP image content when possible, so AI clients can inspect the image directly instead of parsing base64 from plain text.

---

## 🚀 Quick Start Examples

### Basic Task Creation

```bash
# Simple task
add_omnifocus_task {
  "name": "Review quarterly goals",
  "projectName": "Planning",
  "dueDate": "2025-01-31",
  "plannedDate": "2025-01-28"
}
```

### Advanced Task Management

```bash
# Create parent task
add_omnifocus_task {
  "name": "Launch Product Campaign",
  "projectName": "Marketing",
  "dueDate": "2025-02-15",
  "tags": ["Campaign", "Priority"]
}

# Add subtasks
add_omnifocus_task {
  "name": "Design landing page",
  "parentTaskName": "Launch Product Campaign",
  "estimatedMinutes": 240,
  "flagged": true
}
```

### Task Move Operations

```bash
# Move task to a project
move_task {
  "id": "task-id-123",
  "targetProjectName": "Planning"
}

# Move task under another task
move_task {
  "id": "task-id-123",
  "targetParentTaskId": "parent-task-id-456"
}

# Move task back to inbox
move_task {
  "id": "task-id-123",
  "targetInbox": true
}

# Execute a user-confirmed organization plan as one atomic batch
batch_move_tasks {
  "moves": [
    { "taskId": "task-1", "projectId": "project-1" },
    { "taskId": "task-2", "parentTaskId": "parent-task-1" }
  ]
}
```

Task move safety rules:

- Name lookups fail fast on duplicates and ask you to use IDs.
- Destination must be exactly one type: project OR parent task OR inbox.
- Moving a task into itself/its descendants is blocked to prevent cycles.
- `batch_move_tasks` accepts stable IDs only, validates the complete plan before changing anything, and verifies every final destination.
- If batch preflight fails, no task is moved. Call it only after the user confirms the displayed organization proposal.

You can also move with `edit_item` and combine move + field updates:

```bash
edit_item {
  "itemType": "task",
  "id": "task-id-123",
  "newProjectName": "Planning",
  "newName": "Review tmux workflow",
  "newFlagged": true
}
```

### Smart Task Discovery

```bash
# Find high-priority work
filter_tasks {
  "flagged": true,
  "taskStatus": ["Available"],
  "estimateMax": 120,
  "hasEstimate": true
}

# Today's completed work
filter_tasks {
  "completedToday": true,
  "taskStatus": ["Completed"],
  "sortBy": "project"
}
```

### 🌟 Custom Perspective Usage

```bash
# List your custom perspectives
manage_perspectives {"action": "list"}

# Access a custom perspective with project tree
get_tasks {
  "source": "custom",
  "perspectiveName": "Today Review",
  "displayMode": "project_tree",
  "hideCompleted": true
}

# Quick flat view of weekly planning
get_tasks {
  "source": "custom",
  "perspectiveName": "Weekly Planning",
  "displayMode": "flat"
}
```

### 📁 Folder Management

```bash
# List all folders with project counts
manage_folders {"action": "list", "includeDropped": false}

# Create a top-level folder
manage_folders {"action": "add", "name": "Work"}

# Create a nested folder
manage_folders {"action": "add", "name": "Clients", "parentFolderName": "Work"}

# Inspect a folder's projects and subfolders
manage_folders {"action": "get", "name": "Work"}

# Rename or move a folder (empty string moves to root)
manage_folders {"action": "edit", "name": "Clients", "newName": "Key Clients"}
manage_folders {"action": "edit", "name": "Key Clients", "newParentFolderName": ""}

# Delete a folder (⚠️ also deletes all contained projects and tasks)
manage_folders {"action": "remove", "name": "Old Archive"}
```

### ⚡ Productivity Tools

```bash
# Append a progress note without overwriting the existing note
append_to_note {
  "itemType": "task",
  "name": "Write report",
  "text": "Drafted section 1 today"
}

# Fast count: how many flagged tasks are still actionable?
count_tasks {
  "flagged": true,
  "taskStatus": ["Available", "Next", "DueSoon", "Overdue"]
}

# How many tasks remain in a project (by status breakdown)
count_tasks {"projectFilter": "Website Redesign"}

# Duplicate a task template with its subtasks
duplicate_task {
  "name": "Weekly Review Checklist",
  "newName": "Weekly Review - 2026-03-02"
}

# Duplicate without subtasks
duplicate_task {"taskId": "abc123", "includeSubtasks": false}
```

### 🏷️ Tag Management

```bash
# Search and list tags
manage_tags {"action": "search", "query": "work"}
manage_tags {"action": "list", "includeInactive": false}

# Create a tag, optionally nested
manage_tags {"action": "add", "name": "Deep Work"}
manage_tags {"action": "add", "name": "Client A", "parentTagName": "Clients"}

# Rename, pause, or move a tag ("" moves to root)
manage_tags {"action": "edit", "name": "Deep Work", "newName": "Focus"}
manage_tags {"action": "edit", "name": "Focus", "newStatus": "onHold"}
manage_tags {"action": "edit", "name": "Client A", "newParentTagName": ""}

# Delete a tag (tasks are kept, they just lose the tag)
manage_tags {"action": "remove", "name": "Obsolete"}
```

### 🔔 Task Notifications

```bash
# See what reminders a task has
manage_task_notifications {"action": "list", "taskName": "Submit report"}

# Remind at a fixed time
manage_task_notifications {
  "action": "add",
  "taskName": "Submit report",
  "absoluteDate": "2026-03-05T09:00:00"
}

# Remind 30 minutes before the due date (requires a due date)
manage_task_notifications {
  "action": "add",
  "taskName": "Submit report",
  "relativeMinutes": -30
}

# Remove one by index, or clear them all
manage_task_notifications {"action": "remove", "taskName": "Submit report", "index": 0}
manage_task_notifications {"action": "remove", "taskName": "Submit report", "removeAll": true}
```

