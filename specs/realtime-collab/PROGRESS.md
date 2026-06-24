# Realtime Collaboration — Progress Tracker

**This is the single source of truth for where implementation stands.**
Next agents can start here and continue the first unfinished task in the lowest
numbered incomplete stage.

For the share-back packet around the fork, this folder is self-contained:
`README.md` gives the overview, `PRODUCT.md` gives the product direction,
`TECH.md` gives the architecture, `DECISIONS.md` gives the decision log and
reasoning, and `SPIKE.md` gives the prosemirror-sync spike findings.

---

## 🔴🟡🟢 How agents read & update this file

**Before starting work**, read this whole file top to bottom. Pick up the
first task that is `[ ]` (not started) within the lowest-numbered stage that
isn't `🟢 Done` — stages are ordered and later stages assume earlier ones.

**Status legend** (used on stages and tasks):

- `🔴 Not started` / `[ ]` — no work begun
- `🟡 In progress` / `[~]` — actively being worked or partially landed
- `🟢 Done` / `[x]` — complete, merged, and verified
- `⛔ Blocked` / `[!]` — blocked; the **Blocked on** note says why

**When you START a task:** set it to `[~]`, fill `Owner` and `Started`.

**When you FINISH a task:** set it to `[x]`, fill `Landed` (date) and the
PR/commit link. If it completes a stage, update the stage banner to `🟢 Done`.

**Always append a dated line to the Changelog** at the bottom describing what
changed — this is the human-readable audit trail. Keep checklist edits and the
changelog entry in the **same commit** as the code, so progress never drifts
from reality.

**Do not delete tasks.** If a task becomes obsolete, mark it `[x]` with a note
`(dropped: <reason>)` or `[!]` if it's superseded. Add newly-discovered tasks to
the right stage rather than silently doing extra work.

**Keep it honest:** `[x]` means merged + verified, not "wrote the code." If
tests fail or a step was skipped, say so in the task note.

---

## Stage status overview

| Stage | Status | Summary |
|---|---|---|
| 1. Realtime editing POC | 🟡 In progress | Spike scaffolded; gate provisionally passed (see SPIKE.md). POC identity gate added locally; live two-browser test pending. |
| 2. Documents as cloud entities | 🔴 Not started | Stable doc IDs, doc CRUD, markdown projection |
| 3. Team permissions | 🔴 Not started | Users, members, per-doc roles, sharing |
| 4. Agent collaboration (Model C) | 🔴 Not started | Doc patch API + MCP/CLI, projection, legacy shim |
| 5. Version history & review | 🔴 Not started | Revisions + restore, comments, suggestions |
| 6. Docs-parity polish | 🔴 Not started | Folders, search, export/import, offline, admin |

---

## Stage 1 — Realtime editing POC 🟡

Goal: two authenticated humans co-edit one document live, conflict-free, with
presence cursors. **Resolves the `prosemirror-sync` decision gate (TECH.md).**

- [~] **Spike `@convex-dev/prosemirror-sync`** against the decision gate. Findings
      in **`SPIKE.md`**: server-side agent edits ✅, versioning hooks ✅, auth hooks
      ✅, Tiptap client ✅; **offline ❌ (not implemented upstream)**; doc-size +
      live two-browser test ⚠️ unverified (need interactive `convex dev`).
      Scaffold landed: `convex/convex.config.ts`, `convex/prosemirror.ts` (incl.
      `agentAppendParagraph` server-edit proof), dep added to `package.json`.
      — *Owner: Adrian/agent · Started: 2026-06-24 · Landed: _ · PR: spike branch*
- [~] Decision gate outcome: **provisionally ADOPT prosemirror-sync** (hard gates
      pass on existing Convex stack). Finalize to `[x]` after the live two-browser
      + doc-size test. Fallback documented in SPIKE.md if a hard gate fails. — *_*
- [~] Run `pnpm install` + `convex dev` (interactive login) to generate the
      component API so `prosemirror.ts` typechecks. Local anonymous deployment
      generated; `convex dev --once --typecheck enable` passes. Unmerged. —
      *Owner: Codex · Started: 2026-06-24*
