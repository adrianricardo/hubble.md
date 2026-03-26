import type { Id } from "@hubble.md/sync-backend/types";
import { z } from "zod/v4";

export const WorkspaceConfigSchema = z.object({
	workspaceId: z.string(),
	workspaceName: z.string(),
	deviceId: z.string(),
	convexUrl: z.string(),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

export const FileStateSchema = z.object({
	hash: z.string(),
	lastSyncedAt: z.number(),
});
export type FileState = z.infer<typeof FileStateSchema>;

export const SyncStateSchema = z.object({
	lastSyncedAt: z.number(),
	files: z.record(z.string(), FileStateSchema),
	assets: z.record(z.string(), FileStateSchema).optional(),
});
export type SyncState = z.infer<typeof SyncStateSchema>;

export type SyncResult = {
	pushed: string[];
	pulled: string[];
	deleted: string[];
	conflicts: string[];
	unchanged: number;
	assetsPushed: number;
	assetsPulled: number;
	assetsDeleted: number;
};

export type RemoteFile = {
	_id: Id<"files">;
	path: string;
	contentHash: string;
	content: string;
	updatedAt: number;
	deviceId: string;
	deleted: boolean;
};

export type RemoteAsset = {
	_id: Id<"assets">;
	path: string;
	storageId: Id<"_storage">;
	contentHash: string;
	updatedAt: number;
	deviceId: string;
	deleted: boolean;
};
