# RT3 — Sync-root grant + first-run-on-existing-folder guard

**Tier:** standard (Sonnet) — bounded, but safety-critical (don't blast user files).
**Depends-on:** RT2 (the Settings flow triggers it). **Parallel-with:** RT4.

## Objective

(1) Grant the chosen sync root to the main process so `connectSyncedFolder`'s
`assertGrantedRoot` passes, and (2) implement the **first-run safety guard** so
connecting an existing non-empty folder never auto-materializes over the user's
files (SYNCED-FOLDER §6 case 5).

## Read first

- `apps/desktop/electron/main.ts` — `assertGrantedRoot` / `assertGranted`, the
  `grantedRoots`/`grantedFiles` sets and how a path becomes granted (the existing
  folder-open path grants its root). Find the grant entry point and reuse it.
- `apps/desktop/electron/syncedFolderService.ts` — `connect()` runs
  `materializeSyncedFolder` immediately; the guard must run **before** that.
- `packages/sync/src/sync.ts` — `materializeSyncedFolder` (what would be written) and
  `importLiveDocuments` (the idempotent-by-path import path offered as option b).
- SYNCED-FOLDER.md §6 case 5 (the exact policy) and §2 (the `.hubble/index` marker
  that identifies an already-Hubble root).

## Scope

1. **Grant on pick.** When the user chooses a sync root in Settings (RT2), grant that
   root to the main process (the same mechanism a normally-opened workspace uses), so
   `assertGrantedRoot(syncRoot)` succeeds. Persist the grant like other grants.
2. **First-run guard** (new IPC, e.g. `desktop:live-sync:inspect-root(syncRoot)` →
   `{ state: "empty" | "existing-hubble" | "non-empty-foreign" }`):
   - `existing-hubble` (has `.hubble/index/synced-folder.json`) → safe to connect.
   - `empty` → safe to connect (fresh mirror).
   - `non-empty-foreign` → **refuse by default**; Settings offers two explicit
     choices: (a) pick/create an empty subfolder, or (b) **import** the existing
     `.md` into the cloud via `importLiveDocuments` (idempotent by path) *before*
     turning on the mirror. Never auto-materialize over unknown files.
3. Wire the guard result into RT2's connect flow (block Connect on
   `non-empty-foreign` until the user picks a or b).

## Out of scope

The Settings layout itself (RT2 — you add the guard branch + the two choices it
surfaces). Reactive sync, two-device lock (RD7).

## Gotchas

- Electron `tsconfig.node.json` is non-strict — flat optional fields for any union
  you add on the main side.
- Granting must be revocable/scoped sensibly; don't widen the grant beyond the chosen
  root.
- The `.hubble/index` marker is the source of truth for "already a Hubble root" — not
  the folder name.

## Verify

- `pnpm typecheck`, `pnpm build:desktop`, `pnpm --filter @hubble.md/desktop test`.
- Add unit tests for `inspect-root` classification (empty / existing-hubble /
  non-empty-foreign) with an in-memory FS.
- Human-gated: the real Finder folder-pick + refuse/import flow.

## Constraints & done

No commit; no `PROGRESS.md` edit. Return: files touched, the grant mechanism reused,
the guard states + how RT2 consumes them, verify results, suggested PROGRESS note +
changelog line.
