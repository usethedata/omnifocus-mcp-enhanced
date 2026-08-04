# Structured Tool Output Implementation Plan

Date: 2026-08-04

Design: `2026-08-04-structured-output-design.md`

## Goal

Let tools return machine-readable results alongside their text, starting with the
family whose results an assistant most often has to act on: per-item batch
outcomes and counts.

## Changes

1. Add an optional `outputSchema` to the `ToolModule` interface in
   `src/tools/registerTools.ts` and forward it only when present. The key is
   omitted rather than passed as `undefined`, because the SDK treats a declared
   schema as a hard commitment: a success result without matching
   `structuredContent` throws.

2. Export `outputSchema` and return `structuredContent` from six definitions:
   - `countTasks.ts` — `{ total, byStatus }`.
   - `batchEditItems.ts` — `{ dryRun, items[] }` with `taskId` or `projectId`
     per entry and the verified per-field diff.
   - `batchCompleteTasks.ts` — `{ items[] }` with status, completion date, and
     any generated repeating instance.
   - `batchMoveTasks.ts` — `{ movedCount, unchangedCount, results[] }`.
   - `batchRemoveItems.ts` — `{ removedCount, results[] }` with cascade counts.
   - `batchAddItems.ts` — `{ addedCount, failedCount, results[] }`. This is the
     only batch tool with partial success, so each entry carries its own
     `success` flag with a nullable `id` and `error`.

3. Model success shapes only. Failures return `isError: true`, which the SDK
   exempts from validation, so no schema carries an error field.

## Verification

- `src/tools/definitions/outputSchemas.test.ts` parses representative payloads
  through each schema, including empty results, an unknown enum value, and a
  missing required key. This runs the same validation the SDK performs, so a
  schema cannot drift from the payload its handler builds.
- `registerTools.test.ts` asserts the exact set of tools carrying an output
  schema and that untouched tools have no `outputSchema` key at all.
- `npm test` green; production build succeeds.
- Live MCP handshake against the built server:
  - `count_tasks` returns both `content` and a schema-valid
    `structuredContent`, with no SDK validation error.
  - `batch_edit_items` with an unknown ID returns `isError: true`, no
    `structuredContent`, and is not rejected by the SDK.
  - `batch_edit_items` in `dryRun` mode against a scratch task returns the full
    per-field diff as `structuredContent` and passes SDK validation; the scratch
    task is deleted afterwards.

## Not in this pass

The eleven read primitives that return pre-formatted strings — `filterTasks`,
`getProjects`, `getInboxTasks`, `getFlaggedTasks`, `getForecastTasks`,
`getTasksByTag`, `getCustomPerspectiveTasks`, `getProjectsDueForReview`,
`listFolders`, `listTags`, `searchTags` — each build their text inline and must
be split into data plus formatter before they can carry structured output. That
is where the most value for an assistant sits, and it is also the change with
real regression risk against the existing formatter tests, so it is staged
separately.

`manage_folders`, `manage_tags`, and `manage_task_notifications` route to some of
those primitives and are blocked behind them. `read_task_attachment` returns
image content rather than data and is out of scope.
