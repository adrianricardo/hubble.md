import { useEffect } from "react";
import { loadPath, viewerStore } from "./store";
import type { SyncConfig } from "./syncManager";
import { runFullSync, subscribeToFiles } from "./syncManager";
import { refreshFiles } from "./workspaceStore";

/**
 * Subscribes to remote file changes via Convex reactive query.
 * Triggers a full sync when remote changes are detected.
 */
export function useSyncSubscription(
	workspacePath: string | null,
	syncConfig: SyncConfig | null,
) {
	useEffect(() => {
		if (!workspacePath || !syncConfig) return;

		return subscribeToFiles(async (files) => {
			if (files.length === 0) return;
			const result = await runFullSync(workspacePath);
			void refreshFiles();
			if (!result || result.pulled.length === 0) return;
			const currentPath = viewerStore.get().currentPath;
			if (!currentPath) return;
			const prefix = workspacePath.endsWith("/")
				? workspacePath
				: `${workspacePath}/`;
			const relativeCurrent = currentPath.startsWith(prefix)
				? currentPath.slice(prefix.length)
				: null;
			if (!relativeCurrent) return;
			if (!result.pulled.includes(relativeCurrent)) return;
			await loadPath(currentPath);
		});
	}, [workspacePath, syncConfig]);
}
