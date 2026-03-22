import { sync as runSync, type FileSystem } from "@hubble.md/sync";
import { api } from "@hubble.md/sync-backend";
import { ConvexClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { createTauriFileSystem } from "./tauriFs";

export type RemoteFile = FunctionReturnType<
    typeof api.sync.getFilesByWorkspace
>[number];

export type SyncConfig = {
    workspaceId: string;
    workspaceName: string;
    deviceId: string;
    convexUrl: string;
};

let client: ConvexClient | null = null;
let config: SyncConfig | null = null;
let tauriFs: FileSystem | null = null;

export function startSync(cfg: SyncConfig) {
    config = cfg;
    client = new ConvexClient(cfg.convexUrl);
    tauriFs = createTauriFileSystem();
}

export function stopSync() {
    client?.close();
    client = null;
    config = null;
    tauriFs = null;
}

export function isSyncActive(): boolean {
    return client !== null && config !== null;
}

/** Run a full sync using the isomorphic SDK via Tauri filesystem. */
export async function runFullSync(workspacePath: string) {
    if (!tauriFs) return;
    try {
        return await runSync(tauriFs, workspacePath);
    } catch (err) {
        console.error("Sync failed:", err);
    }
}

/**
 * Subscribe to all files in the workspace via Convex reactive query.
 * Calls back whenever the query result changes.
 * Returns an unsubscribe function.
 */
export function subscribeToFiles(
    onChange: (files: RemoteFile[]) => void,
): () => void {
    if (!client || !config) return () => { };
    return client.onUpdate(
        api.sync.getFilesByWorkspace,
        { workspaceId: config.workspaceId as any },
        (files) => {
            onChange(files ?? []);
        },
    );
}
