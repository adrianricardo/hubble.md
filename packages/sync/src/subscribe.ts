import { ConvexHttpClient } from "convex/browser";
import { api } from "@hubble.md/sync-backend";
import type { Id } from "@hubble.md/sync-backend/types";
import type { RemoteFile } from "./types";

export type SubscribeOptions = {
	convexUrl: string;
	workspaceId: string;
	deviceId: string;
	/** Called when remote files have changed */
	onRemoteChange: (files: RemoteFile[]) => void;
	/** Poll interval in ms (default: 3000) */
	intervalMs?: number;
};

/**
 * Poll for remote changes to a workspace's files.
 * Skips changes from the same device to avoid echoing local edits.
 * Returns a cleanup function to stop polling.
 */
export function subscribe(opts: SubscribeOptions): () => void {
	const {
		convexUrl,
		workspaceId,
		deviceId,
		onRemoteChange,
		intervalMs = 3000,
	} = opts;
	const client = new ConvexHttpClient(convexUrl);
	let lastCheckedAt = Date.now();
	let stopped = false;

	const poll = async () => {
		if (stopped) return;
		try {
			const files = (await client.query(api.sync.getFilesByWorkspace, {
			workspaceId: workspaceId as Id<"workspaces">,
				since: lastCheckedAt,
			})) as RemoteFile[];

			const remote = files.filter((f) => f.deviceId !== deviceId);
			if (remote.length > 0) {
				onRemoteChange(remote);
			}
			lastCheckedAt = Date.now();
		} catch {
			// Silently retry on next interval
		}
		if (!stopped) {
			setTimeout(poll, intervalMs);
		}
	};

	// Start first poll after a short delay
	const timer = setTimeout(poll, intervalMs);

	return () => {
		stopped = true;
		clearTimeout(timer);
	};
}
