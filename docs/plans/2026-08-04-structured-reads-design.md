# Structured Output For Reads

Date: 2026-08-04

Follows `2026-08-04-structured-output-design.md`, which covered the batch tools
and `count_tasks` and deferred the reads.

## Problem

The five read tools — `filter_tasks`, `get_tasks`, `get_projects`,
`manage_folders`, `manage_tags` — return text only. These are the tools whose
output an assistant most often has to act on, because their results carry the
stable IDs every write tool requires. Recovering an ID from formatted prose is
the single most avoidable failure mode left in the surface.

## What the code already has

The eleven primitives behind these tools return `Promise<string>`, which is why
they were deferred. That framing turned out to overstate the work: every one of
them already receives a structured object from `executeOmniFocusScript`, because
the OmniJS scripts return JSON. Each then formats that object into text and
throws the object away.

| Primitive | Structured fields it already receives |
| --- | --- |
| `filterTasks` | `tasks`, `filteredCount`, `hasMore`, `lastSortTuple` |
| `getInboxTasks`, `getFlaggedTasks` | `tasks` |
| `getForecastTasks` | `tasksByDate` |
| `getTasksByTag` | `tasks`, `matchedTags`, `availableTags` |
| `getCustomPerspectiveTasks` | `taskMap`, `count` |
| `getProjects`, `getProjectsDueForReview` | `projects` |
| `listFolders` | `folders`, `count` |
| `listTags`, `searchTags` | `tags` |

The task-shaped reads all serialize through one type, `TaskTreeNode` in
`taskTreeFormatter.ts`, which is recursive through `children` and carries
`TaskTag` entries. One recursive schema therefore covers every task-returning
read, rather than one schema per tool.

## Decision

Each primitive returns a named result object carrying its structured fields plus
the rendered `text`, instead of returning the rendered text alone. The definition
passes `text` to `content` and the rest to `structuredContent`.

This keeps one OmniJS round trip per call. Exposing the data through a second
exported function would have run each script twice, which the pagination
benchmark exists to prevent.

Text output is unchanged, character for character. The refactor moves where the
string is returned, not how it is built.

## Structured content matches the text

Two reads reshape their data before rendering, and the structured payload uses
the reshaped form so an assistant and a human are looking at the same thing:

- The task reads call `dedupeExpandedTopLevelTasks` before printing, which drops
  a top-level entry already shown as somebody's subtask. The structured payload
  carries the deduped set, and the original count stays available as a separate
  field.
- `getCustomPerspectiveTasks` receives a `taskMap` and renders a tree. The
  structured payload carries the tree, not the map.

## Shared schemas

`src/tools/definitions/sharedOutputSchemas.ts` holds the pieces more than one
tool needs:

- `taskTagSchema` — `{ id?, name, path?, ancestorIds? }`.
- `taskNodeSchema` — the recursive `TaskTreeNode`, declared with `z.lazy` for
  `children`.
- `projectSchema` — the project fields the project reads return, including
  review metadata without `fixed`, which OmniJS does not expose.

Every field that is optional in the TypeScript interface stays optional in the
schema. A schema demanding a field a script omits on some path would turn a
working read into a hard error, which is the only regression this change can
introduce.

## Non-goals

- Changing any rendered text.
- Changing any input schema.
- Adding pagination or new filters.
- `read_task_attachment`, which returns image content rather than data.
- `dump_database`, whose text is an export format rather than a result an
  assistant selects from.

## Verification

- Existing formatter tests keep asserting on the rendered text, reached through
  the new `text` field. Any change in rendering shows up as a test failure.
- Schema round-trip tests per tool, parsing representative payloads including
  empty results, a task with nested children, and a task with no project.
- A test asserting the deduped set is what appears in structured output, not the
  raw list.
- Live MCP handshake against the built server for each migrated tool, confirming
  both `content` and a schema-valid `structuredContent`, with no SDK validation
  error.

## Files

New:

- `src/tools/definitions/sharedOutputSchemas.ts`

Changed, each returning a result object instead of a string:

- `src/tools/primitives/filterTasks.ts`, `getInboxTasks.ts`,
  `getFlaggedTasks.ts`, `getForecastTasks.ts`, `getTasksByTag.ts`,
  `getCustomPerspectiveTasks.ts`, `getProjects.ts`,
  `getProjectsDueForReview.ts`, `listFolders.ts`, `listTags.ts`,
  `searchTags.ts`

Changed, each exporting `outputSchema` and returning `structuredContent`:

- `src/tools/definitions/filterTasks.ts`, `getTasks.ts`, `getProjects.ts`,
  `manageFolders.ts`, `manageTags.ts`
