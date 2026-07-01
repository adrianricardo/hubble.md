import { api } from "@hubble.md/sync-backend";
import {
	Button,
	Sidebar as SharedSidebar,
	type SidebarFocusedItem,
	SidebarFrame,
} from "@hubble.md/ui";
import { useStoreValue } from "@simplestack/store/react";
import {
	Authenticated,
	AuthLoading,
	Unauthenticated,
	useMutation,
	useQuery,
} from "convex/react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import MingcuteAddLine from "~icons/mingcute/add-line";
import MingcuteCloudLine from "~icons/mingcute/cloud-line";
import { desktopApi } from "../desktopApi";
import { revealFileLabel } from "../lib/revealFile";
import {
	createMarkdownFileInFolder,
	deleteFolder,
	deleteMarkdownFile,
	loadPath,
	moveSidebarItem,
	openWorkspace,
	renameMarkdownFile,
	setSidebarOpen,
	setSortMode,
	togglePinnedNote,
} from "../store/actions";
import {
	currentPathStore,
	sidebarOpenStore,
	workspaceStore,
} from "../store/state";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export function Sidebar({
	cloudEnabled,
	footer,
	onOpenSettings,
	onFocusedPathChange,
}: {
	cloudEnabled?: boolean;
	footer?: ReactNode;
	onOpenSettings?: () => void;
	onFocusedPathChange?: (path: string | null) => void;
}) {
	const workspace = useStoreValue(workspaceStore);
	const sidebarOpen = useStoreValue(sidebarOpenStore);
	const currentPath = useStoreValue(currentPathStore);
	const { workspacePath, files, folders, pinnedNotes, sortMode } = workspace;
	const pinnedSet = new Set(pinnedNotes);

	if (!sidebarOpen) return null;
	const collapseSidebar = () => setSidebarOpen(false);
	if (!workspacePath) {
		return (
			<SidebarFrame onCollapse={collapseSidebar}>
				{cloudEnabled ? (
					<CloudSidebarSection
						files={files}
						onOpenSettings={onOpenSettings}
						className="[border-block-end:1px_solid_var(--sidebar-border)]"
					/>
				) : null}
				<div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-3 [padding-inline:0.75rem] text-sm">
					<div className="flex flex-col gap-1">
						<p className="font-medium text-sidebar-foreground">
							No local folder selected
						</p>
						<p className="text-sidebar-foreground/70">
							Add a folder for local Markdown files, backup, grep, and agent
							access.
						</p>
					</div>
					<Button size="sm" onClick={() => void openWorkspace()}>
						Open local folder
					</Button>
				</div>
				{footer ? (
					<div className="border-t border-sidebar-border p-2">{footer}</div>
				) : null}
			</SidebarFrame>
		);
	}

	const relativePath = (absPath: string) => {
		const prefix = workspacePath.endsWith("/")
			? workspacePath
			: `${workspacePath}/`;
		return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath;
	};
	const absolutePath = (displayPath: string | null) => {
		if (!displayPath) return workspacePath;
		const normalized = displayPath.replace(/\/+$/, "");
		return workspacePath.endsWith("/")
			? `${workspacePath}${normalized}`
			: `${workspacePath}/${normalized}`;
	};
	const copyFilePath = async (path: string) => {
		try {
			await navigator.clipboard.writeText(path);
			toast.success("File path copied");
		} catch {
			toast.error("Failed to copy file path");
		}
	};

	return (
		<SharedSidebar
			files={files.map((file) => ({
				path: file.path,
				modifiedAt: file.modified_at,
				pinned: pinnedSet.has(file.path),
			}))}
			folders={folders.map((folder) => ({
				path: folder.path,
				modifiedAt: folder.modified_at,
			}))}
			currentPath={currentPath ?? null}
			sortMode={sortMode}
			storageScope={workspacePath}
			header={<WorkspaceSwitcher />}
			topSlot={
				cloudEnabled ? (
					<CloudSidebarSection
						files={files}
						onOpenSettings={onOpenSettings}
						className="[border-block-end:1px_solid_var(--sidebar-border)]"
					/>
				) : undefined
			}
			footer={footer}
			getDisplayPath={relativePath}
			onCollapse={collapseSidebar}
			onSortModeChange={setSortMode}
			onSelectFile={(path) => void loadPath(path)}
			onRevealFile={(path) => void desktopApi.revealFile(path)}
			onCopyFilePath={(path) => void copyFilePath(path)}
			onRevealFolder={(folderId) =>
				void desktopApi.revealFile(absolutePath(folderId))
			}
			onFocusedItemChange={(item: SidebarFocusedItem) => {
				if (!item) {
					onFocusedPathChange?.(null);
					return;
				}
				onFocusedPathChange?.(
					item.kind === "file" ? item.path : absolutePath(item.folderId),
				);
			}}
			revealLabel={revealFileLabel(desktopApi.platform)}
			onRenameFile={(path, nextName) => void renameMarkdownFile(path, nextName)}
			onDeleteFile={(path) => void deleteMarkdownFile(path)}
			onTogglePinnedFile={(path) => void togglePinnedNote(path)}
			onCreateFile={(folderId) =>
				createMarkdownFileInFolder(absolutePath(folderId))
			}
			onDeleteFolder={(folderId) => void deleteFolder(absolutePath(folderId))}
			onMoveItem={({ item, targetFolderId }) =>
				void moveSidebarItem(item, absolutePath(targetFolderId))
			}
		/>
	);
}

