import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { createConvexSubscriber } from "@hubble.md/convex-client";
import { withMarkdownExtension } from "@hubble.md/editor";
import { api } from "@hubble.md/sync-backend";
import type { Id } from "@hubble.md/sync-backend/types";
import { AppShellFrame } from "@hubble.md/ui";
import { useStoreValue } from "@simplestack/store/react";
import {
	Authenticated,
	AuthLoading,
	ConvexReactClient,
	Unauthenticated,
	useMutation,
	useQuery,
} from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TestIdentity } from "../App";
import { saveWorkspace } from "../connection/connection";
import {
	applyRemoteChange,
	clearCurrentPath,
	getActionCtx,
	loadPath,
	loadWorkspaceSnapshot,
	markRemoteDeleted,
	refreshAssets,
	refreshFiles,
	reloadFromRemote,
	savePathContent,
	teardownActions,
} from "../store/actions";
import { viewerStore, workspaceStore } from "../store/state";
import { EditorView } from "./EditorView";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";

type Props = {
	url: string;
	workspaceId: string;
	filePath: string | null;
	documentId: string | null;
	testIdentity: TestIdentity | null;
	onSelectFile: (path: string) => void;
	onSelectDocument: (documentId: string) => void;
	onSwitch: (id: string) => void;
	onWorkspaceLoaded: (workspaceId: string) => void;
	onDisconnect: () => void;
};

