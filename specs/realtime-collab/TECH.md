# Realtime Collaboration — Technical Spec

Companion to `PRODUCT.md`. Grounded in the current source as of the fork point.

## Current architecture (what we're changing)

- **Editor**: Tiptap v3 / ProseMirror with custom markdown↔ProseMirror conversion
  in `packages/editor` (`markdownToProsemirror.ts`, `prosemirrorToMarkdown.ts`).
  No Yjs, no CRDT, no `@tiptap/extension-collaboration`.
- **Editor save path**: every Tiptap update is serialized to a full markdown
  string via a debounced save callback (`packages/ui/src/editor/EditorView.tsx`).
  **The document is file-authoritative.**
- **Backend**: Convex (`packages/sync-backend/convex`). Schema = `workspaces`,
  `files`, `assets`. The `files` table stores the **full `content` string** +
  `contentHash` (`convex/schema.ts`).
- **Sync**: `packages/sync/src/sync.ts` — whole-file, content-hash,
  **last-write-wins** reconciliation. On divergence it writes a
  `*.conflict-<timestamp>` copy (`toConflictName`). Batch/polling, not live.
  Abstracted behind `SyncBackend` (`packages/sync/src/backend.ts`).
- **Conflict classification**: desktop/web explicitly classify external changes as
  reload/conflict/match (`apps/desktop/src/externalFileChange.ts`,
  `apps/www/src/store/actions.ts`). **Multiplayer deletes this entire class of
  user-visible conflict for live documents.**
- **No auth/users/permissions** anywhere in the schema or apps.
- **Documents are addressed by file path**, not stable ID.

## Core architectural decision

> **For Live Documents, the cloud realtime document (CRDT/OT, stored in Convex)
> is authoritative. Filesystem sync becomes an import/export/projection subsystem
> for those Live Documents. Everything else — permissions, history, agent
> workflows — depends on this.**

Make this commitment *before* building permissions, history, or the agent layer.
Retrofitting authority later means reworking every query. This commitment is
scoped to Live Documents; local-only Workspace editing, Plain Folder editing, and
Loose File editing remain file-authoritative.

## Target stack

- **Editor**: keep Tiptap; add the collaboration binding.
- **Realtime + persistence**: **Convex `@convex-dev/prosemirror-sync`** (official
  component: OT-based conflict-free merge, doc stored in Convex, presence). We are
  already on Convex + Tiptap, so this avoids a second backend authority.
  - **Decision gate (Stage 1 spike)**: validate doc-size limits, offline behavior,
    version-snapshot hooks, auth integration, and **server-side / programmatic
    edits** (needed for the agent layer). If it fails a hard requirement, fall back
    to **Yjs on Cloudflare Durable Objects + `y-websocket`** (Adrian already runs
    Cloudflare infra) or a managed layer (Liveblocks/PartyKit). Do *not* adopt the
    fallback without a concrete failing requirement.
- **Why not InstantDB**: it's a strong realtime relational DB but has no built-in
  ProseMirror/CRDT document component — the central rich-text complexity remains,
  and switching discards the existing `SyncBackend`, Convex client wrappers, and
  asset/workspace logic for no architectural payoff. **Stay on Convex.**

## Data model changes (Convex schema)

New/changed tables (illustrative — finalize during Stage 2/3):

```
users         { authId, name, email, image }
workspaces    { name, createdAt, ownerId }                       // + ownerId
members       { workspaceId, userId, role }                      // workspace membership
documents     { id (stable), workspaceId, title, path?, createdBy,
                createdAt, updatedAt, updatedBy, deletedAt? }     // NEW: doc identity
docShares     { documentId, userId|null, linkScope?, role }      // per-doc roles + link sharing
prosemirror   { ...managed by the collab component... }          // CRDT/step state
revisions     { documentId, createdAt, actor, label?,
                pmDoc (JSON), markdown, crdtMeta }                // version history
comments      { documentId, anchor, threadId, authorId, body, resolvedAt? }
assets        { ...existing... }                                 // stays LWW
```

Key shifts:
- **Stable `documents.id`** replaces path-as-identity. Path/title become mutable
  metadata. This fixes renames, moves, and history/comment anchoring under
  concurrent edits. *(Path-identity is a real risk in the current code.)*
