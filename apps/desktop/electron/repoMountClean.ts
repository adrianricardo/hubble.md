import fs from "node:fs/promises";
import path from "node:path";
import { contentHash, loadSyncedFolderIndex } from "@hubble.md/sync";
import { createNodeFileSystem } from "@hubble.md/sync/node";

export async function isMountClean(mountPath: string): Promise<boolean> {
	const syncRoot = path.resolve(mountPath);
	const nodeFs = createNodeFileSystem();
	const index = await loadSyncedFolderIndex(nodeFs, syncRoot);
	const indexedPaths = new Set(
		Object.keys(index).map((entryPath) => path.resolve(entryPath)),
	);

	for (const [entryPath, entry] of Object.entries(index)) {
		const absPath = path.resolve(entryPath);
		try {
			const content = await fs.readFile(absPath, "utf8");
			if ((await contentHash(content)) !== entry.hash) return false;
		} catch {
			return false;
		}
	}

	for (const filePath of await listMountFiles(syncRoot)) {
		if (isHubbleStatePath(syncRoot, filePath)) continue;
		if (!indexedPaths.has(path.resolve(filePath))) return false;
	}

	return true;
}

async function listMountFiles(root: string): Promise<string[]> {
	try {
		const entries = await fs.readdir(root, { withFileTypes: true });
		const files: string[] = [];
		for (const entry of entries) {
			const absPath = path.join(root, entry.name);
			if (entry.isDirectory()) {
				files.push(...(await listMountFiles(absPath)));
			} else if (entry.isFile()) {
				files.push(absPath);
			}
		}
		return files;
	} catch {
		return [];
	}
}

function isHubbleStatePath(syncRoot: string, filePath: string): boolean {
	const rel = path.relative(syncRoot, filePath).split(path.sep).join("/");
	return rel === ".hubble" || rel.startsWith(".hubble/");
}
