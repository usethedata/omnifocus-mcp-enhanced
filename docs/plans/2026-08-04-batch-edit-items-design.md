# Batch Task Edit Design

Date: 2026-08-04

## Problem

Four batch tools exist — `batch_add_items`, `batch_remove_items`, `batch_move_tasks`,
`batch_complete_tasks` — and no batch edit. Changing a field across a set of
tasks has no path except one `edit_item` call per task.

That fallback fails on three counts. Each call spawns its own `osascript`
process, so twenty tasks cost twenty process launches. Nothing is atomic: a
failure on the twelfth task leaves eleven tasks changed with no record of what
to undo. And `edit_item` verifies nothing it wrote, so a silent no-op is
indistinguishable from success.

`edit_item` is also the largest remaining AppleScript surface in the server
(22 KB in `src/tools/primitives/editItem.ts`). Eleven primitives still use
AppleScript and every one of them is a single-item write; the other twenty-five,
including every batch tool and every read, use OmniJS. `RESEARCH.md` records why
that migration happened: AppleScript on OmniFocus 4.x produces timeouts and
broken behaviour, and Omni Group maintains it only for legacy compatibility. A
new batch tool must not extend that surface.

## Verified Capabilities

Confirmed by live probe against the running app through OmniJS
`evaluateJavascript`. The probe created its own scratch tasks and one scratch
tag, exercised every write, then deleted all fifteen objects; cleanup was
verified to leak no tasks and no tags.

| Capability | Result |
| --- | --- |
| Write `name`, `note`, `dueDate`, `deferDate`, `plannedDate`, `flagged`, `estimatedMinutes` | works, reads back |
| Clear a date with `null` | works, reads back `null` |
| Clear `estimatedMinutes` with `null` | works |
| `estimatedMinutes = 0` | stores `0`, not `null` |
| Read a date on a dateless task | `null` |
| Assign `name = ""` | **accepted** |
| Assign `deferDate` later than `dueDate` | **accepted, both stored** |
| Edit a completed task | **accepted, task stays completed** |
| Edit a dropped task | **accepted** |
| Write `dueDate` on a repeating task | rule string and method preserved |
| `addTag` / `removeTag` / `clearTags` | work |
| `task.modified` | `null` both before and after a write |
| `Array.isArray(task.tags)` | **false**; the value is a `TagArray` |
| `Array.isArray(tag.children)` | **false**; same collection type |

Three findings decide the shape of the tool. OmniFocus does not validate the
name, does not validate date ordering, and does not protect finished tasks. As
with `archivedFilterRules`, reading a value back proves that storage succeeded
and nothing more, so validation before the first write is the only real
defence.

Two findings remove anticipated work. A repeating task's rule survives a
due-date write untouched, so repeating tasks need no separate path. And
`task.modified` cannot serve as a change signal, so verification must compare
field values rather than timestamps.

One finding constrains relative dates. A dateless task reads `null`, so a
relative shift has no base to shift from. It must fail preflight rather than
silently anchor to the current time.

One finding exposed a pre-existing defect. OmniJS returns collections as
`TagArray`, so `Array.isArray` is false for both `task.tags` and
`tag.children`. `applyTagsExclusive.js` guarded both reads on `Array.isArray`
and therefore saw an empty list against the real database: its exclusive-group
sibling removal could never fire, which means the `exclusiveTags` option on the
add and edit tools has never actually dropped a conflicting sibling tag in
production. The behaviour was invisible because the script reports success
without reading anything back, and because the existing tests build fakes from
plain Arrays.

The shared helper introduced here reads every collection through one coercion,
which fixes `applyTagsExclusive.js` as a side effect. The regression test uses a
collection that is indexable but not an Array, because a fake built from a plain
Array cannot catch this class of bug.

## Decision

One new tool, `batch_edit_items`, implemented in OmniJS, following the
preflight-execute-verify-restore protocol that `batchCompleteTasks.js` already
established.

