# Realtime Collaboration Fork

This folder is the self-contained context packet for the realtime-collab fork:
what changed, why it changed, what decisions have been made, and how to continue.

For implementation pickup, start with **`PROGRESS.md`**. It is the task tracker
and source of truth for what is done, in flight, blocked, and next.

## Files

- **`PROGRESS.md`** — execution tracker. Read this first when continuing work.
- **`PRODUCT.md`** — product direction and staged user-facing outcomes.
- **`TECH.md`** — architecture, data model, risks, and stage mapping.
- **`DECISIONS.md`** — concise decision log and reasoning for the fork.
- **`SPIKE.md`** — `@convex-dev/prosemirror-sync` spike findings and remaining
  validation.
- **`OPERATIONS.md`** — vendor-neutral v1 support runbook for synced-folder
  telemetry, triage, and alert follow-up.

## ⚑ Direction update (2026-07-03) — read this first

The product framing was **repositioned** in a discovery session. The **technical
foundation is unchanged**; what changed is the *entry point*, the *v1 storage
scope*, and the *information architecture*:

- **Repo-first** is the v1 wedge (was: web-dashboard-first).
- **All-cloud** for v1 — every doc is cloud-only; **no git-mirroring** (absolute
  revocability). Git-export is a later, folder-level fast-follow.
- Model collapses to **Workspace ⊃ nested Folders ⊃ cloud Docs**; "brain" is
  informal for a repo-linked folder (no new entity).
- Wedge persona = a **non-technical, agent-native** teammate using a *local* agent
  (e.g. Claude Cowork), joining via link with **no clone, no git**.

**2026-07-03 (round 2):** the build-blocking gaps are now decided — repo link =
local-path mount into the repo (`.git/info/exclude`, no GitHub integration, no
repo reads); folder sharing = Drive-style inheritance with a **folder-scoped
guest** (not workspace membership); seeding = manual + once-seeded `BRAIN.md`
(a normal Live Document, never regenerated); **sequencing = full pivot** — the
web-first P7 operator gates (deploy/QA/ops) are paused and everything ships as
one repo-first launch. See `REPO-BRAIN-VISION.md` Decided #11–15 /
`REPO-BRAIN-RATIONALE.md` D11–D15.

Current direction docs (start here for the vision):

- **`REPO-BRAIN-VISION.md`** — decided vision, locked model, v1 scope, open questions.
- **`REPO-BRAIN-RATIONALE.md`** — the *why*: strategy, decision log, bets, risks,
  marketing language, and a second-opinion attack list.
- **`repo-brain-storyboard.html`** — visual walkthrough of the v1 happy path.
- **`REPO-BRAIN-EXECUTION.plan.md`** — the dispatch-ready implementation plan
  (RB1–RB7, model-tiered, written via `/orchestrate` 2026-07-03). **Start here
  for new implementation work.** It absorbs the deferred `V1-EXECUTION.plan.md`
  P7 operator gates into RB7 (one repo-first launch, D15).

### What's current vs. superseded

| Doc | Status under the repo-brain direction |
|---|---|
| `TECH.md` | **Current.** CRDT authority, prosemirror-sync, watcher/reconcile "one bridge", `applyPatch`, history-not-git, server-side permissions all hold. |
| `DECISIONS.md` #1–6 | **Current.** #5 (history≠git) and #6 (files are editable inputs) are *reinforced* by the pivot. |
| `PRODUCT.md` | **Mostly current** as the underlying product; wedge/entry/storage refined by `REPO-BRAIN-VISION.md`. |
| `DESKTOP-CLOUD-FIRST-IA`, `DESKTOP-NATIVE-LIVE-DOCUMENTS` | **Current / aligned** (cloud-first desktop). |
| `SYNCED-FOLDER`, `DESKTOP-ALWAYS-ON`, `OFFLINE-DECISION`, `SPIKE`, `OPERATIONS`, `PROGRESS.md` | **Current** (implementation/ops/build record). |
| `V1-RELEASE.plan.md`, `V1-EXECUTION.plan.md` | **Reordered.** Feature inventory valid; the *web-first front door* and "all scope resolved" claim are superseded by repo-first + all-cloud. |

## Current Direction

Hubble keeps its existing file-authoritative editing modes for local-only
Workspaces, Plain Folders, and Loose Files.

The fork introduces **Live Documents** as a distinct synced document mode. For a
Live Document, the authoritative state is the cloud ProseMirror/OT document stored
through Convex. Markdown becomes a projection/import/export surface for those
documents, not the normal write authority.

That split lets the fork pursue Google-Docs-style realtime collaboration without
breaking Hubble's existing desktop filesystem semantics.

## Share-Back Story

The short version for the original repo creator:

1. The existing system is file-authoritative and whole-file synced, which cannot
   safely merge simultaneous edits.
2. Realtime collaboration needs a stable cloud document identity and operational
   edit stream.
3. We introduced the Live Document concept so cloud-authoritative collaboration is
   scoped to synced realtime documents only.
4. We provisionally adopted Convex `@convex-dev/prosemirror-sync` because it fits
   the existing Convex + Tiptap stack and supports server-side transforms needed
   for future AI collaborators.
5. Remaining Stage 1 proof points are live two-browser merge, presence/cursors,
   POC identity, agent edit demo, and doc-size measurement.

Repo-level architecture decisions still live in `docs/adr/`; the Live Document
authority decision is recorded there as ADR-0009 and summarized in
`DECISIONS.md` for this fork packet.
