# Structured Tool Output Design

Date: 2026-08-04

## Problem

All 26 tools return text and nothing else. An assistant that reads tasks and
then writes to them has to recover stable IDs by parsing formatted prose, and an
assistant that runs a batch has to parse a summary line to learn which items
succeeded. Both are avoidable: MCP has carried `outputSchema` and
`structuredContent` since the 2025-06-18 revision, and the SDK in use (1.30.0)
supports them.

Text output is not the wrong choice — it is what makes results readable in a
chat client. The gap is that it is the *only* output.

## Verified SDK Behaviour

Read from `@modelcontextprotocol/sdk@1.30.0`
(`dist/esm/server/mcp.js:185-207`), not from documentation:

| Behaviour | Consequence |
| --- | --- |
| A tool with `outputSchema` and no `structuredContent` throws `McpError` | Declaring a schema is a hard commitment for every success path |
| `structuredContent` is validated against the schema, and a mismatch throws | The schema cannot drift from what the handler returns |
| Results with `isError: true` skip validation entirely | Error paths need no structured payload |
| Tools without `outputSchema` are untouched | Migration is safe tool by tool |

The last two rows are what make an incremental migration possible: an
un-migrated tool behaves exactly as it does today, and a migrated tool only has
to satisfy its schema on success.

## Decision

`outputSchema` becomes an optional export from a tool definition module.
`registerTools` forwards it when present and omits it otherwise, so no tool
changes behaviour until it opts in.

Text content stays on every tool. `structuredContent` is added alongside it,
never instead of it. A client that ignores structured output sees no change.

## Migration Order

The work splits along a line that already exists in the codebase. Eleven
primitives return a pre-formatted `string`; the rest return typed objects.

| Group | Primitives | Effort |
| --- | --- | --- |
| Per-item outcomes and counts | `countTasks`, `batchAddItems`, `batchCompleteTasks`, `batchEditItems`, `batchMoveTasks`, `batchRemoveItems` | Schema mirrors an existing TypeScript interface |
| Identifier-minting writes | `createProjectFromOutline`, `duplicateTask`, `markProjectsReviewed`, `addOmniFocusTask`, `addProject` | Same |
| Single-object reads | `getTaskById`, `managePerspectives` | Same |
| Formatted reads | `filterTasks`, `getProjects`, `getInboxTasks`, `getFlaggedTasks`, `getForecastTasks`, `getTasksByTag`, `getCustomPerspectiveTasks`, `getProjectsDueForReview`, `listFolders`, `listTags`, `searchTags` | Primitive must be split into data and formatter first |
| Mixed-operation routers | `manage_folders`, `manage_tags`, `manage_task_notifications` | Blocked on the formatted reads they route to |
| Binary content | `readTaskAttachment` | Out of scope; returns image content, not data |

The formatted reads carry the most value for an assistant and the most work,
because each one currently builds its text inline. Splitting them is a separate
change with its own regression risk against the existing formatter tests, so it
is staged after the mechanical group rather than bundled with it.

This release covers the first group: the five batch tools and `count_tasks`.
They share one shape — a verified per-item outcome — which is exactly what an
assistant needs to report a bulk change without re-reading the database.

## Schema Shape

Each schema mirrors the result interface the primitive already returns, with two
rules.

Failures are not modelled. A failed operation returns `isError: true`, which the
SDK exempts from validation, so the schema describes only the success shape and
never carries an `error` field.

Optional fields stay optional in the schema exactly where they are optional in
the interface. A schema that demands a field the handler omits on some paths
turns a working tool into a hard error, which is the one failure mode this
change could introduce.

For the batch family:

```json
{
  "items": [
    { "taskId": "abc", "name": "Draft outline", "changes": [
      { "field": "dueDate", "before": null, "after": "2026-09-15T17:00:00.000Z" }
    ] }
  ],
  "dryRun": false
}
```

For `count_tasks`:

```json
{ "total": 42, "byStatus": { "Available": 30, "Overdue": 12 } }
```

## Non-goals

- Replacing text output. Both are returned.
- Modelling error payloads in the schema.
- Refactoring the formatted-read primitives in this release.
- `readTaskAttachment`, which returns image content rather than data.
- Changing any tool's input schema.

## Verification

- A registration test asserting that a tool exporting `outputSchema` has it
  forwarded, and that a tool without one is registered without the key.
- Per-tool tests asserting the handler's `structuredContent` parses against its
  own `outputSchema`. This is the check that keeps schema and handler from
  drifting, and it is the same validation the SDK performs at runtime.
- A test asserting an error result carries no `structuredContent`, matching the
  SDK's exemption.
- Live verification through an MCP handshake: call a migrated tool and confirm
  the response carries both `content` and a schema-valid `structuredContent`.

## Files

Changed:

- `src/tools/registerTools.ts` forwards an optional `outputSchema`.
- `src/tools/definitions/countTasks.ts`, `batchAddItems.ts`,
  `batchCompleteTasks.ts`, `batchEditItems.ts`, `batchMoveTasks.ts`,
  `batchRemoveItems.ts` each export `outputSchema` and return
  `structuredContent`.
- Tests beside each changed definition.
