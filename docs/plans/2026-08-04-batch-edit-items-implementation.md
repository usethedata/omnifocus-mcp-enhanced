# Batch Task Edit Implementation Plan

Date: 2026-08-04

Design: `2026-08-04-batch-edit-items-design.md`

## Goal

Add `batch_edit_items`: one OmniJS tool that applies field and tag edits to up
to 100 tasks with complete preflight, atomic execution, read-back verification,
and full restoration on any failure.

## Changes

1. Extract the exclusive-tag-group resolution from
   `src/utils/omnifocusScripts/applyTagsExclusive.js` into a new
   `src/utils/omnifocusScripts/tagAssignmentHelpers.js`, exposing tag lookup by
   name, sibling removal for mutually exclusive groups, and add/remove/replace
   application. Point `applyTagsExclusive.js` at the helper so one
   implementation serves both scripts.

2. Register the helper in `HELPER_BY_SCRIPT` in
   `src/utils/scriptExecution.ts` for both `applyTagsExclusive.js` and the new
   `batchEditItems.js`.

3. Add `src/tools/primitives/batchEditItems.ts` carrying the pure logic:
   - parse `[+-]<integer><d|w|m>` shift offsets, rejecting other units;
   - apply day and week shifts by calendar date so wall-clock time survives DST;
   - apply month shifts by pinning the day to 1, shifting the month, then
     clamping the day to the target month's last day;
   - validate item count, duplicate task IDs, mutually exclusive key pairs,
     `estimatedMinutes` as a non-negative integer or `null`, and non-empty
     trimmed `name`;
   - compute final field values per item and reject a resulting `deferDate`
     later than the resulting `dueDate`;
   - format the per-item, per-field before/after diff.

4. Add `src/utils/omnifocusScripts/batchEditItems.js` implementing the nine-step
   protocol from the design, modelled on `batchCompleteTasks.js`: resolve all,
   refuse completed or dropped tasks, resolve all tag names, snapshot every
   field to be changed, apply, read back and compare dates within one second,
   restore in reverse order on exception and restore everything on mismatch.
   `dryRun` returns the computed diff without writing.

5. Add `src/tools/definitions/batchEditItems.ts` with the Zod schema, per-item
   `superRefine` for the mutually exclusive keys, and text output built from the
   verified diff.

6. Register the tool in `src/tools/registerTools.ts` with `MUTATING_TOOL`
   annotations.

7. Add `batchEditItems.js` and `tagAssignmentHelpers.js` to
   `scripts/copy-files.mjs`.

8. Update `README.md`, `README.zh.md`, and the `omnifocus-cli` skill for the new
   tool and the 26-tool count. `scripts/install-skill.test.mjs` asserts the
   skill checklist names exactly the registered tools, so this is required, not
   cosmetic.

## Verification

- Unit tests for shift parsing, DST-safe shift arithmetic, month-end clamping,
  final-value date ordering, `estimatedMinutes` null/absent/zero, name
  rejection, duplicate IDs, the 100-item bound, and `replaceTags` conflicts.
- Script tests against the fake-database harness proving no write occurs after a
  preflight failure, restoration after a mid-run exception, restoration after a
  read-back mismatch, exclusive-group sibling removal, and `dryRun` writing
  nothing.
- `applyTagsExclusive.js` behaviour unchanged after the extraction.
- `npm test` green; production build succeeds.
- Live run against scratch tasks: apply an absolute date, a `+1w` shift, a tag
  add, and an `estimatedMinutes` clear; confirm read-back; confirm a completed
  task and an unknown tag are refused; delete every scratch task.

## Project support (second pass)

9. Extend the item shape to `taskId` XOR `projectId`. Resolve projects through
   `Project.byIdentifier` and tasks through `Task.byIdentifier`, and reject a
   project ID supplied as `taskId`: the two share one identifier, so it would
   otherwise edit the project's root task.
10. Refuse completed and dropped projects, mirroring tasks. `project.completed`
    is true once the status is Done; Dropped is checked against
    `Project.Status.Dropped`.
11. Add `reviewInterval` (`{ steps, unit }`), projects only. Write it by reading
    the interval, mutating the copy, and assigning it back — the value read is
    detached, so mutation alone does nothing. Validate `steps` as an integer of
    at least 1 and `unit` against the four plural forms, because OmniFocus
    coerces bad steps to 1 and silently discards the whole assignment on any
    other unit spelling.
12. Snapshot, restore, and verify the interval alongside the other fields.
13. Remove `fixed` from review interval output in `getProjects.js`,
    `getProjectsDueForReview.js`, `markProjectsReviewed.js`, `src/types.ts`, and
    the `markProjectsReviewed` result type. The property does not exist on the
    OmniJS value, so it was always reported as a constant false.

### Verification

- Script tests covering interval writes, refused units and steps, refused
  finished projects, a project ID passed as `taskId`, both IDs on one item,
  mixed task-and-project batches, restoration, and dry run. The project fake's
  `reviewInterval` getter returns a detached copy so the mutate-and-reassign
  requirement is actually exercised.
- Live run against scratch projects: interval persisted and `nextReviewDate`
  recomputed, a singular unit refused with the interval left intact, zero steps
  refused, a Done project refused, a project ID as `taskId` refused, a mixed
  batch persisted, and dry run writing nothing.
