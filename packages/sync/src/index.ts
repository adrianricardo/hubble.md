export type {
	AgentDocument,
	DocumentPatchResult,
	ReplaceRangeIntent,
	SyncBackend,
} from "./backend.js";
export {
	isInitialized,
	readConfig,
	readConfigOrDefault,
	readSyncState,
	removeCloudSyncConfig,
	writeCloudSyncConfig,
	writeConfig,
	writeSyncState,
} from "./config.js";
export type {
	FileSystem,
	InitFileSystem,
	LocalAsset,
	LocalFile,
} from "./fs.js";
export { contentHash } from "./fs.js";
export type {
	BackstopReason,
	ChangedRange,
	ReconcileBaseMetadata,
	ReconcileOutcome,
	ReconcileProjectionFileArgs,
} from "./reconcile.js";
export {
	changedRange,
	liveDocumentBaseCacheRoot,
	readReconcileBase,
	reconcileProjectionFile,
	toLocalEditName,
	writeReconcileBase,
} from "./reconcile.js";
export {
	exportLiveDocuments,
	importLiveDocuments,
	init,
	status,
	sync,
	writeLiveDocumentProjections,
} from "./sync.js";
export type {
	CloudSyncConfig,
	FileState,
	LiveDocumentExportResult,
	LiveDocumentImport,
	LiveDocumentImportResult,
	LiveDocumentProjection,
	LiveDocumentProjectionWriteResult,
	RemoteAsset,
	RemoteFile,
	SyncResult,
	SyncState,
	WorkspaceConfig,
} from "./types.js";
