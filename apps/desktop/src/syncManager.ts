import { api } from "@hubble.md/sync-backend";
import { ConvexClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";

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

export function startSync(cfg: SyncConfig) {
	config = cfg;
	client = new ConvexClient(cfg.convexUrl);
}

export function stopSync() {
	client?.close();
	client = null;
	config = null;
}

export function isSyncActive(): boolean {
	return client !== null && config !== null;
}

/** Push a local file change to Convex. No-op if sync is not active. */
export async function pushLocalChange(
	relativePath: string,
	content: string,
	contentHash: string,
) {
	if (!client || !config) return;
	try {
		await client.mutation(api.sync.pushFile, {
			workspaceId: config.workspaceId as any,
			path: relativePath,
			contentHash,
			content,
			deviceId: config.deviceId,
		});
	} catch {
		// Push failures are non-fatal; next sync will reconcile
	}
}

/**
 * Subscribe to all files in the workspace via Convex reactive query.
 * Calls back whenever the query result changes (real-time, no polling).
 * Returns an unsubscribe function.
 */
export function subscribeToFiles(
	onChange: (files: RemoteFile[]) => void,
): () => void {
	if (!client || !config) return () => {};
	const deviceId = config.deviceId;
	return client.onUpdate(
		api.sync.getFilesByWorkspace,
		{ workspaceId: config.workspaceId as any },
		(files) => {
			const remote = (files ?? []).filter((f) => f.deviceId !== deviceId);
			onChange(remote);
		},
	);
}