function CloudSidebarSection({
	files,
	onOpenSettings,
	className,
}: {
	files: { path: string }[];
	onOpenSettings?: () => void;
	className?: string;
}) {
	return (
		<div
			className={`grid gap-2 [padding-block:0.625rem] [padding-inline:0.625rem] ${className ?? ""}`}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<MingcuteCloudLine className="size-3.5 shrink-0 text-muted-foreground" />
					<span className="truncate text-[11px] font-medium uppercase text-muted-foreground">
						Live Documents
					</span>
				</div>
				<Authenticated>
					<CloudSidebarCreateButton />
				</Authenticated>
			</div>
			<AuthLoading>
				<p className="text-[11px] text-sidebar-foreground/70">
					Loading workspace…
				</p>
			</AuthLoading>
			<Unauthenticated>
				<div className="grid gap-2">
					<p className="text-[11px] text-sidebar-foreground/70">
						Sign in to see workspace documents.
					</p>
					{onOpenSettings ? (
						<Button size="sm" variant="outline" onClick={onOpenSettings}>
							Open settings
						</Button>
					) : null}
				</div>
			</Unauthenticated>
			<Authenticated>
				<AuthenticatedCloudSidebarSection files={files} />
			</Authenticated>
		</div>
	);
}

function CloudSidebarCreateButton() {
	const dashboard = useQuery(api.documents.dashboard, {
		recentLimit: 1,
		sharedLimit: 0,
	});
	const createDocument = useMutation(api.documents.create);
	const [creating, setCreating] = useState(false);
	const workspace =
		dashboard?.workspaces.find((item) => item.personal) ??
		dashboard?.workspaces[0];

	const createLiveDocument = async () => {
		if (!workspace || creating) return;
		setCreating(true);
		try {
			await createDocument({
				workspaceId: workspace._id,
				title: "Untitled",
			});
			toast.success("Live Document created");
		} catch (error) {
			toast.error("Failed to create Live Document", {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setCreating(false);
		}
	};

	return (
		<Button
			variant="ghost"
			size="icon-xs"
			aria-label="New Live Document"
			title="New Live Document"
			disabled={!workspace || creating}
			onClick={() => void createLiveDocument()}
		>
			<MingcuteAddLine className="size-3.5" />
		</Button>
	);
}

function AuthenticatedCloudSidebarSection({
	files,
}: {
	files: { path: string }[];
}) {
	const dashboard = useQuery(api.documents.dashboard, {
		recentLimit: 5,
		sharedLimit: 2,
	});
	const documents = dashboard
		? [...dashboard.recents, ...dashboard.sharedWithMe].slice(0, 6)
		: [];

	if (dashboard === undefined) {
		return (
			<p className="text-[11px] text-sidebar-foreground/70">
				Loading documents…
			</p>
		);
	}

	if (documents.length === 0) {
		return (
			<p className="text-[11px] text-sidebar-foreground/70">
				No Live Documents yet.
			</p>
		);
	}

	return (
		<div className="grid gap-0.5">
			{documents.map((document) => (
				<button
					key={document._id}
					type="button"
					className="min-w-0 truncate rounded-sm text-start text-[11px] text-sidebar-foreground hover:bg-sidebar-accent [padding-block:0.25rem] [padding-inline:0.375rem]"
					title={document.title}
					onClick={() => openLiveDocumentProjection(document, files)}
				>
					{document.title}
				</button>
			))}
		</div>
	);
}

function openLiveDocumentProjection(
	document: { title: string; path?: string },
	files: { path: string }[],
) {
	// Desktop edits Live Documents through the synced Markdown projection in this
	// IA slice, so a cloud row can open only after the mirror has materialized it.
	const candidates = [
		document.path,
		document.title.endsWith(".md") ? document.title : `${document.title}.md`,
	].filter((path): path is string => Boolean(path));
	const match = files.find((file) =>
		candidates.some((candidate) => file.path.endsWith(candidate)),
	);
	if (!match) {
		toast("Connect a synced folder to edit this document locally", {
			description:
				"Live Document editing stays cloud-authoritative; the local file appears after sync.",
		});
		return;
	}
	void loadPath(match.path);
}
