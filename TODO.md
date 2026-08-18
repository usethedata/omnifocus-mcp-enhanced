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

**Unblocks.** `maintain-project-folders-and-metadata` Step 4c — auto-archive of Done
projects, which currently uses JXA via Control your Mac to enumerate them.

---

## Open — local fork maintenance

### Narrow i18n re-application

Upstream still ships Chinese in ~16 source files and keeps adding more with each feature.
Translating all of it is a treadmill that regenerates on every sync. Only the
model-visible surface is worth carrying locally:

- `src/tools/primitives/getCustomPerspectiveTasks.ts` — the entire rendered output
- `src/context/prompts.ts` — Chinese section headings in the daily-planning prompt
- `src/utils/omnifocusScripts/getCustomPerspectiveTasks.js` — error strings
- Two tool descriptions in `src/tools/definitions/` (`getCustomPerspectiveTasks.ts`, `managePerspectives.ts`)

Do **not** translate comments, `README.zh.md`, `docs/cookbook.zh.md`, or the test
fixtures — the CJK strings in `perspectiveRuleDsl.test.ts` and friends deliberately
exercise CJK tag handling.

### Repoint Claude Desktop at this clone

`claude_desktop_config.json` still points at the old Dropbox copy
(`~/Library/CloudStorage/Dropbox/BEWMain/Progs/ai/omnifocus-mcp-enhanced/dist/server.js`),
which is a May build of the pre-2.4.0 fork. Nothing here is live until it is repointed at
`~/LocalProgs/ai/omnifocus-mcp-enhanced/dist/server.js`. The old Dropbox copy can be
deleted afterwards.

### Delete superseded branches

`2026-04-security-high`, `2026-04-security-low`, `add-task-fields-to-formatter`, and
`document-desktop-install` are all fully superseded — locally and on `origin`.

### Structured-output opportunity

Upstream added structured output to 16 of 26 tools. Worth reviewing whether the
remaining 10 would benefit, and whether any local formatting preference is better
expressed as a structured-output consumer than as a fork-local rendering change.

---

## Follow-up in the Obsidian vault

Once the `dump_database` item above lands, update the runbooks that still work around it:

- `MainVault/Myra/Runbook/maintain-project-folders-and-metadata.md` — Steps 1, 4c, 5, 6b
- `MainVault/Myra/Runbook/quarterly-plan-and-review.md` — Step 3, plus the now-dead `MainVault/Myra/Scripts/get_projects.js`
- `MainVault/Myra/Runbook/obsidian-omnifocus-task-reconciliation.md` — Step 3

A procedure update means runbook + scripts + markdown + dead-code cleanup, not just the
runbook.

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
