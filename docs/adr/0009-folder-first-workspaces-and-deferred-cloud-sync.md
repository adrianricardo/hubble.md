# Folder-first Workspaces and deferred Cloud Sync

Desktop Workspaces are folders added to Hubble. Adding a Workspace is non-invasive by default: Hubble does not create `.hubble/` files just to remember or edit the folder.

Workspace Configuration is deferred until a capability needs it. Capabilities such as Cloud Sync, agent instructions, or embeds may create `.hubble/config.json`; plain editing and sidebar navigation do not.

Cloud Sync is a nested Workspace capability, not the definition of a Workspace. When connected, `.hubble/config.json` stores `cloudSync.provider`, `cloudSync.deploymentUrl`, `cloudSync.workspaceId`, `cloudSync.deviceId`, and `cloudSync.backgroundSync`. The Convex `workspaceId` is the only remote Workspace id in this model, and `deviceId` is sync-scoped.

Turning off background sync preserves Cloud Sync configuration and `.hubble/state.json`, so manual sync can continue. Disconnecting Cloud Sync removes the `cloudSync` configuration while leaving local files and sync state intact.

Initial Cloud Sync setup uses the existing reconciliation rules: local-only files push, remote-only files pull, same-path same-hash files remain unchanged, same-path different-content files use conflict handling, and assets follow current asset sync rules.

## Consequences

- A desktop Workspace can exist without `.hubble/config.json`.
- `.hubble/config.json` presence means at least one optional Workspace capability is configured; it does not define Workspace existence.
- Web Workspaces remain synced-only because the web app has no local filesystem source of truth.
- UI copy should ask users to enable or connect Cloud Sync, not create a Workspace in the cloud.
- Relinking Cloud Sync is a distinct flow because it may merge a different remote Workspace into the same local folder.
