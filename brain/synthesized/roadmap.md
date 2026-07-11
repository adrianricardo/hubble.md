# Roadmap / Current State

Build-state half of the roadmap. Track strategy/sequencing moved to the cloud brain
(`brain/cloud/synthesized/track-strategy.md` when mounted) — split 2026-07-10 by the
hubble-init apply run.

## ➤ NEXT STEP (updated 2026-07-09, post-apply-run)

**Apply-mode is built and has run for real once**: `567-platform/brain` was split into
the "567 Brain" Hubble workspace on dev (Adrian's call to use a real repo instead of a
throwaway corpus; git remote = the safety net). Move commit `567-platform@180eebc`,
run record `/specs/hubble-init/runs/2026-07-09-567-brain-apply-run.md`, skill rules
13–16 extracted. CLI grew auth-token plumbing + `folder create/list/export` +
`document create` (uncommitted → committed this session).

Next session, in order:

1. ~~Desktop repo-link the "567 Brain" folder~~ **✅ verified 2026-07-10** live with
   Adrian: workspace "567 Product Brain" appears via owner membership in the
   repo-link picker (gap #10 fix not needed for this path), mounted over
   `567-platform/brain/cloud/` (repo root = 567-platform), git exclude + BRAIN.md
   confirmed, and live watch verified BOTH directions — app edit → file, and file
   append → cloud reconcile in ~5s. Stale CLI export archived and replaced by the
   live mount. UX learnings: the repo picker wants the git root (users try the
   mount dir — "not a repo" error), and the mount-path field silently keeps stale
   values across relinks.
2. ~~Fix serializer bugs (DESIGN.md §Gap #8)~~ **✅ done 2026-07-10** (working
   tree, uncommitted): all four bugs fixed in `packages/editor` — nested-emphasis
   divergence, lone `~` doubling, verbatim frontmatter round-trip (frozen
   decision: opaque block, no structured editing), bare-URL/autolink
   preservation. `roundTrip.test.ts` is the idempotency guard. Follow-up: four
   call sites pre-strip frontmatter and should adopt the new path
   (`packages/ui` EditorView ×2, desktop `App.tsx`, www EditorView). Gap #9
   (workspace ownership transfer / `hubble login`) is the auth follow-up.
3. ~~Split THIS repo's `brain/`~~ **✅ done 2026-07-10** — Track C target 2 executed
   by the hubble-init apply run: 10 docs (8 whole + cloud halves of decision-log and
   roadmap) → "Hubble Brain" folder, workspace "Hubble Product Brain" (dev), Adrian
   owner member. Export-diff gate passed (whitespace normalization + one mark-order
   canonicalization; zero content loss; all exports are round-trip fixed points).
   RESOLVER+BRAINKEEPER consolidated into one governance doc. Run record:
   `/specs/hubble-init/runs/2026-07-10-hubble-brain-apply-run.md`.

## ➤ NEXT STEP (updated 2026-07-11, Phase 2 implemented)

**Phase 1 of `/specs/hubble-init/MAGIC-FLOW-PLAN.md` is implemented in the working
tree**: `hubble login` device-flow auth now creates one-time device requests,
approves them through `/device`, stores a Convex Auth refresh token in
`~/.hubble/credentials.json`, and refreshes CLI JWTs through `auth:signIn`.
Apply-mode guidance now assumes workspaces are created as the logged-in user instead
of through throwaway accounts.

**Phase 2 of `/specs/hubble-init/MAGIC-FLOW-PLAN.md` is implemented in the working
tree**: the desktop app registers `hubble://`, exposes a 0600 Unix CLI socket,
accepts `status` + `link-repo`, runs socket mounts through the same repo-link helper
as the settings UI, deletes stale `.hubble-export.json` markers, pushes an undo toast,
tracks `lastReconcileAt`, and exposes clean-undo removal based on the sync index.
`hubble mount` now launches/contacts the app, guards deployment/account mismatch,
links the repo, and exits only after the app reports a live connected mount with the
sync index present. `hubble cloud folder export` now writes `.hubble-export.json` so a
static projection cannot masquerade as live.

Next build step: dogfood Phase 2 by relinking `brain/cloud/` live, then Phase 3 =
ensure-desktop install magic; Phase 4 = repo-link form fixes.

Backlog (non-blocking): serializer continuation-indent preservation
(`packages/editor`, whitespace-only normalization from the split run); frontmatter
call-site adoption (4 sites); Track D vision extraction (Adrian-gated); production
deploy/QA gates still not run.

## Where the build actually is (2026-07-09)

- Branch `v1-release`. RB1–RB7 repo-brain code phases are **committed** (folder shares,
  guest web experience, desktop repo-link mount + BRAIN.md seeding, guest onboarding,
  launch-gate prep) — see git log 2026-07-03..05.
- GFM table support **committed** (`65c21c6`): shared Tiptap table schema, markdown
  round-trip, slash-command insertion, floating table controls. Shipped mid-apply-run
  after the run's verification caught tables being silently dropped (the exact
  data-loss bug the safety gate exists for); dev backend redeployed with it.
- **Uncommitted work in the tree** (not yet described by any doc): `SpaceSwitcher.tsx`,
  `packages/cloud-ui/`, edits across desktop + www shells, members backend. Needs a
  fact-check/documentation pass before it drifts.
- Production deploy/QA gates were deferred by the pivot (one repo-first launch) and
  remain not run. QA runbook: `/specs/realtime-collab/TEST-RUNBOOK.md`.
