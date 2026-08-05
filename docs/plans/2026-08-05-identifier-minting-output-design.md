# Structured Output For Identifier-Minting Writes

Date: 2026-08-05

## Problem

`2026-08-04-structured-output-design.md` split the 26 tools into migration
groups and delivered the first one: the five batch tools and `count_tasks`.
The group it named next is still untouched.

Five tools create something and mint a new stable ID for it:

| Tool | Mints |
| --- | --- |
| `add_omnifocus_task` | task ID |
| `add_project` | project ID |
| `duplicate_task` | new task ID |
| `create_project_from_outline` | project ID plus one ID per created task |
| `mark_projects_reviewed` | no new ID, but the verified review dates OmniFocus generated |

These are the last tools where an assistant has no way to learn an identifier
except by parsing prose. Every one of them renders the ID into a sentence:

```text
✅ Task "Draft outline" created successfully in your inbox.

id: kZm3xQ1abcd
```

An assistant that creates a project and then edits it has to recover
`kZm3xQ1abcd` from that text before it can call `batch_edit_items`. That is the
exact chain the structured-output work exists to remove, and it is the most
common one: create-then-reference is how outlines, duplicates, and review loops
are all used.

The remaining un-migrated tools (`edit_item`, `move_task`, `append_to_note`,
`set_repetition_rule`, `remove_item`, `manage_task_notifications`,
`get_task_by_id`, `manage_perspectives`, `dump_database`) either act on an ID the
caller already has or are blocked on the formatted-read split. They are not in
this release.

## Decision

Add `outputSchema` and `structuredContent` to the five tools above, following
the mechanics already established: text content is unchanged, structured content
is added alongside it, and error paths carry no payload because the SDK exempts
`isError: true` from validation.

## The Optionality Problem

The prior design set a rule worth restating, because this group is the first
place it genuinely bites:

> Optional fields stay optional in the schema exactly where they are optional in
> the interface. A schema that demands a field the handler omits on some paths
> turns a working tool into a hard error.

Applied literally, every ID in this release would be optional, because all five
result interfaces declare their ID optional. That would be honest about the
types and useless in practice: the consumer would still have to handle a missing
ID on the one field the whole release exists to deliver.

So the rule needs a second half. The question is not what the interface declares
but what the success path can actually produce, and the two disagree here.

### What the success paths actually produce

Verified by reading each primitive and its OmniJS script, not its type:

| Tool | ID guaranteed on success? | Evidence |
| --- | --- | --- |
| `mark_projects_reviewed` | yes | preflight rejects ineligible status, unusable review interval, and missing next review date before any write (`markProjectsReviewed.js:55-70`); the success payload builds every field unconditionally |
| `create_project_from_outline` | yes | handler already rejects `!result.projectId \|\| !result.items` |
| `duplicate_task` | no | `newTaskId` is copied straight from the script result with no check |
| `add_omnifocus_task` | no | `taskId` is `result.taskId as string` from parsed AppleScript |
| `add_project` | no | `projectId` is `result.projectId as string` from parsed AppleScript |

The bottom three share one shape: an unvalidated cast from a JSON payload. Both
AppleScript primitives then guard on the value they just cast —
`if (projectId && tags.length > 0 ...)`, `taskId && params.repetition` — which is
the authors' own evidence that the cast can produce `undefined`.

### The latent defect this exposes

When that happens today, `success: true` flows through to a success message that
interpolates the missing value:

```text
✅ Project "Launch" created successfully at the root level.

id: undefined
```

That is already wrong. It reports success for a call that cannot tell the user
what it created, and an assistant parsing it would carry the string `undefined`
forward as an ID.

### Decision: require the ID, and guard for it

Every ID in this release is **required** in its schema, and each handler gains a
guard that routes a missing ID to the error path instead of the success path.

- Required is what makes the schema worth declaring. An optional ID pushes the
  same `undefined` handling onto every consumer and delivers nothing.
- The guard is not a new restriction. An identifier-minting tool that cannot
  report its identifier has not completed its contract, and the two newer tools
  in this group (`create_project_from_outline`, `mark_projects_reviewed`) already
  guard exactly this way. This extends the existing convention to the three
  older tools rather than inventing one.
- It converts a wrong success into a correct failure. The only output that
  changes is the `id: undefined` message, which no caller can be relying on.

This does not contradict the prior rule; it applies it to the real success path.
Fields that genuinely vary — `removedSiblings`, `missingTags`, `repetition`,
`childrenCount` — stay optional exactly as before.

## Schemas

Each mirrors the result interface the primitive already returns.

`add_omnifocus_task`:

```json
{
  "taskId": "kZm3xQ1abcd",
  "removedSiblings": ["Low Energy"],
  "missingTags": [],
  "repetition": {
    "ruleString": "FREQ=WEEKLY;BYDAY=FR",
    "scheduleType": "Regularly",
    "anchorDateKey": "DueDate",
    "catchUpAutomatically": false,
    "nextOccurrence": "2026-08-07T17:00:00.000Z"
  }
}
```

`add_project`: `projectId` required; `removedSiblings` and `missingTags`
optional.

`duplicate_task`: `newTaskId` required; `name` and `childrenCount` optional,
since both are copied from the script result alongside the ID.

`create_project_from_outline`:

```json
{
  "projectId": "proj-1",
  "taskCount": 3,
  "items": [
    { "id": "proj-1", "type": "project", "path": "Launch", "parentId": null, "verified": true }
  ],
  "affectedPaths": ["Launch"]
}
```

`mark_projects_reviewed`:

```json
{
  "reviewedAt": "2026-08-05T09:00:00.000Z",
  "count": 1,
  "projects": [
    {
      "id": "proj-1",
      "name": "Launch",
      "status": "Active",
      "lastReviewDate": "2026-08-05T09:00:00.000Z",
      "nextReviewDate": "2026-08-12T09:00:00.000Z",
      "reviewInterval": { "steps": 1, "unit": "weeks" },
      "verified": true
    }
  ]
}
```

`reviewInterval` reuses `reviewIntervalSchema` from `sharedOutputSchemas.ts`,
which already documents why no `fixed` field is reported. Its fields are
required here because preflight guarantees them.

## Non-goals

- Replacing text output. Both are returned.
- Modelling error payloads.
- Migrating the remaining nine tools, which need the formatted-read split first.
- Changing any input schema.
- Fixing the underlying unvalidated casts in the AppleScript primitives. The
  guard makes their failure mode correct at the tool boundary; the casts
  themselves belong to the AppleScript-to-OmniJS migration.

## Verification

- Per-tool tests parsing a representative success payload against the tool's own
  schema, matching the SDK's runtime validation.
- Tests asserting each schema rejects a payload missing its required ID.
- The existing `documentedCounts` test derives the structured-output count from
  the server, so both READMEs must move from 11 to 16 or the suite fails.
- Live verification through an MCP handshake against a real OmniFocus database
  remains outstanding; it cannot run in this environment.
