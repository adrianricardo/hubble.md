import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import type { SyncConfig } from "./syncManager";
import { subscribeToFiles } from "./syncManager";
import { refreshFiles } from "./workspaceStore";

/**
 * Subscribes to remote file changes via Convex reactive query.
 * Writes incoming changes to disk and refreshes the sidebar.
 */
export function useSyncSubscription(
	workspacePath: string | null,
	syncConfig: SyncConfig | null,
) {
	const knownHashesRef = useRef<Map<string, string>>(new Map());

	useEffect(() => {
		if (!workspacePath || !syncConfig) return;

		return subscribeToFiles(async (files) => {
			let wrote = false;
			for (const f of files) {
				if (f.deleted) continue;
				// Skip if we already wrote this exact version
				if (knownHashesRef.current.get(f.path) === f.contentHash) continue;

				await invoke("write_file_text", {
					path: `${workspacePath}/${f.path}`,
					content: f.content,
				});
				knownHashesRef.current.set(f.path, f.contentHash);
				wrote = true;
			}
			if (wrote) void refreshFiles();
		});
	}, [workspacePath, syncConfig]);
}
