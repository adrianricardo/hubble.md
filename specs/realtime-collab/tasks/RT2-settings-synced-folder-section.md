# RT2 — Settings "Synced Folder" section

**Tier:** standard (Sonnet) — well-specified UI on an existing surface, bounded blast
radius. **Depends-on:** RT1 (needs the renderer Convex client + auth token + the
authed user's workspaces). **Parallel-after:** RT3, RT4.

## Objective

Add a **Synced Folder** section to the existing desktop Settings dialog that lets a
signed-in user pick a sync root, connect/disconnect, see live status, and get toasts
for engine events — driving the IPC that already exists.

## Read first

- `apps/desktop/src/components/SettingsDialog.tsx` + `UpdatesSection.tsx` — the
  existing dialog and a section to mirror in structure/style.
- `apps/desktop/src/desktopApi/types.ts` — the surface you call:
  `connectSyncedFolder(input)`, `disconnectSyncedFolder()`, `getSyncedFolderStatus()`,
  `onSyncedFolderEvent(cb)`; `SyncedFolderStatus` (`state`, `connected`,
  `lastReconciledAt`, `lastError`, …) and `SyncedFolderEvent` kinds
  (`reconciled`/`backstop`/`removed-local`/`removed-access`/`read-only-rejected`).
- `apps/desktop/electron/preload.ts` — confirms the bridge names.
- `apps/desktop/src/App.tsx` (L296–300) — `onMenuOpenSettings`/menu wiring and how
  the folder picker (`openFolderPicker`) is invoked elsewhere.
- RT1's output — how to read the authed user's workspaces (Convex query) and the
  auth token to pass into `connectSyncedFolder`.

## Scope

1. A `SyncedFolderSection` component in `SettingsDialog.tsx`:
   - **Folder picker** ("Choose…" → `desktopApi.openFolderPicker()`), showing the
     chosen path (default suggestion `~/Hubble`).
   - **Connect / Disconnect** buttons calling `connectSyncedFolder({ syncRoot,
     deploymentUrl, authToken, deviceId? })` / `disconnectSyncedFolder()`. Pull
     `deploymentUrl` + `authToken` from the RT1 Convex/auth context.
   - **Live status**: subscribe via `getSyncedFolderStatus()` on open + refresh on
     events; show `state` (idle/connected/syncing/error), "last reconciled Ns ago",
     and `lastError`.
   - **Event toasts**: `onSyncedFolderEvent` → `sonner` toasts (copy comes from RT4;
     use placeholder strings RT4 will refine, or coordinate).
2. **Signed-out / signed-in gating**: the section is disabled (or hidden) when not
   signed in, with a "Sign in to sync" affordance pointing at RT1's gate.
3. Apply the project's **User Interaction Principles** (load
   `~/ai-obsidian-vault/30-39 Knowledge/34 User Interaction Principles.md`): clear
   states, no dead-ends, confirm destructive actions (disconnect is non-destructive;
   connecting a non-empty folder routes to RT3's first-run guard).

## Out of scope

The grant + first-run safety logic (RT3 — call into it but don't implement it here),
final toast copy (RT4), reactive sync (RD1). Don't invent backend; the IPC exists.

## Gotchas

- The `syncRoot` must be **granted** to the main process before
  `connectSyncedFolder` (it calls `assertGrantedRoot`). RT3 owns granting; until RT3
  lands, wire the call and expect a grant error — surface it, don't crash.
- Status should not poll aggressively; refresh on events + on dialog open.

## Verify

- `pnpm typecheck`, `pnpm build:desktop`, `pnpm --filter @hubble.md/desktop test`
  (keep green; add a light test or storybook-free render check if feasible).
- Human-gated: the actual visual flow in a running Electron app.

## Constraints & done

No commit; no `PROGRESS.md` edit. Return: files touched, how status/events are
wired, the signed-in gating approach, what you stubbed for RT3/RT4, verify results,
suggested PROGRESS note + changelog line.