export function AppShell({
	url,
	workspaceId,
	filePath,
	documentId,
	testIdentity,
	onSelectFile,
	onSelectDocument,
	onSwitch,
	onWorkspaceLoaded,
	onDisconnect,
}: Props) {
	const viewer = useStoreValue(viewerStore);
	const workspace = useStoreValue(workspaceStore);
	const [newNoteName, setNewNoteName] = useState<string | null>(null);
	const [newNoteSubmitted, setNewNoteSubmitted] = useState(false);
	const newNoteInputRef = useRef<HTMLInputElement>(null);
	const convexClient = useMemo(() => new ConvexReactClient(url), [url]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: snapshot reloads only when workspace identity changes; file route changes load below
	useEffect(() => {
		void loadWorkspaceSnapshot(url, workspaceId, filePath).then((loaded) => {
			if (!loaded) return;
			saveWorkspace(workspaceId);
			onWorkspaceLoaded(workspaceId);
		});
	}, [url, workspaceId]);

	useEffect(() => {
		if (workspace.snapshot?.id !== workspaceId) return;
		if (documentId) {
			clearCurrentPath();
			return;
		}
		if (filePath) {
			if (viewerStore.get().currentPath !== filePath) void loadPath(filePath);
			return;
		}
		clearCurrentPath();
	}, [documentId, filePath, workspace.snapshot?.id, workspaceId]);

	useEffect(() => {
		return () => {
			teardownActions();
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: subscription owns its lifecycle by url+workspaceId
	useEffect(() => {
		if (!workspace.snapshot) return;
		const subscriber = createConvexSubscriber(url);
		const unsubscribe = subscriber.onFilesChanged(
			workspace.snapshot.id,
			() => {
				void onRemoteFilesChanged();
			},
			(err) => {
				console.error("subscription error:", err);
			},
		);
		const unsubscribeAssets = subscriber.onAssetsChanged(
			workspace.snapshot.id,
			() => {
				void refreshAssets();
			},
			(err) => {
				console.error("asset subscription error:", err);
			},
		);
		return () => {
			unsubscribe();
			unsubscribeAssets();
			void subscriber.close();
		};
	}, [url, workspace.snapshot]);

	useEffect(() => {
		if (newNoteName !== null) {
			requestAnimationFrame(() => newNoteInputRef.current?.focus());
		}
	}, [newNoteName]);

	const newNotePath = normalizeNotePath(newNoteName ?? "");
	const newNoteConflict = workspace.files.some(
		(file) => file.path === newNotePath,
	);
	const showNewNoteConflict = newNoteSubmitted && newNoteConflict;

	const handleNewNote = () => {
		setNewNoteName("");
		setNewNoteSubmitted(false);
	};

	const submitNewNote = async (event: React.FormEvent) => {
		event.preventDefault();
		setNewNoteSubmitted(true);
		const name = (newNoteName ?? "").trim();
		if (!name) return;
		const path = normalizeNotePath(name);
		if (workspace.files.some((file) => file.path === path)) return;
		await savePathContent(path, "");
		setNewNoteName(null);
		setNewNoteSubmitted(false);
		await refreshFiles();
		onSelectFile(path);
	};

	const onRemoteFilesChanged = async () => {
		const ctx = getActionCtx();
		if (!ctx) return;
		const remote = await ctx.backend.getFiles(ctx.workspaceId, {
			includeDeleted: true,
		});
		// One tombstone-inclusive fetch updates the sidebar and detects whether
		// the current file was deleted.
		const visible = remote
			.filter((f) => !f.deleted)
			.map((f) => ({
				path: f.path,
				contentHash: f.contentHash,
				updatedAt: f.updatedAt,
				deleted: f.deleted,
			}));
		workspaceStore.set((state) => ({ ...state, files: visible }));

		const v = viewerStore.get();
		if (!v.currentPath) return;
		const current = remote.find((f) => f.path === v.currentPath);
		if (!current || current.deleted) {
			markRemoteDeleted(v.currentPath);
			return;
		}
		applyRemoteChange(v.currentPath, current.content, current.contentHash);
	};

	if (!workspace.snapshot) {
		return (
			<main className="flex h-dvh items-center justify-center bg-background text-foreground">
				<p className="text-sm text-muted-foreground">
					{workspace.status === "error"
						? (workspace.error ?? "Workspace failed to load")
						: "Loading workspace…"}
				</p>
			</main>
		);
	}

	return (
		<ConvexAuthProvider client={convexClient}>
			{testIdentity ? (
				<AppShellContent
					url={url}
					documentId={documentId}
					testIdentity={testIdentity}
					viewer={viewer}
					workspace={workspace}
					newNoteName={newNoteName}
					newNoteInputRef={newNoteInputRef}
					newNotePath={newNotePath}
					showNewNoteConflict={showNewNoteConflict}
					onSelectFile={onSelectFile}
					onSelectDocument={onSelectDocument}
					onSwitch={onSwitch}
					onDisconnect={onDisconnect}
					onNewNote={handleNewNote}
					onSubmitNewNote={submitNewNote}
					onSetNewNoteName={setNewNoteName}
					onReloadWorkspace={() => {
						void loadWorkspaceSnapshot(url, workspaceId, filePath);
					}}
				/>
			) : (
				<>
					<AuthLoading>
						<AuthStatus message="Checking session…" />
					</AuthLoading>
					<Unauthenticated>
						<SignInScreen />
					</Unauthenticated>
					<Authenticated>
						<AppShellContent
							url={url}
							documentId={documentId}
							testIdentity={testIdentity}
							viewer={viewer}
							workspace={workspace}
							newNoteName={newNoteName}
							newNoteInputRef={newNoteInputRef}
							newNotePath={newNotePath}
							showNewNoteConflict={showNewNoteConflict}
							onSelectFile={onSelectFile}
							onSelectDocument={onSelectDocument}
							onSwitch={onSwitch}
							onDisconnect={onDisconnect}
							onNewNote={handleNewNote}
							onSubmitNewNote={submitNewNote}
							onSetNewNoteName={setNewNoteName}
							onReloadWorkspace={() => {
								void loadWorkspaceSnapshot(url, workspaceId, filePath);
							}}
						/>
					</Authenticated>
				</>
			)}
		</ConvexAuthProvider>
	);
}

function AppShellContent({
	url,
	documentId,
	testIdentity,
	viewer,
	workspace,
	newNoteName,
	newNoteInputRef,
	newNotePath,
	showNewNoteConflict,
	onSelectFile,
	onSelectDocument,
	onSwitch,
	onDisconnect,
	onNewNote,
	onSubmitNewNote,
	onSetNewNoteName,
	onReloadWorkspace,
}: {
	url: string;
	documentId: string | null;
	testIdentity: TestIdentity | null;
	viewer: ReturnType<typeof viewerStore.get>;
	workspace: ReturnType<typeof workspaceStore.get>;
	newNoteName: string | null;
	newNoteInputRef: React.RefObject<HTMLInputElement | null>;
	newNotePath: string;
	showNewNoteConflict: boolean;
	onSelectFile: (path: string) => void;
	onSelectDocument: (documentId: string) => void;
	onSwitch: (id: string) => void;
	onDisconnect: () => void;
	onNewNote: () => void;
	onSubmitNewNote: (event: React.FormEvent) => void;
	onSetNewNoteName: (name: string | null) => void;
	onReloadWorkspace: () => void;
}) {
	if (!workspace.snapshot) return null;

	return (
		<AppShellFrame
			sidebar={
				<Sidebar
					url={url}
					workspaceId={workspace.snapshot.id}
					workspaceName={workspace.snapshot.name}
					selectedDocumentId={documentId}
					onSelectFile={onSelectFile}
					onSelectDocument={onSelectDocument}
					onSwitch={onSwitch}
					onDisconnect={onDisconnect}
				/>
			}
			toolbar={
				<Toolbar
					onNewNote={onNewNote}
					sessionSlot={!testIdentity ? <SignOutButton /> : undefined}
				/>
			}
		>
			{workspace.status === "error" && workspace.error && (
				<ExternalChangeBanner
					message={workspace.error}
					onReload={onReloadWorkspace}
				/>
			)}
			{newNoteName !== null && (
				<form
					onSubmit={onSubmitNewNote}
					className="border-b border-border bg-muted/40 [padding-block:0.5rem] [padding-inline:0.75rem]"
				>
					<div className="mx-auto flex max-w-3xl items-center gap-2">
						<input
							ref={newNoteInputRef}
							type="text"
							required
							value={newNoteName}
							onChange={(e) => onSetNewNoteName(e.target.value)}
							placeholder="note-name.md"
							aria-invalid={showNewNoteConflict}
							aria-describedby={
								showNewNoteConflict ? "new-note-conflict" : undefined
							}
							className="flex-1 rounded-sm border border-border bg-background text-sm outline-none focus:border-ring [padding-block:0.25rem] [padding-inline:0.5rem]"
						/>
						<button
							type="submit"
							className="rounded-sm bg-primary text-xs font-medium text-primary-foreground [padding-block:0.25rem] [padding-inline:0.75rem]"
						>
							Create
						</button>
						<button
							type="button"
							onClick={() => onSetNewNoteName(null)}
							className="rounded-sm text-xs text-muted-foreground hover:bg-sidebar-accent [padding-block:0.25rem] [padding-inline:0.75rem]"
						>
							Cancel
						</button>
					</div>
					{showNewNoteConflict && (
						<p
							id="new-note-conflict"
							className="mx-auto mt-2 max-w-3xl text-sm text-destructive"
						>
							A file named {newNotePath} already exists.
						</p>
					)}
				</form>
			)}
			{documentId && (
				<LiveDocumentView
					workspaceId={workspace.snapshot.id}
					documentId={documentId}
					testIdentity={testIdentity}
				/>
			)}
			{!documentId && viewer.currentPath && (
				<div className="flex h-full min-h-0 flex-col">
					{testIdentity && (
						<LivePocIdentityBar
							workspaceId={workspace.snapshot.id}
							path={viewer.currentPath}
							identity={testIdentity}
						/>
					)}
					{viewer.externalChange.kind === "conflict" && (
						<ExternalChangeBanner
							message="Remote changes available. Reload to accept."
							onReload={reloadFromRemote}
						/>
					)}
					{viewer.externalChange.kind === "deleted" && (
						<ExternalChangeBanner
							message="This file was deleted remotely. Reload before editing."
							onReload={() => {
								if (viewer.currentPath) void loadPath(viewer.currentPath);
							}}
						/>
					)}
					<EditorView
						workspaceId={workspace.snapshot.id}
						path={viewer.currentPath}
						initialMarkdown={viewer.content}
						testIdentity={testIdentity}
					/>
				</div>
			)}
			{!documentId && !viewer.currentPath && viewer.status === "loading" && (
				<p className="[padding:1.5rem] text-sm text-muted-foreground">
					Loading…
				</p>
			)}
			{!documentId && !viewer.currentPath && viewer.status === "error" && (
				<p className="[padding:1.5rem] text-sm text-destructive">
					{viewer.error}
				</p>
			)}
			{!documentId &&
				!viewer.currentPath &&
				viewer.status !== "loading" &&
				viewer.status !== "error" &&
				workspace.filesLoaded && (
					<div className="flex h-full items-center justify-center [padding:1.5rem]">
						<p className="text-sm text-muted-foreground">
							Select a file, or create a new one with +.
						</p>
					</div>
				)}
		</AppShellFrame>
	);
}

function SignInScreen() {
	const { signIn } = useAuthActions();
	const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setPending(true);
		const formData = new FormData(event.currentTarget);
		formData.set("flow", mode);
		try {
			await signIn("password", formData);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign in failed");
		} finally {
			setPending(false);
		}
	};

	return (
		<main className="flex h-dvh items-center justify-center bg-background text-foreground [padding-block:1.5rem] [padding-inline:1.5rem]">
			<form
				onSubmit={submit}
				className="w-full max-w-sm rounded-sm border border-border bg-card [padding-block:1rem] [padding-inline:1rem]"
			>
				<h1 className="text-base font-semibold text-foreground">
					{mode === "signIn" ? "Sign in to Hubble" : "Create your account"}
				</h1>
				<label
					htmlFor="auth-email"
					className="mt-4 block text-sm font-medium text-foreground"
				>
					Email
				</label>
				<input
					id="auth-email"
					name="email"
					type="email"
					required
					autoComplete="email"
					className="mt-2 w-full rounded-sm border border-border bg-background text-sm outline-none focus:border-ring [padding-block:0.5rem] [padding-inline:0.625rem]"
				/>
				{mode === "signUp" && (
					<>
						<label
							htmlFor="auth-name"
							className="mt-3 block text-sm font-medium text-foreground"
						>
							Name
						</label>
						<input
							id="auth-name"
							name="name"
							type="text"
							required
							autoComplete="name"
							className="mt-2 w-full rounded-sm border border-border bg-background text-sm outline-none focus:border-ring [padding-block:0.5rem] [padding-inline:0.625rem]"
						/>
					</>
				)}
				<label
					htmlFor="auth-password"
					className="mt-3 block text-sm font-medium text-foreground"
				>
					Password
				</label>
				<input
					id="auth-password"
					name="password"
					type="password"
					required
					autoComplete={mode === "signIn" ? "current-password" : "new-password"}
					className="mt-2 w-full rounded-sm border border-border bg-background text-sm outline-none focus:border-ring [padding-block:0.5rem] [padding-inline:0.625rem]"
				/>
				{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
				<button
					type="submit"
					disabled={pending}
					className="mt-4 w-full rounded-sm bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60 [padding-block:0.5rem] [padding-inline:0.75rem]"
				>
					{pending ? "Working…" : mode === "signIn" ? "Sign in" : "Sign up"}
				</button>
				<button
					type="button"
					onClick={() => {
						setError(null);
						setMode(mode === "signIn" ? "signUp" : "signIn");
					}}
					className="mt-3 w-full rounded-sm text-sm text-muted-foreground hover:bg-sidebar-accent [padding-block:0.5rem] [padding-inline:0.75rem]"
				>
					{mode === "signIn" ? "Create an account" : "Sign in instead"}
				</button>
			</form>
		</main>
	);
}

function SignOutButton() {
	const { signOut } = useAuthActions();
	return (
		<button
			type="button"
			onClick={() => void signOut()}
			className="rounded-sm text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground [padding-block:0.25rem] [padding-inline:0.5rem]"
		>
			Sign out
		</button>
	);
}

function AuthStatus({ message }: { message: string }) {
	return (
		<main className="flex h-dvh items-center justify-center bg-background text-foreground">
			<p className="text-sm text-muted-foreground">{message}</p>
		</main>
	);
}

function LiveDocumentView({
	workspaceId,
	documentId,
	testIdentity,
}: {
	workspaceId: string;
	documentId: string;
	testIdentity: TestIdentity | null;
}) {
	const document = useQuery(api.documents.getWithMarkdown, {
		documentId: documentId as Id<"documents">,
	});
	const markEdited = useMutation(api.documents.markEdited);
	const lastEditMarkRef = useRef(0);
	// Live Documents must not follow mutable path/title metadata; the Convex
	// document ID is the stable collaboration authority.
	const syncDocId = `document:${documentId}`;
	const markLiveDocumentEdited = useCallback(() => {
		const now = Date.now();
		if (now - lastEditMarkRef.current < 5_000) return;
		lastEditMarkRef.current = now;
		void markEdited({
			documentId: documentId as Id<"documents">,
			actor: testIdentity?.name ?? "Local collaborator",
		});
	}, [documentId, markEdited, testIdentity?.name]);

	if (document === undefined) {
		return (
			<div className="flex h-full items-center justify-center [padding:1.5rem]">
				<p className="text-sm text-muted-foreground">Loading document…</p>
			</div>
		);
	}

	if (document === null) {
		return (
			<div className="flex h-full items-center justify-center [padding:1.5rem]">
				<p className="text-sm text-muted-foreground">Document not found.</p>
			</div>
		);
	}

	const path = document.path ?? withMarkdownExtension(document.title);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{testIdentity && (
				<LivePocIdentityBar
					workspaceId={workspaceId}
					docId={syncDocId}
					identity={testIdentity}
				/>
			)}
			<div className="border-b border-border bg-muted/30">
				<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground [padding-block:0.5rem] [padding-inline:0.75rem]">
					<span className="font-medium text-foreground">{document.title}</span>
					<span>
						{formatEditedMeta(document.updatedAt, document.updatedBy)}
					</span>
				</div>
			</div>
			<EditorView
				workspaceId={workspaceId}
				path={path}
				initialMarkdown={document.markdown}
				syncDocumentId={syncDocId}
				testIdentity={testIdentity}
				onLiveDocumentEdit={markLiveDocumentEdited}
			/>
		</div>
	);
}

function formatEditedMeta(updatedAt: number, updatedBy?: string) {
	const editedAt = new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(updatedAt));
	return updatedBy
		? `Last edited by ${updatedBy} at ${editedAt}`
		: `Last edited ${editedAt}`;
}

function normalizeNotePath(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return "";
	return withMarkdownExtension(trimmed);
}

function LivePocIdentityBar({
	workspaceId,
	path,
	docId: providedDocId,
	identity,
}: {
	workspaceId: string;
	path?: string;
	docId?: string;
	identity: TestIdentity;
}) {
	const docId = useMemo(
		() => providedDocId ?? `poc:${workspaceId}:${path ?? ""}`,
		[providedDocId, workspaceId, path],
	);
	const convexWorkspaceId = workspaceId as Id<"workspaces">;
	const heartbeat = useMutation(api.pocIdentity.heartbeat);
	const activeUsers = useQuery(api.pocIdentity.listActive, { docId });

	useEffect(() => {
		let cancelled = false;
		const beat = () => {
			if (cancelled) return;
			void heartbeat({
				workspaceId: convexWorkspaceId,
				docId,
				userId: identity.userId,
				name: identity.name,
			});
		};
		beat();
		const interval = window.setInterval(beat, 10_000);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [convexWorkspaceId, docId, heartbeat, identity.name, identity.userId]);

	const collaborators = activeUsers?.map((user) =>
		user.userId === identity.userId ? `${user.name} (you)` : user.name,
	) ?? [`${identity.name} (you)`];

	return (
		<div className="border-b border-border bg-muted/40">
			<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground [padding-block:0.5rem] [padding-inline:0.75rem]">
				<span>POC identity: {identity.name}</span>
				<span>{collaborators.join(", ")}</span>
			</div>
		</div>
	);
}

function ExternalChangeBanner({
	message,
	onReload,
}: {
	message: string;
	onReload: () => void;
}) {
	return (
		<div className="border-b border-border bg-muted/40">
			<div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
				<p className="m-0 text-sm text-muted-foreground">{message}</p>
				<button
					type="button"
					onClick={onReload}
					className="rounded-sm border border-border bg-background px-3 py-1 text-xs hover:bg-sidebar-accent"
				>
					Reload
				</button>
			</div>
		</div>
	);
}