Editable fields are the task's own scalar data plus tags: `name`, `note`,
`dueDate`, `deferDate`, `plannedDate`, `flagged`, `estimatedMinutes`,
`addTags`, `removeTags`, `replaceTags`.

Placement and completion are excluded because dedicated tools already own them:
moves belong to `batch_move_tasks`, completion to `batch_complete_tasks`.
Keeping them out avoids two tools that can produce the same state by different
routes.

Field assignment and read-back verification reuse the `applyFields` and
mismatch-collection shape from `createProjectFromOutline.js:245-289`, which
already writes and verifies this exact field set.

## Input Shape

Every item names one task by stable ID and carries only the fields it changes.
The per-item shape matches its sibling tools (`batch_move_tasks` takes
`moves[].taskId`, `batch_complete_tasks` takes `items[].taskId`), so an
assistant that can drive one can drive all of them.

```json
{
  "items": [
    { "taskId": "abc", "dueDate": "2026-09-15T17:00:00", "flagged": true },
    { "taskId": "def", "dueDateShift": "+1w" },
    { "taskId": "ghi", "estimatedMinutes": null, "addTags": ["深度工作"] }
  ],
  "dryRun": false
}
```

A field key that is absent leaves that field untouched. An explicit `null`
clears it. The distinction matters for `estimatedMinutes`, where `null` clears
the estimate and `0` stores a zero-minute estimate.

Each date field accepts either an absolute value or a relative shift, never
both in the same item:

- `dueDate`, `deferDate`, `plannedDate` — an absolute date, or `null` to clear.
- `dueDateShift`, `deferDateShift`, `plannedDateShift` — a signed offset
  matching `[+-]<integer><d|w|m>`, applied to the task's current value.

Shifts move the calendar date and preserve the wall-clock time, so a task due
at 17:00 stays due at 17:00 after `+1w`.

Month shifts clamp to the end of the target month: 31 January plus one month is
28 or 29 February, not 2 or 3 March. Clamping is chosen over JavaScript's native
`setMonth` overflow because overflow silently moves a task into the month after
the one the user named, which is the opposite of what "push this out a month"
means. The rule is applied by pinning the day to 1, shifting the month, then
setting the day to the smaller of the original day and the target month's last
day.

Year units are excluded. No observed workflow needs them, and `+12m` expresses
the same intent under a rule that is already defined.

Tag arrays hold tag names, not IDs. Tags are name-addressed everywhere else in
the server — `edit_item`, `manage_tags`, and `applyTagsExclusive.js` all resolve
by name — and diverging here would make the batch tool the only one that needs
a prior ID lookup. `replaceTags` cannot be combined with `addTags` or
`removeTags` in the same item.

`items` holds at most 100 entries, matching `batch_complete_tasks`. A `taskId`
may appear only once per request; two edits to one task in one batch would make
the applied result depend on array order.

## Write Protocol

Each step runs to completion for every item before the next step begins, and
any failure aborts the whole request.

1. Validate the request shape: item count, duplicate task IDs, mutually
   exclusive keys, shift grammar, `estimatedMinutes` as a non-negative integer
   or `null`, and `name` non-empty after trimming.
2. Resolve every `taskId`. A missing task fails the request.
3. Reject any task that is completed or dropped. Both accept writes silently,
   and a bulk edit that quietly rewrites finished work is worse than a refusal.
   Single-task edits remain available through `edit_item`.
4. Resolve every tag name to a tag. An unknown or ambiguous name fails the
   request and is named in the error; it is never skipped and never
   auto-created, because creating tags as a side effect of a bulk edit is not
   recoverable by inspection.
5. Compute each item's final field values, including the result of every shift.
   A shift against a `null` date fails the request. Verify that the resulting
   `deferDate` is not later than the resulting `dueDate`, comparing final values
   rather than requested ones so that shifting one date into conflict with an
   untouched date is caught.
6. Snapshot every field the request will change, per task, as the rollback
   point.
