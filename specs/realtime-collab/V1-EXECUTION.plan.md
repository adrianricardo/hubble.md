# Hubble v1 — Orchestration Execution Plan

Derived from `V1-RELEASE.plan.md` via `/orchestrate` (2026-06-30). This is the
*execution* plan (route, phases, tiers, sequencing). The release plan is the
*what/why*; this is the *how/when*.

## Route: **Phased** (single orchestrator session, selective delegation)

**Why not Delegated:** the new build surfaces (A1, A3, B1/B1b, A5) all read/write
the same small backend set (`packages/sync-backend/convex/{schema,sync,documents,
pocIdentity}.ts`) and one frontend root (`apps/www/src/App.tsx`). Parallel cold
agents would re-discover the same files; sequential phases read them once. Later
phases conform to earlier phases' schema/API choices → phase gates, not parallelism.

**Delegation rule:** orchestrator (Opus/premier) does schema-, auth-, and
identity-sensitive work directly. Well-specified, file-disjoint standard slices
(e.g. member-management UI, @mention picker, regression suite) may be dispatched
to a Sonnet sub-agent with a path-scoped brief returning a short summary.

## State grounding (verified 2026-06-30)

- Realtime fork is **already on local `main`** (commit `1549309`); not a separate
  branch. D2 "merge to main" = land flag-off state + final gate checks.
- Presence is POC-only: `EditorView.tsx:143–199`, `testIdentity ? {docId} : "skip"`,
  `api.pocIdentity.*`. A real signed-in user sees/broadcasts no cursor. (A3)
- Flag read sites (9): `apps/{www,desktop}/src/realtimeFlag.ts`, `.../vite-env.d.ts`,
  `apps/www/src/{App.tsx,shell/AppShell.tsx,shell/Sidebar.tsx}`, `apps/www/.env*`.
- All scope decisions in the release plan are **locked**. No open product questions.

## Phase table

| Phase | Scope (release-plan IDs) | Tier | Depends on | Output / handoff |
|---|---|---|---|---|
| **P1 Backend foundation** | B1b pending-invite model · B1 member mutations · B2b anon-leak fix | premier (B1b) + standard | — | Schema + exported mutations the member UI/share dialog consume. Handoff: invite/share API shape. |
| **P2 Web auth + routing** | A1a delete ConnectScreen · A1b lift auth to router root · A1d auto-provision personal workspace | premier | P1 | `App.tsx` root = auth gate → dashboard; Convex URL baked in. |
| **P3 Dashboard surface** | A1f aggregate queries (cross-workspace recents + global search) · A1c Home (Recents/Private/Teams/Shared) · A1e Live Doc primary object · A2 share→co-edit polish | standard | P2 | A1f built adjacent to its only consumer (the dashboard) so the query shape matches the UI. |
| **P4 Production presence** | A3 real-viewer presence/cursors (un-gate heartbeat/listActive, stable name/color) | premier | P2 | Headline feature works for signed-in users. Launch-critical. |
| **P5 Completeness** | A5 version auto-snapshot · A5 @mention picker · B1c member-mgmt UI · A4 onboarding | standard (delegable) | P1, P3 | History non-empty in real use; @ picker; member UI. |
| **P6 Hardening** | B2 permission regression suite · B3 session edges · D6 cap-message UX | standard | P3, P4 | Test net (the only safety net post-flag). |
| **P7 Launch gate** | C1/C2 cross-surface QA · D1 delete flag · D2 merge gate · D3/D4 deploy · D5 ops sink · D7 signup cap | premier judgment | P1–P6 green | Production v1. Flag deletion is the **last** step. |

## Sequencing & gates

- **P1 first** — pending-invite model (B1b) is the shared-infra blocking decision
  (used by both team invites and doc sharing). Everything downstream conforms to it.
- P3 and P4 both depend on P2 (auth at root) but are independent of each other;
  done sequentially in-session (shared `EditorView`/shell context).
- **Do not start P7/D1** until P1–P6 acceptance criteria pass — with no flag
  fallback, the QA gates are the only safety net (release plan D1).
- Verify each phase: `pnpm typecheck` + `pnpm --filter @hubble.md/www build`;
  Convex via `npx convex codegen`; `pnpm build:desktop` when desktop touched.
  (`pnpm check` is Biome only — not load-bearing.)

## Status log
- 2026-06-30: plan written, route = Phased. Starting **P1**.
- 2026-06-30: **P1 backend foundation landed (uncommitted, on `main`).**
  - B2b: `sync.listWorkspaces` no longer leaks owned workspaces to anonymous
    callers (returns only legacy `ownerId===undefined` workspaces). `sync.ts`.
  - B1b: new `invites` table (`schema.ts`) + `members.ts` shared helpers
    (`upsertWorkspaceInvite`/`upsertDocumentInvite`/`resolveInvitesForUser`);
    Convex Auth `afterUserCreatedOrUpdated` callback resolves pending invites on
    signup (`auth.ts`). `documents.setUserShareByEmail` now records a pending
    invite instead of throwing when the invitee has no account (return shape →
    `{status: "shared"|"invited", userId}`; sole caller ignores it).
  - B1: `members.ts` exports `inviteWorkspaceMember`, `setWorkspaceMemberRole`,
    `removeWorkspaceMember`, `listWorkspaceInvites`, `revokeWorkspaceInvite` —
    all owner/admin-enforced, with last-owner demote/remove guards.
  - A1f relocated to P3 (couples to dashboard consumer, not the invite foundation).
  - Verified: `npx convex codegen` (typechecks Convex fns) exit 0; `pnpm typecheck`
    across all packages green.
  - **Not committed** (on default branch `main` — branch before committing).
- Next: **P2 Web auth + routing** (premier) — depends only on landed P1.