- [~] Export the editor ProseMirror schema from `packages/editor` and wire the
      `transform()` body in `agentAppendParagraph`. Implemented locally with
      shared schema helper; `agentAppendParagraph` now calls
      `prosemirrorSync.transform`. Unmerged. — *Owner: Codex · Started: 2026-06-24*
- [~] Add the collaboration binding (`useTiptapSync`) to the Tiptap editor
      (`packages/ui` / `apps/www`). Implemented locally for web POC docs behind
      `ConvexProvider`; live two-browser test pending. Unmerged. —
      *Owner: Codex · Started: 2026-06-24*
- [~] Auth-gate the web app enough to identify two distinct users for the POC.
      Implemented locally as a browser-scoped test identity gate for `?test=1`
      (`?testUser=Ada` or in-app prompt) plus a Convex `livePocUsers` heartbeat
      so two browser sessions can identify themselves on one POC doc. This is
      intentionally not the Stage 3 production auth provider. Verified `pnpm
      check`, `@hubble.md/www` typecheck/build, `pnpm build:desktop`, and
      `convex dev --once --typecheck enable`; in-app browser smoke was blocked by
      browser runtime startup failure. Unmerged. — *Owner: Codex · Started:
      2026-06-24*
- [~] One shared document renders live for two browsers; concurrent edits merge
      with no conflict file. Locally verified by human test on `realtime-poc.md`
      with two browser identities; no conflict banner/file appeared. Unmerged. —
      *Owner: Adrian/Codex · Started: 2026-06-24*
