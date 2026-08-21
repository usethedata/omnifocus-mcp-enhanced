# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Build & Run

```bash
npm install            # Install dependencies
npm run build          # clean → typecheck → tsc --noCheck → copy-files → prune-dist
npm test               # Build (build:test), then run the compiled test suite
npm run typecheck      # tsc --noEmit, no output written
npm start              # Run the MCP server
npm run benchmark:smoke
```

The build copies the OmniJS scripts from `src/utils/omnifocusScripts/` into `dist/`
rather than compiling them — they are plain JS that runs inside OmniFocus. `npm test`
builds first, then runs `node --test` over the compiled `dist/**/*.test.js` plus
`scripts/*.test.mjs`. The suite is Node's built-in runner (`node:test` +
`node:assert/strict`) with no third-party test dependencies, and covers pure logic
only — it never touches OmniFocus. Anything crossing the live boundary still needs
manual testing on a Mac with OmniFocus running.

## Architecture

An MCP server exposing OmniFocus over stdio via `@modelcontextprotocol/sdk`, using
AppleScript and OmniJS. It registers **26 tools (16 with structured output), 6 prompts,
and 3 resources** — `src/tools/documentedCounts.test.ts` asserts the READMEs match, so
update the docs when you add one.

```
MCP client → server.ts → tools/registerTools.ts → tools/definitions/* → tools/primitives/*
          → utils/scriptExecution.ts → osascript → OmniFocus
```

### Two-tier tool pattern

- **`src/tools/definitions/`** — MCP contract: Zod input schemas, output schemas, handlers, response formatting.
- **`src/tools/primitives/`** — Business logic: builds scripts, calls the execution utilities, returns structured data.

`registerTools.ts` holds the `TOOLS` table and registers each entry with the server.

### Two script execution paths — the distinction matters for safety

- **AppleScript** (`executeAppleScript`) — builds a script by **interpolating values into
  a string**, writes a temp `.scpt`, runs `osascript`. Eleven primitives use it:
  `addFolder`, `addOmniFocusTask`, `addProject`, `addTag`, `appendToNote`, `editFolder`,
  `editItem`, `editTag`, `removeFolder`, `removeItem`, `removeTag`. `batchAddItems` fans
  out to `addOmniFocusTask`/`addProject`, so it is on this path too.
  **Every user-supplied value on this path must go through `escapeAppleScriptString`.**
- **OmniJS** (`executeOmniFocusScript`) — passes arguments as `JSON.stringify`'d
  `injectedArgs` into a script loaded by name from `src/utils/omnifocusScripts/`
  (30 files, `@`-prefixed, name-validated). Values cannot alter script structure here.

Script content is embedded with `JSON.stringify`, temp filenames use `randomUUID()`, and
execution is `execFile` (never a shell). Do not reintroduce `exec`, manual escaping of
script bodies, or predictable temp paths.

### Key modules

- **`server.ts`** / **`tools/registerTools.ts`** — initialization and tool registration
- **`src/context/`** — prompts, resources, and the daily-planning context (`prompts.ts`, `resources.ts`, `omnifocusData.ts`, `dailyPlanning.ts`)
- **`omnifocustypes.ts`**, **`types.ts`**, **`version.ts`** — core interfaces, OmniFocus enums, version metadata
- **`utils/scriptExecution.ts`** — script execution and parameter injection
- **`utils/appleScriptString.ts`** / **`appleScriptJson.ts`** — escaping for generated AppleScript
- **`utils/sanitize.ts`** — strips isolated Unicode surrogates that break JSON serialization
- **`utils/perspectiveEngine.ts`**, **`tools/primitives/perspectiveTaskTree.ts`**, **`taskTreeFormatter.ts`** — filtering, tree-building, rendering

## Local fork conventions

### Input length caps

Tool inputs on the AppleScript path carry `.max()` bounds so oversized values cannot
reach `osascript`. Escaping is what makes the path safe; the caps bound its size.

| Field kind | Cap |
|---|---|
| Names (task, project, folder, tag, parent) | 1,000 |
| Notes and appended text | 10,000 |
| Date strings and date shifts | 50 |
| IDs | 200 |
| Individual tag | 200 |
| Tag arrays | 50 entries |
| Batch item arrays | 100 entries |
| `ruleString` (ICS recurrence) | 500 |
| `separator` | 100 |

When adding a field to an AppleScript-path schema, cap it to match and extend
`src/tools/definitions/inputCaps.test.ts`. The tests exist so an upstream merge cannot
silently drop the bounds. Fields on the OmniJS path do not need caps.

## Remotes

- **`origin`** — a private Git server on the local network. Default push target, holds every branch.
- **`github_public`** — the public fork on GitHub. Synced to upstream.
- **`upstream`** — `jqlts1/omnifocus-mcp-enhanced` on GitHub. **Fetch only; never push.**

## Branches

- **`main`** — a pure mirror of `upstream/main`. Fast-forward only; never commit to it
  directly. Keeping it clean is what makes future syncs a fast-forward rather than a merge.
- **`bew-local`** — all local work, branched from `main`. Sync by merging **`main` into
  `bew-local`**, never the reverse.
- **`bew-local-20260818`** (tag) and **`bew-local-pre-2.4.0`** (branch) — the fork as it
  stood before the rebuild onto upstream 2.4.0, when `main` was still four months behind.
  Kept for reference; nothing should be merged forward from it without checking whether
  upstream has since covered it.

There are no push restrictions and no pre-push hook. The security work that once
justified them is public: all three high-severity findings were reported privately
(GHSA-48vm-63rp-2qp9) and fixed upstream in 1.6.11, so `bew-local` no longer carries
anything sensitive.

## Two machines

This repo is cloned independently on two Macs, each at
`~/LocalProgs/ai/omnifocus-mcp-enhanced`, deliberately outside any file-sync folder — a
synced `.git` caused problems. Git is the only sync mechanism.

- `dist/` and `node_modules/` are gitignored and built per machine. Never copy them between machines.
- `git pull --ff-only` before starting work; both machines push `bew-local` to `origin`.
- Never force-push `bew-local` — it is the other machine's backup.
- The Claude Desktop config (`claude_desktop_config.json`) is machine-local and not in
  git; it holds an absolute path to `dist/server.js` and the node binary, both of which
  differ per machine.

## Upstream relationship

A fork of `jqlts1/omnifocus-mcp-enhanced`. Upstream is actively developed. Keep
upstream-bound changes clean and separable from local customizations, and prefer porting
an upstream fix verbatim over writing an equivalent one, so future merges stay trivial.

The Omni Group has signalled a first-party OmniFocus MCP with no announced timeline. If
it ships with adequate functionality it may supersede this server, which argues against
investing in local divergence that has to be re-applied on every sync.
