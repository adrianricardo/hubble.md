# Roadmap / Current State

## ➤ NEXT STEP (updated 2026-07-09)

**Both Track C gates are satisfied — apply-mode is unblocked.** The next session
should design and build **hubble-init apply-mode against a scratch workspace** (NOT
real content yet; that's the step after):

1. Read `/specs/hubble-init/DESIGN.md` (esp. §Flow step 3, §Safety gate, §Progress
   contract, §Gaps #1–7 — the gaps are the work queue: CLI auth, headless repo-link,
   desktop detect/deep-link, folder-create CLI, multi-repo mount, asset links) and
   `.claude/skills/hubble-init/SKILL.md` (twelve learned rules; dry-run guard gets an
   apply mode added, gated on a pre-move git commit).
2. Sequence per decision log: apply-mode on a **scratch workspace + throwaway corpus**
   first; the real dogfood (splitting this repo's `brain/`) only after that feels good,
   with a pre-move commit and a Hubble version-history restore demo first.
3. Known prerequisite friction: `packages/cli` is unauthenticated; mount/BRAIN.md
   seeding is Electron-only (DESIGN.md §Gaps #1–2) — decide CLI-vs-desktop split for
   apply (open design question in DESIGN.md).

## Where the build actually is (2026-07-09)

- Branch `v1-release`. RB1–RB7 repo-brain code phases are **committed** (folder shares,
  guest web experience, desktop repo-link mount + BRAIN.md seeding, guest onboarding,
  launch-gate prep) — see git log 2026-07-03..05.
- Uncommitted 2026-07-09 editor work adds basic GFM table support: shared Tiptap table
  schema, markdown round-trip conversion, slash-command insertion, floating table
  controls, and editor table styling. It is not committed.
- **Uncommitted work in the tree** (not yet described by any doc): `SpaceSwitcher.tsx`,
  `packages/cloud-ui/`, edits across desktop + www shells, members backend. Needs a
  fact-check/documentation pass before it drifts.
- Production deploy/QA gates were deferred by the pivot (one repo-first launch) and
  remain not run. QA runbook: `/specs/realtime-collab/TEST-RUNBOOK.md`.

## Parallel tracks (agreed 2026-07-09)

1. **Track A — Brain/doc system** ✅ in place (this directory). Ongoing: file new
   material per `RESOLVER.md`; keep `current-vision.md` honest.
2. **Track B — hubble-init skill.** Design in `/specs/hubble-init/DESIGN.md`. Skill
   drafted 2026-07-09 (`.claude/skills/hubble-init/SKILL.md`, dry-run only); iterate it
   in-repo via dogfood runs (records in `/specs/hubble-init/runs/`).
3. **Track C — Dogfood the split.** Target state: this brain splits — mechanics/build
   docs stay in git, strategy/vision moves to Hubble cloud — driven by the interactive
   init flow on `brain/` as the first corpus. **Two gates:** (1) triage logic —
   **✅ satisfied 2026-07-09 by Adrian** after three dry runs (`brain/`, archive
   stress corpus, foreign 567-platform brain; twelve learned defaults, contested
   ratio 50% → ~18%, run records in `/specs/hubble-init/runs/`); (2) no-data-loss — **✅ verified 2026-07-09** live on dev
   (every agent/file write snapshots first; wipe, restore, and trash all recover;
   nothing prunes history). Caveats: ~60s live-typing granularity, prod re-run pending,
   pre-move commit still required. Evidence:
   `/specs/hubble-init/VERIFICATION-version-history.md`.
4. **Track D — Vision extraction (Adrian-gated).** InterviewMe session when ready; then
   revise `current-vision.md` and re-derive UX priorities. Blocks "app matches my
   vision/UX" work at scale.

## Sequence note

A→B→C is the mechanical order; D can land anytime and reshapes C's corpus and the
product priorities. Don't start large app-UX rework before D.
