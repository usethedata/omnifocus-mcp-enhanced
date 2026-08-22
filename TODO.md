# OmniFocus MCP Enhanced — Local Fork TODO

Rebuilt 2026-08-18 when `bew-local` was recreated on top of upstream 2.4.0. Items from
the previous list were re-verified against 2.4.0 rather than carried over blindly; what
upstream fixed is recorded at the bottom so it is not re-investigated.

---

## Open — MCP gaps

### Done and Dropped projects are unconditionally filtered from `dump_database`

`src/utils/omnifocusScripts/omnifocusDump.js` still drops projects whose status is Done
or Dropped (lines 116–117) before serializing, and the script does not read
`hideCompleted` from `injectedArgs` at all — so no flag at the rendering layer can bring
them back.

**Needed.** Have the dump script read `hideCompleted` (or an explicit
`includeCompletedProjects`) from `injectedArgs` and skip the filter when asked.

**No longer blocking.** Step 4c of `maintain-project-folders-and-metadata` enumerated Done
projects through JXA because of this gap. As of 2026-08-21 it uses `get_projects`, which
returns Done projects — and their notes — directly. The dump gap is still real and
`dump_database` remains unusable as a data source, but nothing downstream waits on it.

---

### `get_task_by_id` does not report completion status

`formatTaskInfo` in `src/tools/definitions/getTaskById.ts` never emits a completion
field, and the tool has no structured output, so the `completed` boolean that
`src/tools/primitives/getTaskById.ts` already carries is dropped before it reaches the
model. A completed task and an incomplete one render identically. Verified 2026-08-21
against a completed task: the rendered output contained no completion line at all.

**Impact.** `obsidian-omnifocus-task-reconciliation` Step 3 decides completion by looking
for `Completed: Yes` in this tool's output, so it silently reports every task as
incomplete — a false clean result on the pre-flight check that gates weekly planning.
The pre-2.4.0 fork emitted the field; the rebuild onto upstream lost it.

**Options.** Add a completion line to the formatter — a small local delta on an upstream
file, and the smaller change — or move the procedure onto `filter_tasks`, which returns
`taskStatus` and `completedDate` in structured output but is a filter rather than a
by-ID lookup, so it needs a date-bounded sweep plus a set-membership test.

---

## Open — local fork maintenance

### Finish the Claude Desktop repoint on the second machine

Done on the first machine (2026-08-21): `claude_desktop_config.json` now points at
`~/LocalProgs/ai/omnifocus-mcp-enhanced/dist/server.js` and the previous copy under the
file-sync folder is no longer referenced. The second machine still needs the same edit.

The config is machine-local and not in git, and it holds far more than `mcpServers` —
edit the one path in place and keep the rest, rather than replacing the file.

Once both machines are repointed, the old clone under the file-sync folder can be
deleted.

### Structured-output opportunity

Upstream added structured output to 16 of 26 tools. Worth reviewing whether the
remaining 10 would benefit, and whether any local formatting preference is better
expressed as a structured-output consumer than as a fork-local rendering change.

---

## Carried local deltas — re-apply after every upstream sync

These are the only intentional divergences from upstream. Everything else in the fork
should stay byte-identical so merges remain trivial. Verified complete 2026-08-21.

### Input length caps on the AppleScript path

12 schema files under `src/tools/definitions/` carry `.max()` bounds, enforced by
`inputCaps.test.ts`. See the cap table in CLAUDE.md. Upstream has not adopted these,
so a new field on an AppleScript-path schema needs a cap adding by hand.

### Narrow i18n of the model-visible surface

Done in `bfe004c`. Upstream still ships Chinese in ~16 source files and keeps adding
more with each feature, so translating all of it is a treadmill. Only these carry:

- `src/tools/primitives/getCustomPerspectiveTasks.ts` — the entire rendered output
- `src/context/prompts.ts` — section headings in the daily-planning prompt (and the
  matching assertions in `prompts.test.ts`)
- `src/utils/omnifocusScripts/getCustomPerspectiveTasks.js` — three thrown error strings
- Two tool descriptions in `src/tools/definitions/` (`getCustomPerspectiveTasks.ts`,
  `managePerspectives.ts`)

Deliberately **not** translated, and re-checking these each sync is wasted effort:
comments, `README.zh.md`, `docs/cookbook.zh.md`, the CJK test fixtures (they exercise
CJK tag handling on purpose), the `inboxLabel` fallback at `perspectiveTaskTree.ts:65`
(the only production caller passes `'Inbox'` explicitly), and the regex at
`scriptExecution.ts:164` — it matches legacy hardcoded script text, so translating it
would stop it matching.

### JSON Schema dialect relabelling for tool schemas

`src/utils/jsonSchemaDialect.ts`, wired into `transport.send` in `server.ts`.

The SDK hardcodes JSON Schema draft-07 for tool schemas: the Zod v3 branch of
`server/zod-json-schema-compat.js` calls `zodToJsonSchema` without `target`, and
`server/mcp.js` never passes one on the v4 branch either. There is no config knob, Zod
v4 does not help, and SDK 1.30.0 is the latest release. Some clients reject a draft-07
`outputSchema`, which made all 16 structured-output tools unreachable from the Cowork
bridge — including `get_tasks` and `filter_tasks`, the backbone of weekly review.

