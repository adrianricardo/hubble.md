# Folder-first Workspaces and deferred Cloud Sync

## Context

Issue #34 defines desktop Workspaces as local folders first, with Cloud Sync as an optional nested capability. See `PRODUCT.md` for behavior.

Current commit: `4247f68c6fa5e63196dc3eefadb1192878720b69`.

Current architecture already has part of the model:

- `packages/sync/src/types.ts` defines optional `WorkspaceConfig.cloudSync`.
- `packages/sync/src/config.ts` reads missing config as `{}` and writes `cloudSync` only through `writeCloudSyncConfig`.
- `packages/sync/src/sync.ts` requires `cloudSync` only when running sync.
- `packages/cli/src/index.ts` has `hubble cloud create`, `connect`, `sync`, `watch`, and `disconnect`.
- `apps/www` stores a Convex URL and Workspace id because web Workspaces are synced-only.

The main mismatch is desktop configuration ownership. `apps/desktop/electron/main.ts` uses `.hubble/config.json` for desktop pinned notes with a `{ version, pinnedNotes }` shape, while `packages/sync` expects the same path to hold optional `cloudSync`. Before shipping the full flow, those shapes need one shared Workspace Configuration schema or separate paths.

## Affected apps and packages

- `apps/desktop`: Add Workspace dialog, settings UI, background sync registration state, and Workspace Configuration reads/writes.
- `apps/www`: No local-first changes; web remains synced-only. May need copy updates if shared labels change.
- `packages/sync`: Shared config schema, Cloud Sync connect/disconnect helpers, initial sync behavior, and tests.
- `packages/convex-client`: Remote Workspace listing and creation are already available through backend APIs; expose typed helpers if UI should avoid raw Convex calls.
- `packages/cli`: Keep manual Cloud Sync commands aligned with the desktop config schema and background sync semantics.
- `packages/sync-backend`: No expected schema change for this slice unless remote Workspace list/create APIs need additions.

## Module architecture

Use one shared Workspace Configuration contract.

- `packages/sync/src/types.ts`
  - Own `WorkspaceConfigSchema`.
  - Include optional `cloudSync`.
  - Include any desktop config-backed capability fields that must share `.hubble/config.json`, or explicitly move desktop-only fields to a different file.
- `packages/sync/src/config.ts`
  - Own all `.hubble/config.json` reads/writes used by sync-aware code.
  - Preserve unknown or unrelated optional sections only if the shared schema intentionally supports them.
- `packages/sync/src/sync.ts`
  - Keep `sync()` requiring `cloudSync`.
  - Extract connect helpers that can create or link a remote Workspace and initialize `.hubble/state.json`.
- `apps/desktop/electron/main.ts`
  - Stop owning an incompatible private schema for `.hubble/config.json`.
  - Expose IPC for reading/writing Workspace Configuration through shared package code or an equivalent schema.
- `apps/desktop/src`
  - Add Add Workspace dialog state for optional Cloud Sync fields.
  - Add Workspace settings state for connected, disconnected, background sync registered, registration failed, and retry.
- `packages/cli/src/index.ts`
  - Continue using shared config helpers for `cloud create`, `connect`, `sync`, `watch`, and `disconnect`.

## Detailed plan

1. Reconcile Workspace Configuration.
   - Decide whether pinned notes belong in shared `.hubble/config.json` or a desktop-specific file.
   - If shared, add `pinnedNotes` and config versioning to `WorkspaceConfigSchema`.
   - If separate, move desktop pins away from `.hubble/config.json`.
   - Add tests for reading old/missing config and writing config without enabling Cloud Sync.
2. Make desktop Add Workspace non-invasive.
   - Ensure folder selection persists as a recent/current Workspace without writing `.hubble/config.json`.
   - Keep file listing and editing independent from config presence.
   - Verify Behavior 1-5.
3. Add Cloud Sync setup to Add Workspace.
   - Validate deployment URL before showing remote Workspace choices.
   - Fetch remote Workspaces after validation.
   - Support existing remote Workspace selection and create-new name input.
   - Default create-new name to the folder basename.
   - Default Auto sync on.
4. Implement connect semantics.
   - Write `cloudSync` config only after the user confirms setup.
   - Create `.hubble/state.json` when missing.
   - Run initial sync through existing reconciliation rules.
   - Register background sync only after Cloud Sync linkage exists.
   - Preserve linkage if registration fails, and surface retry state.
5. Add Workspace settings.
   - Show deployment URL, linked remote Workspace, background sync registration state, and read-only ids with copy actions.
   - Toggle Auto sync by changing background registration, not by deleting `cloudSync`.
   - Disconnect Cloud Sync by removing only `cloudSync`.
   - Gate URL/Workspace edits behind a relink confirmation.
6. Keep CLI aligned.
   - Ensure `hubble cloud disconnect` removes `cloudSync` without deleting local files or `.hubble/state.json`.
   - Add a background-sync option only if the daemon has a CLI-facing registration path.

## Testing and validation

- Behavior 1-5: desktop unit/integration coverage for adding a folder and confirming no config write occurs.
- Behavior 8-14: component tests for Cloud Sync setup validation, remote Workspace list, create-new state, and Auto sync default.
- Behavior 15-17: `packages/sync` tests for connect plus initial sync using existing file and asset reconciliation.
- Behavior 18-19: desktop tests around registration success/failure and retry state.
- Behavior 20-25: settings tests for display, Auto sync toggle, disconnect, and relink confirmation.
- Behavior 26-27: web smoke test for unchanged synced-only connection flow and copy review.

Run:

- `pnpm check` for quick iteration.
- `pnpm build:desktop` before final review.
- Desktop manual validation with a temporary folder, then a second synced device or web app to verify initial sync.
- Web validation through `apps/www` with `?test=1` when checking web visibility.

## Parallelization

Useful after the config decision is made:

- Agent 1: shared config/schema and sync tests.
- Agent 2: desktop Add Workspace and settings UI.
- Agent 3: CLI alignment and manual validation docs.

Do not parallelize before the config path decision; otherwise agents may encode incompatible `.hubble/config.json` assumptions.

## Risks and mitigations

- Data loss during first sync: reuse existing conflict handling and add explicit tests for same-path different-content files.
- Config schema collision: resolve desktop pins vs sync config before UI work.
- Partial setup failure: persist Cloud Sync linkage before background registration and expose retry.
- Relink surprises: require confirmation before changing deployment URL or remote Workspace.

## Follow-ups

- Pairing or token auth for protected Convex deployments.
- Empty folder preservation.
- More detailed background sync service observability.
