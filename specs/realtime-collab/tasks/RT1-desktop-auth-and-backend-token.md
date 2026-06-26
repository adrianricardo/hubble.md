# RT1 — Desktop Convex client + Auth + main-process backend token plumbing

**Tier:** premier (Opus) — cross-cutting, auth-sensitive, spans renderer + main +
`convex-client`; the renderer has no Convex client today and the main-process
backend is unauthenticated. A wrong call here is expensive.

**Depends-on:** none. **Gates:** RT2–RT4.

## Objective

Make the desktop app sign in to the **deployed fork Convex** with real Convex Auth,
and carry the authenticated user's token to the **main-process `SyncBackend`** so
`materializeSyncedFolder`/`connectSyncedFolder` run as that user (their
`requireWorkspaceMember` checks pass).

## Why this is the gate

`packages/convex-client/src/index.ts` `createConvexBackend(url)` builds a bare
`ConvexHttpClient` with **no auth**. `documents.listWithMarkdown` /
`sync.listWorkspaces` / `folders.list` all call `requireWorkspaceMember`
(`packages/sync-backend/convex/permissions.ts`), which needs an authenticated
identity. Without a token, every materialize call returns empty or throws. The token
lives in the **renderer's** signed-in session, so it must be plumbed to **main**.

## Read first

- `apps/www/src/shell/AppShell.tsx` (L11, L67) and `apps/www/src/App.tsx` (L38–48) —
  the existing web pattern: `ConvexReactClient(url)` + `ConvexAuthProvider`, URL from
  `import.meta.env.VITE_*`. Mirror this for desktop.
- `apps/desktop/src/desktopApi/types.ts` — `SyncedFolderConnectInput`
  (`{ syncRoot, deploymentUrl, deviceId? }`). `DesktopApi.connectSyncedFolder`.
- `apps/desktop/electron/main.ts` — the `desktop:live-sync:connect-folder` handler
  (constructs nothing today; `SyncedFolderService` builds the backend via
  `createBackend(deploymentUrl)`).
- `apps/desktop/electron/syncedFolderService.ts` — `connect()` →
  `this.#createBackend(deploymentUrl)`. `createBackend` defaults to
  `createConvexBackend`.
- `packages/convex-client/src/index.ts` — `createConvexBackend`; `ConvexHttpClient`
  supports `client.setAuth(tokenOrFetcher)`.
- Convex Auth config: `packages/sync-backend/convex/auth.ts` / `auth.config.ts`
  (password provider already wired).

## Scope

1. **Renderer Convex + Auth.** Add a `ConvexReactClient` + `ConvexAuthProvider` to
   the desktop renderer (new `apps/desktop/src/convex.ts` + provider in `App.tsx` or
   a shell). Deployment URL from a desktop env var (`VITE_CONVEX_URL`) — document it
   in `apps/desktop/src/vite-env.d.ts`. Add a minimal **sign-in / sign-up gate**
   (email+password, reuse the www component shape; do not over-design — Settings is
   RT2). Signed-out → the app works as today (local-only); signed-in unlocks the
   synced-folder section.
2. **Token contract → main.** Extend `SyncedFolderConnectInput` with the auth token
   (e.g. `authToken: string`), obtained in the renderer via the Convex Auth token
   getter. Update `connectSyncedFolder` (preload + types + the `main.ts` handler) to
   pass it through to `SyncedFolderService.connect`.
3. **Authenticated backend.** Make `createConvexBackend(url, authToken?)` call
   `client.setAuth(...)` when a token is provided; thread the token from
   `SyncedFolderService.connect` → `createBackend`. Handle **token refresh**: prefer
   passing a fetcher/refresh hook over a frozen string if practical, or document the
   reconnect-on-expiry fallback. (Also update the existing `LiveSyncService` /
   `connectLiveSync` path for consistency if trivial; otherwise note it.)
4. **Expose the signed-in deployment URL + identity** to the renderer so RT2 can
   read the authed user's workspaces (via a Convex query, e.g. `sync.listWorkspaces`)
   to offer workspace context. (RT2 builds the UI; RT1 just makes the data reachable.)

## Out of scope

The Settings UI (RT2), the folder grant/first-run guard (RT3), reactive cloud→disk
sync (deploy RD1). Don't build WorkOS/SSO — password only.

## Gotchas

- Desktop `tsconfig.node.json` (electron) is **non-strict** — discriminated unions
  on boolean discriminants won't narrow; use flat optional fields for any
  result/union types you add on the electron side.
- `convex-client` consumes `@hubble.md/sync` types via `dist` — run
  `pnpm --filter @hubble.md/sync build` before `pnpm typecheck` if you touch shared
  types.
- Convex function changes are **deployment-gated**: you can't `convex codegen`
  headlessly. If you add/alter a Convex query, say so and leave it deployment-gated.

## Verify

- `pnpm typecheck` (all 6 packages; build `@hubble.md/sync` first if needed).
- `pnpm build:desktop`.
- `pnpm --filter @hubble.md/desktop test` (keep the 72 green; add tests for the
  token-plumbing contract in `syncedFolderService` with a fake backend asserting
  `setAuth`/token is forwarded).
- Human-gated (list, don't claim): actual sign-in against deployed Convex.

## Constraints & done

Do **not** commit; do **not** edit `PROGRESS.md`; leave changes in the tree. Return
a short summary: files touched, the token contract you chose (string vs fetcher) and
why, whether `LiveSyncService` was updated too, what's deployment-gated, verify
results, suggested PROGRESS note + changelog line.
