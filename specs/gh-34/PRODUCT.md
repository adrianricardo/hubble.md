# Folder-first Workspaces and deferred Cloud Sync

## Summary

Desktop Workspaces are folders users add to Hubble, not cloud records and not `.hubble/` directories. Cloud Sync is an optional capability users can connect later without changing the local-first editing model.

## Problem

Today product language and flows can imply that a Workspace is created by Cloud Sync or by `.hubble/config.json`. That makes local-only desktop use feel provisional and makes later sync setup harder to reason about.

## Goals

- Adding a desktop Workspace is non-invasive by default.
- Cloud Sync setup is explicit, reversible, and independent from whether a folder is a Workspace.
- Users can choose an existing remote Workspace or create a new one when connecting Cloud Sync.
- Initial sync uses existing reconciliation behavior and does not imply local files are overwritten.
- Background sync is a preference, not the same thing as Cloud Sync linkage.

## Non-goals

- No multi-user account model.
- No token/auth flow changes.
- No new sync conflict policy.
- No support for preserving empty folders through Cloud Sync.
- No automatic relink to a different Convex deployment without confirmation.

## Behavior

1. When a desktop user chooses `Add Workspace`, Hubble asks for a folder.
2. Adding a folder succeeds without creating `.hubble/config.json`.
3. The added folder appears as a Workspace in desktop navigation immediately after selection.
4. Local-only Workspaces can create, edit, rename, and delete Markdown Files and Assets without Cloud Sync.
5. Workspace-scoped optional capabilities may create `.hubble/config.json` only when the user enables that capability.
6. The Add Workspace dialog offers optional setup for agent instructions.
7. The Add Workspace dialog offers optional Cloud Sync setup, hidden until the user chooses to connect it.
8. Cloud Sync setup asks for a Convex deployment URL.
9. On blur or submit, Hubble validates the Convex deployment URL and reports invalid, unreachable, or incompatible deployments in place.
10. After a valid URL, Hubble shows available remote Workspaces from that deployment.
11. The user can select an existing remote Workspace.
12. The user can choose `Create new` and enter a remote Workspace name, defaulting to the folder name.
13. Cloud Sync setup includes an `Auto sync` checkbox that defaults on.
14. The Auto sync explanation makes clear that manual sync remains available when auto sync is off.
15. Connecting Cloud Sync writes the linkage and runs initial sync.
16. Initial sync pushes local-only files, pulls remote-only files, leaves same-path same-hash files unchanged, and preserves same-path different-content files through conflict handling.
17. Assets follow the existing asset sync rules during initial sync.
18. If background sync registration succeeds, the Workspace syncs automatically after setup.
19. If background sync registration fails, Cloud Sync remains connected, the user sees the registration error, and a retry action is available.
20. A synced desktop Workspace shows its Convex deployment URL and linked remote Workspace in settings.
21. Settings show whether background sync is registered, based on live service state.
22. Turning off Auto sync preserves Cloud Sync linkage and sync state.
23. Manual sync remains available while Auto sync is off.
24. Disconnecting Cloud Sync removes the Cloud Sync linkage but keeps local files.
25. Editing the deployment URL or linked remote Workspace starts a relink flow with confirmation because it may merge different remote content into the same local folder.
26. Web Workspaces are always synced because web has no local filesystem Workspace source of truth.
27. A user can understand from labels and messages that `Workspace`, `Cloud Sync`, and `Auto sync` are separate states.

## UX validation

1. In desktop, add a folder as a Workspace and confirm no `.hubble/config.json` is created.
2. Enable agent instructions or another config-backed capability and confirm configuration is created only then.
3. Connect Cloud Sync with a valid Convex URL, create a new remote Workspace, and confirm initial files appear on web.
4. Connect Cloud Sync with an existing remote Workspace and confirm remote-only files pull locally.
5. Turn Auto sync off, run manual sync, and confirm the Workspace remains linked.
6. Disconnect Cloud Sync and confirm local files remain editable while web access stops for that local folder.