7. Apply the changes.
8. Read every changed field back and compare against the intended value. Dates
   compare within one second, matching `batchCompleteTasks.js`.
9. On any exception during step 7, restore the snapshots of already-applied
   items in reverse order. On any mismatch in step 8, restore every snapshot.
   Either outcome is reported as a failure with `restored: true`.

`dryRun: true` stops after step 5 and returns the computed per-item diff without
writing, mirroring `manage_perspectives`.

A successful response returns a per-item, per-field diff of before and after
values, so the assistant can state what changed instead of asserting an
unverified success.

## Failure Handling

- Empty `items`, more than 100 items, or a duplicate `taskId` fails the request.
- A missing task fails the request.
- A completed or dropped task fails the request and names the task.
- An unknown or ambiguous tag name fails the request and names the tag.
- A relative shift against a task with no value in that field fails the request.
- A resulting `deferDate` later than the resulting `dueDate` fails the request.
- An empty or whitespace-only `name` fails the request.
- A write exception restores every already-applied item and reports failure.
- A read-back mismatch restores every item and reports failure.

No path returns partial success. A request either applies completely or leaves
the database as it was.

## Non-goals

- Changing task status, including dropping tasks. `batch_complete_tasks` owns
  completion; dropping in bulk has no established workflow yet.
- Moving tasks between projects or parents. `batch_move_tasks` owns placement.
- Project-only fields such as `sequential` or the review interval.
- Editing completed or dropped tasks.
- Year shift units.
- Creating tags that do not yet exist.
- Per-item partial success.
- Retiring `edit_item`. Migrating it off AppleScript is a separate change that
  should reuse this script once it has proven itself.

## Verification

The pure logic carries most of the tests, since it is where the three
no-validation holes are closed:

- shift grammar parsing, including rejected units and malformed offsets;
- shift arithmetic preserving wall-clock time across a DST boundary;
- month shifts clamping at every month end, including 31 January into a leap
  and a non-leap February, and a negative shift out of 31 March;
- final-value date-order validation, including the case where a shift on
  `deferDate` conflicts with an untouched `dueDate`;
- `null` versus absent versus `0` for `estimatedMinutes`;
- empty and whitespace-only name rejection;
- duplicate `taskId` rejection and the 100-item bound;
- `replaceTags` conflicting with `addTags` or `removeTags`.

Script-level tests run `batchEditItems.js` against the existing fake-database
harness used by `batchCompleteTasks.test.ts` and assert:

- no field is written when any preflight check fails;
- a mid-run exception restores every earlier item;
- a read-back mismatch restores every item;
- exclusive tag groups drop sibling tags exactly as `applyTagsExclusive.js`
  does;
- `dryRun` writes nothing and returns the same diff the real run would.

Live verification drives the tool against scratch tasks created for the purpose,
confirms persistence and read-back agreement, confirms refusal of a completed
task and of an unknown tag, and deletes every scratch object afterwards.

## Files

New:

- `src/utils/omnifocusScripts/batchEditItems.js`
- `src/utils/omnifocusScripts/tagAssignmentHelpers.js` — the exclusive-group
  resolution currently inline in `applyTagsExclusive.js`, extracted so both
  scripts share one implementation.
- `src/tools/primitives/batchEditItems.ts` — shift parsing, validation, diff
  formatting.
- `src/tools/definitions/batchEditItems.ts`
- Tests beside each new module.

Changed:

- `src/tools/registerTools.ts` registers the tool as `MUTATING_TOOL`.
- `src/utils/scriptExecution.ts` adds `batchEditItems.js` and
  `applyTagsExclusive.js` to `HELPER_BY_SCRIPT` for the shared tag helper.
- `src/utils/omnifocusScripts/applyTagsExclusive.js` uses the extracted helper,
  guarded by its existing behaviour tests.
- `scripts/copy-files.mjs` copies the new scripts.
- `README.md`, `README.zh.md`, and the `omnifocus-cli` skill document the tool
  and its 26-tool count.
