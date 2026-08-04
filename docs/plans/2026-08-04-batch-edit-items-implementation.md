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