- **Roles enforced server-side** in every query/mutation. A viewer must never
  receive editable document steps — enforce at the data boundary, not the client.

## Agent layer (Model C) — detail

- **Document patch API** (Convex mutations + an MCP server / `hubble` CLI surface):
  - `getDocument(id) → { revision, markdown, outline }` — `outline` (heading map)
    lets agents target edits **without ingesting the whole doc** (token efficiency).
  - `applyPatch(id, baseRevision, intent)` where intent ∈ {replace-range,
    insert-after-heading, markdown-patch}. Server converts intent → ProseMirror
    steps → CRDT transaction, **attributed to the agent**, streamed to all clients.
    If the doc moved past `baseRevision`, the server rebases or rejects — never
    blind-overwrites.
  - Edits can **stream** (token-by-token → steps → broadcast) so humans see "agent
    editing…" live.
- **Bidirectional file projection** *(revised — was read-only)*: the markdown file
  on disk is continuously re-materialized from the authoritative doc **and** is an
  editable input. The always-on desktop app watches Live Document files; on an
  external save it reconciles the change back into the CRDT (see "Bidirectional file
  reconciliation"). Agents/tools still read/grep/back it up.
- **Legacy file-only shim → generalized reconcile path**: the staging-file shim was
  the special case; the watcher now handles *any* external editor (human or agent),
  always against a known base. The CLI shim command remains for headless/CI agents.
- **Suggestion mode**: untrusted agents propose changes (track-changes) that a
  human accepts; trusted agents may auto-apply.

## Bidirectional file reconciliation (Live Documents)

Restores "edit the file in any app" for Live Documents without giving up CRDT
authority. Direction decided; on-disk projection path TBD.

**Flow (external save → collaborators):**

1. The desktop app's **main process** watches Live Document files (chokidar).
2. On save, read the file and load the per-file **last-synced base** from a local
   cache (e.g. `.hubble/state/<documentId>.base.md` + revision).
3. Text-diff disk vs. base (`fast-diff`/`jsdiff`).
4. Convert the diff to a **scoped patch** and call `applyPatch(id, baseRevision,
   { kind: "replace-range" | "markdown-diff", ... })`. The server converts only the
   changed range markdown→steps against `baseRevision`, writes via
   `prosemirrorSync.transform`, and broadcasts.
5. On success, update the base cache to the new revision + re-materialized text.

**Why it's safe:** the diff yields *operations*, which the CRDT merges with
concurrent remote edits (idempotent/commutative) — no whole-file overwrite. The
lossy markdown→steps conversion is bounded to the changed range against a known
base. Prior art: Yjs + File System Access API (Motif).

**Backstop:** if the base cache is missing/stale or the patch can't be safely
scoped, write the disk version to `*.local-edit-<ts>` and re-materialize from the
authoritative doc — never silently clobber (mirrors today's `*.conflict-<ts>`).

**Permissions:** reconciliation runs through the same `checkWrite` checks as in-app
edits — a viewer's external file edit is rejected, and a viewer's projection is
materialized read-only.

**Desktop lifecycle (single always-on app):** the Electron main process hosts the
watcher + sync engine and survives window close (`window-all-closed` → keep running;
system-tray indicator; quit only via tray/menu). The user opens one app; closing
the window leaves it syncing in the background. The renderer is just UI.

**Offline:** in-editor offline relies on CRDT local buffering/replay (spike-gated;
Yjs/`y-indexeddb` fallback). External-file offline edits queue in the watcher and
flush on reconnect via the same reconcile flow.

### Code changes required (revising already-written code)

The earlier stages implemented the *read-only* Model-C projection. This decision
revises that. Concrete deltas against current source:

1. **`applyPatch` intents** (`convex/documents.ts`): add a diff/range intent
   (`replace-range` / `markdown-diff`) so external edits apply as a **scoped patch**.
   Today only `replace-document` (whole-file), `append-markdown`, and
   `insert-after-heading` exist; the shim uses whole-file `replace-document`, which
   clobbers concurrent edits.
2. **Shim → continuous reconcile** (`packages/cli/src/index.ts` shim cmd +
   `packages/sync`): the shim watches a *separate staging file* and does whole-file
   replace. Generalize to: watch the **projection file itself**, diff vs. a
   **last-synced base cache**, emit a scoped patch. Keep the CLI shim for headless
   agents.
3. **Projection writer** (`packages/sync/src/sync.ts`
   `writeLiveDocumentProjections`): today writes read-only to
   `.hubble/projections/live-documents` with no base cache. Add a **base-cache
   write** (text + revision per doc) so the watcher can diff; revisit the on-disk
   path (editable location TBD).
4. **Desktop app lifecycle** (`apps/desktop/src`): no `Tray` / `window-all-closed` /
   background-run handling exists today, and the live-doc watcher/sync engine does
   **not** run in the desktop main process (sync is CLI-only). Add background-process
   + tray and host the watcher in main.
5. **External-change classification** (`apps/desktop/src/externalFileChange.ts`,
   `apps/www/src/store/actions.ts`): currently classifies external changes as
   reload/conflict/match for file-authoritative docs. For Live Documents, route
   external changes to the **reconcile path** (no conflict files) and keep the
   conflict copy only as the base-cache backstop.
6. **Permissions on the inbound path** (`convex/permissions.ts` + watcher): ensure
   reconciliation patches pass `checkWrite`; materialize read-only projections for
   viewers so their file edits can't even be attempted.

Stages 1–3 (realtime POC, doc entities, permissions) are largely unaffected; the
revisions land in Stage 4 (projection/shim) and Stage 6 (watch/offline), plus the
desktop-app lifecycle work.

## Version history (not git)

- The CRDT is the live editing substrate; **don't** expose raw CRDT internals as
  the history UI, and **don't** model history as git commits/branches.
- On meaningful boundaries (debounce windows, session close, manual "name this
  version", and **before any restore**), materialize a `revisions` row:
  `{ documentId, createdAt, actor, label?, pmDoc (ProseMirror JSON), markdown,
  crdtMeta }`.
- **Restore = a new change** that replaces current content with the chosen
  revision's content. It never mutates history.
- Storing both `pmDoc` (for faithful restore/diff/preview) and `markdown` (for
  export/search) is the robust middle path — raw-CRDT-only makes preview/diff hard;
  markdown-only loses editor state.

## Risks & mitigations

- **Markdown projection correctness.** The custom converter is correctness-critical
  in **both** directions now: doc→markdown on read, and markdown→steps on the
  reconcile path. Mitigate: scope inbound conversion to the **changed range against a
  known base** (never whole-file on the normal path), keep a base cache + a
  conflict-copy backstop, and add round-trip property tests for tables, frontmatter,
  embeds, custom nodes. Whole-file markdown→doc remains only for explicit import.
- **Path identity.** Move to stable document IDs early (Stage 2) before sharing and
  history anchor to anything.
- **Permissions retrofit.** Design roles into queries from Stage 3's first mutation,
  not bolted onto clients.
- **Assets + collaboration.** Rich docs need asset ownership, permissions, GC, and
  versioned references; assets stay LWW but gain doc-scoped permission checks.
- **Second-backend creep.** If the collab component forces a Durable-Objects/Yjs
  fallback, keep Convex as the source of truth for documents/permissions/history
  and treat the realtime layer as transport only — avoid two authorities.

## Stage → engineering mapping

1. **POC**: add collab component, bind to Tiptap, auth-gate, presence cursors, one
   shared doc. Spike answers the decision gate.
2. **Doc entities**: `documents` table + stable IDs, Live Document CRUD in web app,
   markdown projection on read, migrate file-sync to import/export for Live
   Documents.
3. **Permissions**: `users`/`members`/`docShares`, auth provider, server-side
   enforcement, share dialog + link sharing.
4. **Agent layer**: patch API (+ scoped `replace-range`/`markdown-diff` intent),
   MCP/CLI, bidirectional projection writer + base cache, file-reconcile watcher
   (generalized shim), suggestion mode.
5. **History & review**: `revisions` + restore UI, comments/threads, track-changes,
   activity feed.
6. **Polish**: desktop always-on/tray + main-process watcher, folders/search/
   export/import, offline merge (in-editor + file-reconcile), audit log, trash,
   admin.

## Notes

- `origin` still points at upstream `bholmesdev/hubble.md`. Repoint to the fork
  before pushing fork-specific work.
- This spec reflects the second-opinion review (Codex) and source reading done at
  the fork point; revisit the decision gate after the Stage 1 spike.
