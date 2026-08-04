# Elicitation: Investigated And Declined

Date: 2026-08-04

## What was proposed

Replace the server's conversational confirmation convention with protocol-level
`elicitation/create`, so that a confirmation before a consequential bulk change
becomes something the model cannot skip rather than something a prompt asks it
to do.

## Why it was declined

### It cannot deliver the property that justified it

The SDK refuses the call outright when the client has not declared the
capability (`server/index.js:147-149`: *Client does not support elicitation
(required for elicitation/create)*). Any implementation must therefore check
`getClientCapabilities()` and fall back when it is absent.

Once there is a fallback, the confirmation is advisory, not guaranteed — which is
precisely the property the proposal was meant to add. Without a fallback, the
tools break on every client that has not implemented elicitation.

### The gate it would add already exists three times over

1. **Client-side approval.** Every mutating tool is already annotated
   `destructiveHint: true` (`registerTools.ts:52-57`). That annotation is the
   standard signal clients use to prompt before executing a tool, so the user is
   already asked before a destructive call runs.
2. **Conversational discipline.** `src/context/prompts.ts` encodes the
   read-propose-confirm-execute sequence and is explicit about what does not
   count: *"discussion, a draft, or an earlier general approval is not
   confirmation of the final tree"*, *"discussion or display alone is not
   confirmation"*.
3. **In-band preview.** `manage_perspectives` and `batch_edit_items` accept
   `dryRun`, which returns the exact diff and writes nothing. This gives an
   explicit preview-then-apply flow with no client capability requirement.

### It conflicts with a stated design principle

The roadmap's design principles say to avoid "execution-mode matrices, and
protocol-level controls unless a demonstrated workflow needs them", and to keep
preflight and verification inside the implementation rather than exposing
switches. The v1.14 design applied this specifically to confirmation: proposal
review happens conversationally, and the tool exposes no `previewOnly` or
`verify` switch.

### It introduces a failure mode the current design does not have

An elicitation round-trip inside a mutating tool can time out or be cancelled
after preflight has run. That either wastes the preflight or, if placed later,
risks abandoning a partially prepared transaction — against a protocol whose
whole point is that a request either applies completely or leaves the database
untouched.

## Where it would be defensible

Only for irreversible deletion — `batch_remove_items`, `remove_item`, and
`manage_folders` with `action: "remove"`, which permanently deletes contained
projects and tasks. Even there it duplicates the client's own destructive-tool
prompt, so it would be defence in depth rather than a new guarantee.

If it is ever added, it must be capability-gated, must run before any preflight
work, and must be limited to cascading deletion. It should not be applied to the
batch edit, move, or complete tools, whose changes are all recoverable.

## Recommendation

Do not add elicitation. Spend the effort instead on the eleven read primitives
that still return pre-formatted strings and cannot carry structured output
(`2026-08-04-structured-output-design.md`), which is a concrete gap with
measurable value for an assistant.
