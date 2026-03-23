export { init, sync, status } from "./sync.js";
export { isInitialized, readConfig } from "./config.js";
export { contentHash } from "./fs.js";
export type { FileSystem, LocalFile } from "./fs.js";
export type {
	WorkspaceConfig,
	SyncState,
	SyncResult,
	FileState,
	RemoteFile,
} from "./types.js";
