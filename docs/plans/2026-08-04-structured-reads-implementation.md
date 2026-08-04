# Structured Output For Reads: Implementation

Date: 2026-08-04

Design: `2026-08-04-structured-reads-design.md`

## What landed

All eleven read primitives now return a result object carrying their structured
fields plus the rendered `text`, and all five read tools declare an
`outputSchema` and return `structuredContent`.

| Tool | Structured payload |
| --- | --- |
| `filter_tasks` | `tasks`, `matchedCount`, `totalCount`, `hasMore`, `nextCursor` |
| `get_tasks` | `source`, `count`, `tasks`, plus `groups` (forecast), `matchedTags`/`availableTags` (tag), `totalCount` (custom) |
| `get_projects` | `view`, `count`, `projects` |
| `manage_folders` | `action`, plus `folders`, `folder`, `folderId`, `name`, `changedProperties`, `deletedProjectCount`, `deletedTaskCount` |
| `manage_tags` | `action`, plus `tags`, `tagId`, `name`, `changedProperties`, `affectedTaskCount`, `childTagCount` |

Rendered text is unchanged everywhere. Only the return shape moved, so the
existing formatter tests still assert on the same strings through `.text`.

## Decisions made during implementation

**One task shape across every source.** The custom-perspective read serializes
its own node type, with tags as plain strings and completion fields the other
reads do not carry. Rather than making `get_tasks` return two task shapes, that
node is mapped onto `TaskTreeNode` and the completion fields were added there and
to `taskNodeSchema` as optional. `tasks` is present for every source so a caller
never branches on `source` just to collect IDs.

**Forecast keeps its grouping.** `groups` carries the same tasks arranged by
date, and `tasks` is the flattened view, so neither the grouping nor simple ID
extraction is lost.

**The mixed-operation routers required all-or-nothing coverage.** Declaring an
output schema commits every success path, so `manage_folders` and `manage_tags`
needed `structuredContent` on their write branches too, not only `list`,
`search`, and `get`. Their schemas make `action` the only required field and
every payload field optional, because the five actions genuinely return
different things. A caller reads `action` first. The alternative — a
`z.discriminatedUnion` — was rejected because the SDK normalizes an output
schema through `normalizeObjectSchema`, which expects an object schema.

**Field names follow the primitives, not a tidied-up guess.** The first draft of
`tagSchema` and `folderSchema` used `parentId`; the reads actually return
`parentTagID` and `parentFolderID`. The schemas were corrected to match the data
rather than the data reshaped to match the schemas, so nothing silently drops.

## Verification

- 415 tests, up from 407. Per-tool schema round-trips cover every `get_tasks`
  source, both `get_projects` views, all five actions on each router, a project
  with no review data, a nested task tree, a task carrying only `id` and `name`,
  and rejection of an action a router does not have.
- Existing formatter and routing tests unchanged in intent; their stubs now
  return result objects.
- Live MCP handshake against the built server, all schema-valid with no SDK
  validation error:
  - `filter_tasks` on the inbox, returning real task IDs;
  - `get_tasks` for inbox, flagged, and forecast, with forecast reporting four
    date groups;
  - `get_projects` in both views, 34 and 9 projects;
  - `manage_tags` list and search, 30 and 1 tags;
  - `manage_folders` list, 19 folders.

## Still text-only

`dump_database`, whose output is an export format rather than a result an
assistant selects from, and `read_task_attachment`, which returns image content.
Both were out of scope by design.
