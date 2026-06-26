# Synced Folder Ready-to-Test Runbook

Use this runbook to verify the first human-testable synced-folder flow on the
deployed fork Convex backend. The package smoke script at the end proves the
shared reconcile core; the desktop watcher, IPC, folder picker, and Settings UI
are proven only by the manual steps.

## Prereqs

- [ ] A deployed fork Convex URL, for example `https://<deployment>.convex.cloud`.
- [ ] Convex Auth is configured on that deployment and a test account can sign in.
- [ ] `apps/desktop/.env.local` or the desktop launch environment sets
      `VITE_CONVEX_URL=<deployed Convex URL>`.
- [ ] The desktop app is built or running from this branch.
- [ ] Use a scratch sync root such as `~/Hubble-test`. Start with an empty folder
      unless you are explicitly testing the import guard.
- [ ] Keep a browser tab open to the same deployment so cloud-side document changes
      can be confirmed.

## 1. Sign In

- [ ] Launch the desktop app.
- [ ] Open Settings -> Cloud sync.
- [ ] Sign in with the test account.

Expected:

- [ ] Settings shows the signed-in Cloud sync section.
- [ ] The Synced Folder status says `Not connected`.
- [ ] The workspace summary loads without an auth error.

## 2. Connect An Empty Sync Root

- [ ] In Settings -> Cloud sync, choose or create an empty folder such as
      `~/Hubble-test`.
- [ ] Click Connect.

Expected:

- [ ] The status changes to `Connected` or `Idle`.
- [ ] `Documents mirrored` is greater than zero if the account has cloud docs.
- [ ] Cloud docs appear under the sync root in their nested workspace/folder paths.
- [ ] No `*.conflict-*` or `*.local-edit-*` files appear during initial materialize:

```sh
find ~/Hubble-test \( -name '*.conflict-*' -o -name '*.local-edit-*' \) -print
```

## 3. Confirm Read-Only Materialization

Use a viewer/commenter document if the account has one.

- [ ] Locate the read-only markdown file under the sync root.
- [ ] Check its mode:

```sh
ls -l ~/Hubble-test/path/to/read-only.md
```

Expected:

- [ ] Viewer/commenter documents are mode `-r--r--r--` (`0444`).
- [ ] Owner/editor documents remain writable.

If there is no viewer/commenter fixture, mark this step skipped and create one
before the deploy gate.

## 4. Edit A Writable Document On Disk

- [ ] Open a writable synced `.md` file in an external editor.
- [ ] Save a small text edit.
- [ ] Watch the browser/cloud copy of the same Live Document.

Expected:

- [ ] The browser/cloud document updates within roughly 1-2 seconds.
- [ ] The desktop status `Last activity` moves to `just now`.
- [ ] No conflict or backstop copy is written:

```sh
find ~/Hubble-test \( -name '*.conflict-*' -o -name '*.local-edit-*' \) -print
```

## 5. Force A Backstop

- [ ] Pick a writable synced document and identify its document ID from
      `.hubble/index/synced-folder.json`.
- [ ] Corrupt or move its base cache:

```sh
mv ~/Hubble-test/.hubble/state/live-documents/<documentId>.base.md \
  ~/Hubble-test/.hubble/state/live-documents/<documentId>.base.md.bak
```

- [ ] Save another local edit to that markdown file.

Expected:

- [ ] A sibling `*.local-edit-<timestamp>.md` file appears beside the document.
- [ ] The visible markdown file reloads to the latest cloud version.
- [ ] The toast explains that the local edit was preserved.
- [ ] The cloud document is not silently overwritten.

Restore the base cache after the check if you need to keep using the same doc.

## 6. Rename And Move From Finder

- [ ] Rename a writable synced markdown file in Finder.
- [ ] Confirm the cloud document title/path changes.
- [ ] Move the same file into another materialized folder.
- [ ] Confirm the cloud folder changes.

Expected:

- [ ] Rename and move toasts are short success messages.
- [ ] The reverse index still maps the new path to the same document ID.
- [ ] Reconnecting the folder does not create a duplicate document.

## 7. Disconnect And Reconnect

- [ ] Click Disconnect.
- [ ] Save a local edit and confirm no watcher event is processed while disconnected.
- [ ] Reconnect the same root.

Expected:

- [ ] The watcher stops after disconnect.
- [ ] Reconnect materializes idempotently.
- [ ] Existing cloud docs are not duplicated.

## Package-Level Reconcile Smoke

This smoke bypasses the desktop watcher, Settings UI, IPC, and folder picker. It
only proves that the package-level base-cache diff -> `reconcileProjectionFile` ->
Convex `documents.applyPatch` path works with an authenticated backend.

Build the packages first:

```sh
pnpm --filter @hubble.md/sync --filter @hubble.md/convex-client build
```

Run against the deployed backend with a real Convex Auth token:

```sh
CONVEX_URL=https://<deployment>.convex.cloud \
AUTH_TOKEN=<jwt from the signed-in desktop/web session> \
node scripts/synced-folder-reconcile-smoke.mjs
```

Optional inputs:

```sh
WORKSPACE_ID=<id> WORKSPACE_NAME="Synced Folder Smoke" SYNC_ROOT=/tmp/hubble-smoke
```

Expected:

- [ ] The script creates or reuses a test workspace.
- [ ] It imports one timestamped Live Document.
- [ ] It writes the projection and base cache under `SYNC_ROOT`.
- [ ] It edits the projection, runs `reconcileProjectionFile`, and reports a newer
      revision.
- [ ] A final cloud read contains the local edit marker.
