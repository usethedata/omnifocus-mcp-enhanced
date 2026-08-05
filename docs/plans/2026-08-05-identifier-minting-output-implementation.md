# Structured Output For Identifier-Minting Writes: Implementation

Date: 2026-08-05

Implements `2026-08-05-identifier-minting-output-design.md`. Released as v2.4.0.

## What changed

Five tools gained `outputSchema` and `structuredContent`, taking the
structured-output surface from 11 tools to 16:

| Tool | Structured payload |
| --- | --- |
| `add_omnifocus_task` | `taskId`, plus optional `removedSiblings`, `missingTags`, `repetition` |
| `add_project` | `projectId`, plus optional `removedSiblings`, `missingTags` |
| `duplicate_task` | `newTaskId`, plus optional `name`, `childrenCount` |
| `create_project_from_outline` | `projectId`, `taskCount`, `items[]`, optional `affectedPaths` |
| `mark_projects_reviewed` | `count`, `projects[]`, optional `reviewedAt` |

Text output is byte-identical on every success path. `registerTools` already
forwarded `outputSchema` when a definition exports one, so registration needed
no change.

## Handler restructuring

Each of the five handlers was split into an exported `buildResult` mapping
function and a thin `handler` that calls the primitive and delegates to it:

```ts
export function buildResult(args, result) { /* text + structuredContent */ }

export async function handler(args, extra) {
  try {
    return buildResult(args, await addProject(args as AddProjectParams));
  } catch (err) { /* unchanged */ }
}
```

This was done for testability. The prior release's design named "per-tool tests
asserting the handler's `structuredContent` parses against its own
`outputSchema`" as the check that keeps the two from drifting, but the tests it
shipped only parse hand-written payloads — nothing validated what a handler
actually builds. Because the primitives are imported directly and reach
AppleScript or OmniJS, the mapping could not be exercised without a live
OmniFocus. Extracting it makes the real payload assertable offline.

`buildResult` is a pure function of the primitive result, so no behaviour moved
with it.

## The missing-ID guard

`add_omnifocus_task`, `add_project`, and `duplicate_task` now return
`isError: true` when the primitive reports success without an ID.

This is the release's only behaviour change. All three primitives take the ID
from parsed JSON with an unchecked cast (`result.projectId as string`), and both
AppleScript primitives then guard on the value they just cast, which is the
original authors' own evidence that it can be `undefined`. The previous output
in that case was a success message reading `id: undefined`.

The two newer tools in the group already guarded this way, so the change extends
an existing convention rather than introducing one.

## Tests

Added to `outputSchemas.test.ts` (418 → 438 tests):

- schema tests per tool, including a null `nextOccurrence`, an outline item with
  an unknown `type`, and a review payload missing its verified dates;
- `assertStructuredMatches` tests running each `buildResult` output through its
  own `outputSchema` — the drift check the prior release specified but did not
  implement;
- guard tests asserting a success-without-an-ID becomes `isError` with no
  structured content;
- a test asserting every failure path carries no structured content, matching
  the SDK's `isError` exemption.

`registerTools.test.ts` and both READMEs carry hardcoded structured-output
counts; all three were updated from 11 to 16. The `documentedCounts` test derives
the number from the server, so a missed README would have failed the suite.

## Verification

- `npm test`: 438 tests, 0 failures. Includes `tsc --noEmit`.
- `npm audit --omit=dev --audit-level=high`: clean.
- Live MCP handshake against the built server: `tools/list` returns 26 tools, 16
  carrying `outputSchema`, including all five migrated here. `add_project`
  advertises `required: ["projectId"]`, confirming the required-ID decision
  survives Zod-to-JSON-Schema conversion.
- Live smoke against a real OmniFocus database, 13/13 checks: each of the five
  tools returned a usable stable ID in `structuredContent`, and the minted
  `taskId` resolved through `get_task_by_id` without any text parsing — the
  chain the release exists to enable. `create_project_from_outline` returned one
  verified item per created object (3 for a two-level outline), and
  `mark_projects_reviewed` returned the OmniFocus-generated next review date.
  Every created object was deleted afterwards and the cleanup was confirmed
  from a separate process against both the task and project reads.

The smoke run covers the success paths. The missing-ID guard is covered only by
unit tests, because it cannot be provoked from a healthy OmniFocus — it exists
for the case where AppleScript returns success with no ID.

## Follow-ups

- Nine tools remain without structured output. Of those, `get_task_by_id`,
  `manage_perspectives`, and `manage_task_notifications` are ready; the rest need
  the formatted-read split first.
- The unchecked casts in the AppleScript primitives are still unchecked. The
  guard makes their failure mode correct at the tool boundary, but the casts
  belong to the AppleScript-to-OmniJS migration.