- [~] Presence cursors (who's here, where their caret is). Implemented locally as
      a Convex-backed POC cursor layer: `livePocUsers` now stores optional
      ProseMirror `anchor/head`, the web editor publishes throttled selection
      heartbeats, and `packages/ui` renders remote cursor/selection
      decorations. Locally human-verified in two browsers. Verified `pnpm
      check`, UI/www typechecks, `@hubble.md/www` build, and `pnpm
      build:desktop`; Convex one-shot typecheck was skipped because the local
      backend was already running on port 3210. Unmerged. — *Owner: Codex ·
      Started: 2026-06-24*
- [~] Confirm agent edit (`agentAppendParagraph` from the Convex dashboard) appears
      live in both browsers. Locally verified via Convex CLI against
      `poc:jd72rs2kfn4gj8yeavk2m05ccs899r3t:realtime-poc.md`; both browser
      sessions updated live. Unmerged. — *Owner: Adrian/Codex · Started:
      2026-06-24*
- [~] **Exit criteria:** two browsers, simultaneous typing, conflict-free, cursors
      visible, agent edit shows live. Locally human-verified on
      `realtime-poc.md`; demoable from local Convex + web dev servers. Keep `[~]`
      until merged. — *Owner: Adrian/Codex · Started: 2026-06-24*

## Stage 2 — Documents as cloud entities 🔴

- [ ] `documents` table with **stable IDs**; path/title become mutable metadata. — *_*
- [ ] Document CRUD (list/create/rename/delete) in the web app. — *_*
- [ ] One-way markdown **projection on read** (doc → markdown). — *_*
- [ ] Migrate the whole-file sync path (`packages/sync`) to an import/export role. — *_*
- [ ] "Last edited by / at" on documents. — *_*

## Stage 3 — Team permissions 🔴

- [ ] Auth provider chosen + wired (Convex Auth / Clerk / WorkOS). — *_*
- [ ] `users`, `members` (workspace membership) tables. — *_*
- [ ] `docShares`: per-document roles (owner/editor/commenter/viewer) + link sharing. — *_*
- [ ] **Server-side enforcement on every query/mutation** — a viewer never receives
      editable steps. — *_*
- [ ] Share dialog UI. — *_*

## Stage 4 — Agent collaboration layer (Model C) 🔴

- [ ] `getDocument(id) → { revision, markdown, outline }` (outline enables targeted,
      token-efficient edits). — *_*
- [ ] `applyPatch(id, baseRevision, intent)` → steps → CRDT txn, **attributed to the
      agent**, streamed; rebase/reject if `baseRevision` is stale. — *_*
- [ ] MCP server + `hubble` CLI surface for the patch API. — *_*
- [ ] Read-only markdown projection writer on disk. — *_*
- [ ] Legacy file-only **shim**: staging file → `applyPatch(markdown-patch)`. — *_*
- [ ] Suggestion mode (agent proposes, human accepts). — *_*

## Stage 5 — Version history & review 🔴

- [ ] `revisions` table: `{ documentId, createdAt, actor, label?, pmDoc, markdown,
      crdtMeta }`, materialized on boundaries + before restore. — *_*
- [ ] Version history UI: browse + **restore as a new change** (never mutate history). — *_*
- [ ] Comments + threads anchored to text, @mentions, resolve. — *_*
- [ ] Track-changes / suggestion review UI. — *_*
- [ ] Activity feed + notifications. — *_*

## Stage 6 — Docs-parity polish 🔴

- [ ] Folders / shared drives. — *_*
- [ ] Cross-document search. — *_*
- [ ] Export (md/PDF/docx) + import. — *_*
- [ ] Offline edit + merge on reconnect. — *_*
- [ ] Audit log, trash + restore, admin/role management. — *_*

---

## Changelog

Newest first. One line per meaningful change: `YYYY-MM-DD — who — what`.

- 2026-06-24 — Codex — Continued Stage 1 local implementation: added a `?test=1`
  POC collaborator identity gate (`?testUser=...` or prompt), Convex-backed
  `livePocUsers` heartbeat/listing, and a live editor identity bar. Verified
  `pnpm check`, `@hubble.md/www` typecheck/build, `pnpm build:desktop`, and
  Convex `dev --once --typecheck enable`. Browser smoke via the in-app browser
  was blocked by a `node_repl` startup error; HTTP route served from Vite.
- 2026-06-24 — Adrian/Codex — Locally verified Stage 1 two-browser realtime
  editing on `realtime-poc.md` with no conflict banner/file, and verified
  `agentAppendParagraph` streams an agent paragraph live into both browsers.
  Remaining Stage 1 blocker: presence cursors.
- 2026-06-24 — Codex — Implemented the Stage 1 POC presence cursor layer:
  selection heartbeats now write `anchor/head` to Convex, active collaborators are
  rendered as remote caret/selection decorations in the shared editor, and builds
  pass. Remaining: human two-browser visual confirmation.
- 2026-06-24 — Adrian/Codex — Human-verified Stage 1 exit criteria locally:
  simultaneous two-browser editing merged without conflict files, presence cursors
  rendered across browsers, and `agentAppendParagraph` appeared live. Stage stays
  `[~]` until merged.
- 2026-06-24 — Codex — Added realtime-collab `README.md` and `DECISIONS.md` so
  the fork has a self-contained context packet for share-back. `PROGRESS.md`
  remains the implementation pickup source of truth.
- 2026-06-24 — Codex — Documented the authority-model decision: Live Documents
  are cloud-authoritative, while local-only Workspace editing, Plain Folder
  editing, and Loose File editing remain file-authoritative. Added ADR-0009 and
  glossary/spec language.
- 2026-06-24 — Codex — Continued Stage 1 local implementation: ran `pnpm install`,
  generated Convex component API on a local anonymous deployment, added shared
  editor schema export, wired `agentAppendParagraph` transform, and added web
  `useTiptapSync` POC binding. Verified `pnpm check`, `pnpm build:desktop`,
  `@hubble.md/www` typecheck, and Convex `dev --once --typecheck enable`.
  Remaining: live two-browser test, presence strategy, auth identity, and agent
  dashboard proof.
- 2026-06-24 — spike — Stage 1 `prosemirror-sync` spike: gate findings recorded in
  SPIKE.md (server-side agent edits ✅, versioning ✅, auth hooks ✅, Tiptap ✅;
  offline ❌; doc-size + 2-browser ⚠️ unverified). Provisional decision: ADOPT.
  Scaffolded `convex.config.ts`, `prosemirror.ts`, dep in `package.json`. Did NOT
  run `pnpm install`/`convex dev` (interactive) — `prosemirror.ts` won't typecheck
  until then (expected). Next: `pnpm install` + `convex dev`, then wire schema +
  `useTiptapSync`.
- 2026-06-24 — setup — Spec + progress tracker created; fork at
  `adrianricardo/hubble.md` (`origin`), `upstream` → `bholmesdev/hubble.md`.
  Nothing built yet; Stage 1 is next.
