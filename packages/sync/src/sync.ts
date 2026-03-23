import { ConvexHttpClient } from "convex/browser";
import { api } from "@hubble.md/sync-backend";
import {
	isInitialized,
	readConfig,
	readSyncState,
	writeConfig,
	writeSyncState,
} from "./config.js";
import type { FileSystem } from "./fs.js";
import type {
	FileState,
	RemoteFile,
	SyncResult,
	WorkspaceConfig,
} from "./types.js";

/** Initialize a workspace for syncing. Creates .hubble/ config. */
export async function init(
	fs: FileSystem,
	opts: {
		workspacePath: string;
		workspaceName: string;
		convexUrl: string;
	},
): Promise<WorkspaceConfig> {
	if (await isInitialized(fs, opts.workspacePath)) {
		return readConfig(fs, opts.workspacePath);
	}

	const client = new ConvexHttpClient(opts.convexUrl);
	const existing = await client.query(api.sync.getWorkspace, {
		name: opts.workspaceName,
	});
	const workspaceId = existing
		? existing._id
		: await client.mutation(api.sync.createWorkspace, {
				name: opts.workspaceName,
			});

	const config: WorkspaceConfig = {
		workspaceId: workspaceId as string,
		workspaceName: opts.workspaceName,
		deviceId: crypto.randomUUID(),
		convexUrl: opts.convexUrl,
	};
	await writeConfig(fs, opts.workspacePath, config);
	await writeSyncState(fs, opts.workspacePath, { lastSyncedAt: 0, files: {} });
	return config;
}

/** Run a full sync: push local changes, pull remote changes, detect conflicts. */
export async function sync(
	fs: FileSystem,
	workspacePath: string,
): Promise<SyncResult> {
	const config = await readConfig(fs, workspacePath);
	const state = await readSyncState(fs, workspacePath);
	const client = new ConvexHttpClient(config.convexUrl);

	const localFiles = await fs.listMarkdownFiles(workspacePath);
	const localByPath = new Map(localFiles.map((f) => [f.relativePath, f]));

	const remoteFiles = (await client.query(api.sync.getFilesByWorkspace, {
		workspaceId: config.workspaceId as any,
		since: undefined,
	})) as RemoteFile[];
	const remoteByPath = new Map(remoteFiles.map((f) => [f.path, f]));

	const result: SyncResult = {
		pushed: [],
		pulled: [],
		conflicts: [],
		unchanged: 0,
	};
	const nextFiles: Record<string, FileState> = { ...state.files };
	const now = Date.now();

	for (const local of localFiles) {
		const prev = state.files[local.relativePath];
		const remote = remoteByPath.get(local.relativePath);
		const localChanged = !prev || prev.hash !== local.hash;
		const remoteChanged = !!remote && (!prev || prev.hash !== remote.contentHash);
		if (!remote) {
			await client.mutation(api.sync.pushFile, {
				workspaceId: config.workspaceId as any,
				path: local.relativePath,
				contentHash: local.hash,
				content: local.content,
				deviceId: config.deviceId,
			});
			nextFiles[local.relativePath] = { hash: local.hash, lastSyncedAt: now };
			result.pushed.push(local.relativePath);
			continue;
		}

		if (
			localChanged &&
			remoteChanged &&
			remote &&
			remote.contentHash !== local.hash
		) {
			const conflictName = toConflictName(local.relativePath);
			await fs.writeFile(`${workspacePath}/${conflictName}`, local.content);
			await fs.writeFile(`${workspacePath}/${local.relativePath}`, remote.content);
			nextFiles[local.relativePath] = { hash: remote.contentHash, lastSyncedAt: now };
			result.conflicts.push(local.relativePath);
			continue;
		}
		if (!localChanged && remoteChanged && remote && remote.contentHash !== local.hash) {
			await fs.writeFile(`${workspacePath}/${local.relativePath}`, remote.content);
			nextFiles[local.relativePath] = { hash: remote.contentHash, lastSyncedAt: now };
			result.pulled.push(local.relativePath);
			continue;
		}

		if (localChanged) {
			// TODO: batch into a single pushFiles mutation
			await client.mutation(api.sync.pushFile, {
				workspaceId: config.workspaceId as any,
				path: local.relativePath,
				contentHash: local.hash,
				content: local.content,
				deviceId: config.deviceId,
			});
			nextFiles[local.relativePath] = { hash: local.hash, lastSyncedAt: now };
			result.pushed.push(local.relativePath);
			continue;
		}

		result.unchanged++;
	}

	for (const remote of remoteFiles) {
		if (remote.deleted) continue;
		const local = localByPath.get(remote.path);
		if (local) continue;

		const dir = remote.path.includes("/")
			? `${workspacePath}/${remote.path.slice(0, remote.path.lastIndexOf("/"))}`
			: null;
		if (dir) await fs.ensureDir(dir);
		await fs.writeFile(`${workspacePath}/${remote.path}`, remote.content);
		nextFiles[remote.path] = { hash: remote.contentHash, lastSyncedAt: now };
		result.pulled.push(remote.path);
	}

	await writeSyncState(fs, workspacePath, { lastSyncedAt: now, files: nextFiles });
	return result;
}

/** Get current sync status without performing a sync. */
export async function status(fs: FileSystem, workspacePath: string) {
	if (!(await isInitialized(fs, workspacePath))) {
		return { initialized: false as const };
	}
	const config = await readConfig(fs, workspacePath);
	const state = await readSyncState(fs, workspacePath);
	const localFiles = await fs.listMarkdownFiles(workspacePath);

	let pendingChanges = 0;
	for (const f of localFiles) {
		const prev = state.files[f.relativePath];
		if (!prev || prev.hash !== f.hash) pendingChanges++;
	}

	return {
		initialized: true as const,
		workspaceName: config.workspaceName,
		deviceId: config.deviceId,
		lastSyncedAt: state.lastSyncedAt,
		localFiles: localFiles.length,
		trackedFiles: Object.keys(state.files).length,
		pendingChanges,
	};
}

function toConflictName(filePath: string): string {
	const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
	const dot = filePath.lastIndexOf(".");
	if (dot === -1) return `${filePath}.conflict-${ts}`;
	return `${filePath.slice(0, dot)}.conflict-${ts}${filePath.slice(dot)}`;
}
