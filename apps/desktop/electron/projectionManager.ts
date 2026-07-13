import type { PendingProjectionOperation } from "@hubble.md/sync";
import type { SyncedFolderStatus } from "../src/desktopApi/types";
import type {
	ConnectFolderInput,
	SyncedFolderService,
} from "./syncedFolderService";

type ProjectionEngine = Pick<
	SyncedFolderService,
	| "approvePendingDeletion"
	| "approvePendingMove"
	| "cancelPendingDeletion"
	| "cancelPendingMove"
	| "connect"
	| "disconnect"
	| "dismissTrashUndo"
	| "getStatus"
	| "isLiveDocument"
	| "listPendingOperations"
	| "undoTrashedDocument"
>;

export type ProjectionStatus = {
	scope: { kind: "workspace-mirror" } | { kind: "folder"; folderId: string };
	status: SyncedFolderStatus;
};

export class ProjectionManager {
	#wholeWorkspace: ProjectionEngine;
	#createMount: (folderId: string) => ProjectionEngine;
	#mounts = new Map<string, ProjectionEngine>();

	constructor(options: {
		wholeWorkspace: ProjectionEngine;
		createMount: (folderId: string) => ProjectionEngine;
	}) {
		this.#wholeWorkspace = options.wholeWorkspace;
		this.#createMount = options.createMount;
	}

	get wholeWorkspaceConnected(): boolean {
		return this.#wholeWorkspace.getStatus().connected;
	}

	get mountCount(): number {
		return this.#mounts.size;
	}

	hasMount(folderId: string): boolean {
		return this.#mounts.has(folderId);
	}

	getMountStatus(folderId: string): SyncedFolderStatus | null {
		return this.#mounts.get(folderId)?.getStatus() ?? null;
	}

	connectWholeWorkspace(input: ConnectFolderInput) {
		return this.#wholeWorkspace.connect(input);
	}

	disconnectWholeWorkspace() {
		return this.#wholeWorkspace.disconnect();
	}

	getWholeWorkspaceStatus(): SyncedFolderStatus {
		return this.#wholeWorkspace.getStatus();
	}

	async connectMount(
		folderId: string,
		input: ConnectFolderInput,
	): Promise<SyncedFolderStatus> {
		await this.disconnectMount(folderId);
		const engine = this.#createMount(folderId);
		this.#mounts.set(folderId, engine);
		try {
			return await engine.connect(input);
		} catch (error) {
			this.#mounts.delete(folderId);
			await engine.disconnect().catch(() => undefined);
			throw error;
		}
	}

	async disconnectMount(folderId: string): Promise<void> {
		const engine = this.#mounts.get(folderId);
		if (!engine) return;
		this.#mounts.delete(folderId);
		await engine.disconnect();
	}

	listStatuses(): ProjectionStatus[] {
		return [
			{
				scope: { kind: "workspace-mirror" },
				status: this.#wholeWorkspace.getStatus(),
			},
			...[...this.#mounts].map(([folderId, engine]) => ({
				scope: { kind: "folder" as const, folderId },
				status: engine.getStatus(),
			})),
		];
	}

	isLiveDocument(absPath: string): boolean {
		return this.#engines().some((engine) => engine.isLiveDocument(absPath));
	}

	async listPendingOperations(): Promise<PendingProjectionOperation[]> {
		return (
			await Promise.all(
				this.#engines().map((engine) => engine.listPendingOperations()),
			)
		).flat();
	}

	approvePendingMove(operationId: string) {
		return this.#routeOperation(operationId, (engine) =>
			engine.approvePendingMove(operationId),
		);
	}

	cancelPendingMove(operationId: string) {
		return this.#routeOperation(operationId, (engine) =>
			engine.cancelPendingMove(operationId),
		);
	}

	approvePendingDeletion(operationId: string) {
		return this.#routeOperation(operationId, (engine) =>
			engine.approvePendingDeletion(operationId),
		);
	}

	cancelPendingDeletion(operationId: string) {
		return this.#routeOperation(operationId, (engine) =>
			engine.cancelPendingDeletion(operationId),
		);
	}

	undoTrashedDocument(operationId: string) {
		return this.#routeOperation(operationId, (engine) =>
			engine.undoTrashedDocument(operationId),
		);
	}

	dismissTrashUndo(operationId: string) {
		return this.#routeOperation(operationId, (engine) =>
			engine.dismissTrashUndo(operationId),
		);
	}

	#engines(): ProjectionEngine[] {
		return [this.#wholeWorkspace, ...this.#mounts.values()];
	}

	async #routeOperation<T>(
		operationId: string,
		action: (engine: ProjectionEngine) => Promise<T>,
	): Promise<T> {
		// Renderer actions carry the stable operation ID, not a device-local root.
		// The journal that contains the ID is therefore the routing authority.
		for (const engine of this.#engines()) {
			const operations = await engine.listPendingOperations();
			if (operations.some(({ id }) => id === operationId))
				return action(engine);
		}
		throw new Error(`Pending projection operation not found: ${operationId}`);
	}
}
