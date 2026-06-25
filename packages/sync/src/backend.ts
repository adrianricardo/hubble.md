import type {
	LiveDocumentImport,
	LiveDocumentProjection,
	RemoteAsset,
	RemoteFile,
} from "./types.js";

/** A Live Document as seen by an agent/reconcile client. */
export type AgentDocument = {
	documentId: string;
	revision: number;
	markdown: string;
	path?: string | null;
	role?: "owner" | "editor" | "commenter" | "viewer" | null;
	canWrite: boolean;
};

/** Scoped, rebasable replace-range patch used by the file reconciler. */
export type ReplaceRangeIntent = {
	kind: "replace-range";
	baseMarkdown: string;
	from: number;
	to: number;
	markdown: string;
};

/** Result of applying a document patch. */
export type DocumentPatchResult = {
	documentId: string;
	revision: number;
	markdown: string;
};

/** Backend-agnostic interface for sync operations. */
export interface SyncBackend {
	getWorkspace(name: string): Promise<string | null>;
	createWorkspace(name: string): Promise<string>;

	getFiles(
		workspaceId: string,
		opts?: { since?: number; includeDeleted?: boolean },
	): Promise<RemoteFile[]>;
	pushFile(args: {
		workspaceId: string;
		path: string;
		contentHash: string;
		content: string;
		deviceId: string;
	}): Promise<void>;
	softDeleteFile(args: {
		workspaceId: string;
		path: string;
		deviceId: string;
	}): Promise<void>;

	getLiveDocuments(workspaceId: string): Promise<LiveDocumentProjection[]>;
	importLiveDocument(args: {
		workspaceId: string;
		path: string;
		title: string;
		markdown: string;
		actor?: string;
	}): Promise<LiveDocumentImport>;

	getDocumentForAgent(documentId: string): Promise<AgentDocument | null>;
	applyDocumentPatch(args: {
		documentId: string;
		baseRevision: number;
		intent: ReplaceRangeIntent;
		actor?: string;
	}): Promise<DocumentPatchResult>;

	getAssets(workspaceId: string, since?: number): Promise<RemoteAsset[]>;
	pushAsset(args: {
		workspaceId: string;
		path: string;
		storageId: string;
		contentHash: string;
		deviceId: string;
	}): Promise<void>;
	softDeleteAsset(args: {
		workspaceId: string;
		path: string;
		deviceId: string;
	}): Promise<void>;

	generateAssetUploadUrl(workspaceId: string): Promise<string>;
	getAssetDownloadUrl(storageId: string): Promise<string | null>;
}