The schemas are already valid 2020-12; only the label was wrong. The helper relabels it,
but only after checking the schema for constructs that differ between dialects
(`definitions`, tuple `items`, boolean `exclusiveMinimum`/`Maximum`, `dependencies`,
`$recursiveRef`, `$ref` beside validation keywords). Anything sensitive is passed through
still labelled draft-07 — as upstream adds tools this degrades to "no change" rather than
to a wrong label.

**Not yet offered upstream.** Running locally first to confirm it addresses the whole
problem. Revisit once there is real usage behind it. Remove entirely if the SDK starts
emitting a modern dialect.

**Known bridge gap, deliberately not addressed:** prompts and resources do not cross the
Cowork bridge (it proxies tools only), so the 6 prompts and 3 resources are invisible to
a Cowork agent. This is not a desktop-app-versus-Cowork split — both run inside the same
application, which opens a separate MCP connection per surface; the chat surface speaks
the full protocol, the bridge forwards tools only.

Reviews are run entirely from the chat interface, where prompts and resources work, so
this does not affect any real workflow. Wrapping the prompts as a tool to get them across
the bridge was considered and rejected on those grounds — do not re-propose it unless
reviews move into Cowork.

### Completion, flagged, and estimate lines in `get_task_by_id`

`formatTaskInfo` in `src/tools/definitions/getTaskById.ts` emits `Completed`, `Flagged`,
and `Estimated`. These were a local delta before the 2.4.0 rebuild; upstream has never
had them.

The 2026-08-18 rebuild dropped them, and it went unnoticed until 2026-08-21 because the
loss is silent: a completed task rendered identically to an open one, so the
reconciliation runbook's Step 3 pre-flight gate returned a false clean on every run.

`get_task_by_id` is one of the 10 tools **without** structured output, so this prose
render is the only channel a caller has — an omission here is unrecoverable downstream.
That is why this tool needs the delta and the others did not: everywhere else the same
data survived the rebuild inside `outputSchema`.

Guarded by four tests in `getTaskById.test.ts`, including one asserting a completed task
does not render identically to an open one. The guard was verified by removing the line
and confirming the suite fails.

**Better fix, not yet done:** give `get_task_by_id` structured output, so procedures stop
parsing prose. See the structured-output item above.

### Structured error on the attachment path guard

`readLinkedAttachment` in `src/tools/primitives/readTaskAttachment.ts` wraps
`resolveLinkedAttachmentPath` in try/catch and returns `{ success: false, error }`.
Upstream lets the guard throw straight through the handler, which surfaces as an
unhandled tool error instead of a structured response. The guard itself is upstream's
verbatim, so only the wrapper is local.

`readTaskAttachment.test.ts` also carries three regression tests beyond upstream's
four: `..` traversal, the home directory itself, and the prefix-sibling case
(`/Users/example-other` against home `/Users/example`).

---

## Follow-up in the Obsidian vault

Done 2026-08-21, and not by waiting on the `dump_database` item — `get_projects` already
covers what these procedures needed:

- `maintain-project-folders-and-metadata.md` — Step 1 moved from JXA to `get_projects`;
  Steps 4c, 6b, and 7b.3 now reuse the project note Step 1 already returned instead of
  reading it back through AppleScript.
- `quarterly-plan-and-review.md` — Step 3 moved to `get_projects`; the `get_projects.js`
  helper is retired and dropped from the procedure's declared dependencies.
- `obsidian-omnifocus-task-reconciliation.md` — still open, for an unrelated reason. See
  the `get_task_by_id` gap above.

A procedure update means runbook + scripts + markdown + dead-code cleanup, not just the
runbook.

---

## Done — local fork maintenance

- **Superseded branches deleted** (2026-08-21) — `2026-04-security-high`,
  `2026-04-security-low`, `add-task-fields-to-formatter`, `document-desktop-install`,
  removed locally and on `origin`. Content verified preserved first: the three merge
  tips carried no unique authored commits, and `document-desktop-install`'s one unique
  commit (`af0cf28`, README heading levels) is in upstream's README today — upstream
  merged that PR and extended it. Public-fork branches on `github_public` were left
  alone. Surviving refs: `main`, `bew-local`, `bew-local-pre-2.4.0`, tag
  `bew-local-20260818`.

---

## Resolved by upstream 2.4.0 — verified 2026-08-18, do not re-open

- **Project and task IDs absent from tool output.** Structured output now exposes `id` as
  a required field on task and project schemas, plus `projectId` and `folderID`
  (`src/tools/definitions/sharedOutputSchemas.ts`).
- **`get_forecast_tasks` `includeDeferredOnly` was a no-op.** `forecastTasks.js` now reads
  it from `injectedArgs` instead of hardcoding `false`.
- **Write side forced all dates to local midnight.** `src/utils/dateFormatter.ts` now
  parses hours/minutes/seconds and emits them in `appleScriptDateCode`, defaulting to
  midnight only for bare `YYYY-MM-DD` input.
- **`list_custom_perspectives` rendered unnamed perspectives awkwardly.** The tool no
  longer exists; perspectives are handled by `manage_perspectives`.
- **Unit suite was minimal.** 68 test files ship upstream, including script-contract
  tests, covering most of the Tier 1 expansion the old list proposed.
- **Security hardening** (shell injection, incomplete AppleScript escaping, attachment
  path traversal) — reported privately as GHSA-48vm-63rp-2qp9 and fixed upstream in
  1.6.11. The attachment path guard upstream is stronger than the fork's was.

Still worth doing from the old test plan: **Tier 2 golden fixtures** — capture real
OmniJS output once and assert parsing/formatting against it, so a change in what a `.js`
script returns is flagged rather than silently mis-rendered.
