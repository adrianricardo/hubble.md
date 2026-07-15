import { api } from "@hubble.md/sync-backend";
import type { Id } from "@hubble.md/sync-backend/types";
import { Button, Input, Modal } from "@hubble.md/ui";
import { useQuery } from "convex/react";
import { useEffect, useId, useRef, useState } from "react";
import MingcuteFolderOpenLine from "~icons/mingcute/folder-open-line";
import { desktopApi } from "../desktopApi";
import type {
	AuthorityTransferOperation,
	GitDestinationInspection,
	GitFolderInspection,
} from "../desktopApi/types";
import { previewChanged, safeGitFolderName } from "./authorityMovePreviewModel";

const authorityPreviewFocusDelayMs = 100;

export type AuthorityPreviewTarget =
	| {
			direction: "git-to-cloud";
			intent: "move" | "share";
			folderPath: string;
			name: string;
	  }
	| {
			direction: "cloud-to-git";
			intent: "move";
			workspaceId: string;
			folderId: string;
			name: string;
			includeWorkspaceMembers: boolean;
	  };

function useOnlineState() {
	const [online, setOnline] = useState(() => navigator.onLine);
	useEffect(() => {
		const update = () => setOnline(navigator.onLine);
		window.addEventListener("online", update);
		window.addEventListener("offline", update);
		return () => {
			window.removeEventListener("online", update);
			window.removeEventListener("offline", update);
		};
	}, []);
	return online;
}

export function AuthorityMovePreviewDialog({
	target,
	onClose,
}: {
	target: AuthorityPreviewTarget;
	onClose: () => void;
}) {
	const online = useOnlineState();
	const cancelRef = useRef<HTMLButtonElement>(null);
	const operationId = useRef(crypto.randomUUID());
	const journalSaveRef = useRef<Promise<void> | null>(null);
	const destinationInputId = useId();
	const workspaces = useQuery(
		api.sync.listWorkspaces,
		target.direction === "git-to-cloud" ? {} : "skip",
	);
	const [workspaceId, setWorkspaceId] = useState<string | null>(null);
	const selectedWorkspaceId =
		target.direction === "git-to-cloud"
			? (workspaceId ?? workspaces?.[0]?._id ?? null)
			: target.includeWorkspaceMembers
				? target.workspaceId
				: null;
	const members = useQuery(
		api.sync.listWorkspaceMembers,
		selectedWorkspaceId
			? { workspaceId: selectedWorkspaceId as Id<"workspaces"> }
			: "skip",
	);
	const subtree = useQuery(
		api.folders.listSubtree,
		target.direction === "cloud-to-git"
			? { folderId: target.folderId as Id<"folders"> }
			: "skip",
	);
	const shares = useQuery(
		api.folders.listFolderShares,
		target.direction === "cloud-to-git"
			? { folderId: target.folderId as Id<"folders"> }
			: "skip",
	);
	const [repositoryPath, setRepositoryPath] = useState<string | null>(null);
	const [relativePath, setRelativePath] = useState(() =>
		safeGitFolderName(target.name),
	);
	const [inspection, setInspection] = useState<
		GitFolderInspection | GitDestinationInspection | null
	>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [stale, setStale] = useState(false);
	const [journaled, setJournaled] = useState(false);
	useEffect(() => {
		const focusTimer = window.setTimeout(
			() => cancelRef.current?.focus(),
			authorityPreviewFocusDelayMs,
		);
		return () => window.clearTimeout(focusTimer);
	}, []);

	const inspect = async () => {
		setLoading(true);
		setError(null);
		try {
			const next =
				target.direction === "git-to-cloud"
					? await desktopApi.inspectGitAuthorityFolder(target.folderPath)
					: repositoryPath
						? await desktopApi.inspectGitAuthorityDestination({
								repositoryPath,
								relativePath,
							})
						: null;
			if (next) {
				setStale(
					(wasStale) =>
						wasStale ||
						previewChanged(
							inspection?.previewFingerprint ?? null,
							next.previewFingerprint,
						),
				);
				setInspection(next);
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setLoading(false);
		}
	};

	// The target is immutable while this keyed modal is open; refreshes are explicit.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run one initial Git inspection per target
	useEffect(() => {
		if (target.direction === "git-to-cloud") void inspect();
	}, [target]);

	useEffect(() => {
		if (!inspection || journaled) return;
		if (target.direction === "git-to-cloud" && !selectedWorkspaceId) return;
		if (target.direction === "cloud-to-git" && !repositoryPath) return;
		const now = Date.now();
		const operation: AuthorityTransferOperation = {
			id: operationId.current,
			direction: target.direction,
			intent: target.intent,
			phase: "draft",
			source:
				target.direction === "git-to-cloud"
					? {
							kind: "git",
							repoRoot: (inspection as GitFolderInspection).repoRoot,
							relativePath: (inspection as GitFolderInspection).relativePath,
						}
					: {
							kind: "cloud",
							workspaceId: target.workspaceId,
							folderId: target.folderId,
						},
			destination:
				target.direction === "git-to-cloud"
					? {
							kind: "cloud",
							workspaceId: selectedWorkspaceId as string,
							parentFolderId: null,
						}
					: {
							kind: "git",
							repoRoot: (inspection as GitDestinationInspection).repoRoot,
							relativePath: (inspection as GitDestinationInspection)
								.relativePath,
						},
			manifestSummary:
				target.direction === "git-to-cloud"
					? (inspection as GitFolderInspection).manifest.summary
					: null,
			manifestHash:
				target.direction === "git-to-cloud"
					? (inspection as GitFolderInspection).manifest.manifestHash
					: null,
			previewFingerprint: inspection.previewFingerprint,
			lastError: null,
			createdAt: now,
			updatedAt: now,
		};
		const save = desktopApi
			.saveAuthorityTransferOperation(operation)
			.then(() => setJournaled(true))
			.catch((cause) =>
				setError(cause instanceof Error ? cause.message : String(cause)),
			);
		journalSaveRef.current = save;
	}, [inspection, journaled, repositoryPath, selectedWorkspaceId, target]);

	const cancel = () => {
		const save = journalSaveRef.current;
		if (save) {
			void save
				.then(() =>
					desktopApi.cancelAuthorityTransferOperation(operationId.current),
				)
				.catch(() => undefined);
		}
		onClose();
	};
	const chooseRepository = async () => {
		const selected = await desktopApi.createFolderPicker({
			title: "Choose a Git repository",
			create: false,
		});
		if (!selected) return;
		setRepositoryPath(selected);
		setInspection(null);
		setStale(false);
	};

	const sourceInspection =
		target.direction === "git-to-cloud"
			? (inspection as GitFolderInspection | null)
			: null;
	const destinationInspection =
		target.direction === "cloud-to-git"
			? (inspection as GitDestinationInspection | null)
			: null;
	const cloudItemCount = subtree
		? 1 + subtree.folders.length + subtree.documents.length
		: null;

	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) cancel();
			}}
			initialFocus={cancelRef}
			finalFocus={false}
			title={
				target.direction === "git-to-cloud"
					? `${target.intent === "share" ? "Share" : "Move"} “${target.name}” in Hubble Cloud`
					: `Move “${target.name}” to Git`
			}
			description="Preview only. Nothing is copied, deleted, shared, or made authoritative from this screen."
			className="max-w-xl"
		>
			<div className="flex flex-col gap-4 text-xs">
				{!online ? (
					<output className="rounded-sm border border-warning/40 bg-warning/10 p-3">
						You’re offline. Cloud audience data may be stale; reconnect and
						refresh before continuing.
					</output>
				) : null}
				{target.direction === "git-to-cloud" ? (
					<>
						<label className="flex flex-col gap-1.5 font-medium">
							<span>Destination</span>
							<select
								value={selectedWorkspaceId ?? ""}
								onChange={(event) => {
									setWorkspaceId(event.currentTarget.value);
									setJournaled(false);
								}}
								className="h-8 rounded-sm border border-input bg-background px-2"
							>
								{workspaces?.map((workspace) => (
									<option key={workspace._id} value={workspace._id}>
										{workspace.name} — Workspace root
									</option>
								))}
							</select>
							<span className="font-normal text-muted-foreground">
								The transactional prepare API will add nested cloud destinations
								in Milestone 3.
							</span>
						</label>
						<PreviewCard title="Content">
							{sourceInspection ? (
								<>
									<p className="break-all text-foreground">
										{sourceInspection.sourcePath}
									</p>
									<p>
										{sourceInspection.manifest.summary.markdownCount} Markdown
										files, {sourceInspection.manifest.summary.assetCount}{" "}
										assets, {sourceInspection.manifest.summary.folderCount}{" "}
										folders.
									</p>
									<p>
										{sourceInspection.manifest.summary.excludedCount} excluded;{" "}
										{sourceInspection.manifest.summary.blockingExclusionCount}{" "}
										block confirmation.
									</p>
									<p>
										{sourceInspection.workingTreeChanges.length} visible
										working-tree changes. Git history stays in the repository.
									</p>
									{sourceInspection.manifest.exclusions.length > 0 ? (
										<PreviewDetails label="Review exclusions">
											{sourceInspection.manifest.exclusions.map((item) => (
												<li key={`${item.relativePath}:${item.reason}`}>
													{item.relativePath || "."} — {item.reason}
													{item.blocking ? " (blocks confirmation)" : ""}
												</li>
											))}
										</PreviewDetails>
									) : null}
								</>
							) : (
								<p>Inspecting the selected Git folder…</p>
							)}
						</PreviewCard>
						<PreviewCard title="Audience">
							<p>
								{members
									? `${members.length} Workspace members will have inherited access at the root.`
									: "Loading the exact Workspace member list…"}
							</p>
							<p>No public link is introduced by this preview.</p>
							{members && members.length > 0 ? (
								<PreviewDetails label="Review people and roles">
									{members.map((member) => (
										<li key={member._id}>
											{member.user?.name ??
												member.user?.email ??
												"Unknown member"}{" "}
											— {member.role}
										</li>
									))}
								</PreviewDetails>
							) : null}
						</PreviewCard>
						<PreviewCard title="After a verified cutover">
							<p>
								{target.intent === "share"
									? "Sharing uses the same authority move; it never creates a hidden copy."
									: "The selected folder becomes available on the web with realtime collaboration."}
							</p>
							<p>
								Supported working files leave Git authority only after cloud
								verification. Hubble will not commit, push, alter remotes, or
								erase prior Git history.
							</p>
							<p>
								No replacement local path is selected in this inert preview; the
								transactional flow must offer an outside-repository projection
								before confirmation.
							</p>
						</PreviewCard>
					</>
				) : (
					<>
						<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
							<label
								htmlFor={destinationInputId}
								className="flex flex-col gap-1.5 font-medium"
							>
								<span>Git destination folder</span>
								<Input
									id={destinationInputId}
									value={relativePath}
									onChange={(event) => {
										setRelativePath(event.currentTarget.value);
										setInspection(null);
										setJournaled(false);
									}}
								/>
							</label>
							<Button
								type="button"
								variant="outline"
								className="self-end"
								onClick={() => void chooseRepository()}
							>
								<MingcuteFolderOpenLine />
								{repositoryPath ? "Change repository" : "Choose repository"}
							</Button>
						</div>
						{repositoryPath ? (
							<p className="break-all text-muted-foreground">
								{repositoryPath}
							</p>
						) : null}
						<PreviewCard title="Content and history">
							<p>
								{cloudItemCount === null
									? "Loading the cloud subtree…"
									: `${cloudItemCount} cloud items are inside this authority boundary.`}
							</p>
							<p>
								Cloud revision history remains recoverable in Hubble; exported
								files begin new Git history when committed.
							</p>
							{subtree ? (
								<PreviewDetails label="Review destination paths">
									{[
										...subtree.folders.map(
											(folder) => `${folder.relativePath}/`,
										),
										...subtree.documents.map((document) =>
											[
												document.relativePath,
												document.path ?? `${document.title}.md`,
											]
												.filter(Boolean)
												.join("/"),
										),
									].map((itemPath) => (
										<li key={itemPath}>{itemPath}</li>
									))}
								</PreviewDetails>
							) : null}
						</PreviewCard>
						<PreviewCard title="Audience consequence">
							<p>
								{target.includeWorkspaceMembers
									? members
										? `${members.length} Workspace members`
										: "Loading Workspace members"
									: "Shared-folder guests"}
								{shares ? ` and ${shares.length} direct folder shares` : ""}{" "}
								currently participate in cloud access.
							</p>
							{!target.includeWorkspaceMembers ? (
								<p>
									Inherited ancestor access requires Milestone 3’s authoritative
									prepare check, so confirmation remains blocked.
								</p>
							) : null}
							<p>
								Git collaborators replace cloud membership, realtime
								collaboration, and link access after cutover.
							</p>
							{members && members.length > 0 ? (
								<PreviewDetails label="Review Workspace members">
									{members.map((member) => (
										<li key={member._id}>
											{member.user?.name ??
												member.user?.email ??
												"Unknown member"}{" "}
											— {member.role}
										</li>
									))}
								</PreviewDetails>
							) : null}
							{shares && shares.length > 0 ? (
								<PreviewDetails label="Review direct shares and links">
									{shares.map((share) => (
										<li key={share._id}>
											{share.linkScope === "public"
												? "Anyone with the public link"
												: (share.user?.name ??
													share.user?.email ??
													"Unknown guest")}{" "}
											— {share.role}
										</li>
									))}
								</PreviewDetails>
							) : null}
						</PreviewCard>
						{destinationInspection ? (
							<PreviewCard title="Repository check">
								<p>
									{destinationInspection.repoName} ·{" "}
									{destinationInspection.collision === "occupied"
										? "Destination is occupied and blocks confirmation."
										: "Destination is empty."}
								</p>
								<p>
									{destinationInspection.workingTreeChanges.length} visible
									working-tree changes.
								</p>
								<p className="break-all">
									Resolved path: {destinationInspection.destinationPath}
								</p>
								<p>
									Repository remote metadata does not establish its audience.
									Review, commit, and push with normal Git tools after a
									verified cutover.
								</p>
								{destinationInspection.workingTreeChanges.length > 0 ? (
									<PreviewDetails label="Review working-tree changes">
										{destinationInspection.workingTreeChanges.map((change) => (
											<li key={`${change.status}:${change.path}`}>
												{change.status} {change.path}
											</li>
										))}
									</PreviewDetails>
								) : null}
							</PreviewCard>
						) : null}
					</>
				)}
				{stale ? (
					<output className="rounded-sm border border-warning/40 bg-warning/10 p-3">
						Preview changed; review again.
					</output>
				) : null}
				{error ? (
					<p
						role="alert"
						className="rounded-sm border border-destructive/40 bg-destructive/10 p-3"
					>
						{error}
					</p>
				) : null}
				<div className="flex items-center justify-between gap-3 border-t border-border [padding-block-start:0.75rem]">
					<p className="text-muted-foreground">
						Confirmation becomes available after Milestone 3 adds prepare,
						verify, and atomic cutover.
					</p>
					<div className="flex shrink-0 gap-2">
						<Button
							ref={cancelRef}
							type="button"
							variant="ghost"
							onClick={cancel}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={
								loading ||
								(target.direction === "cloud-to-git" && !repositoryPath)
							}
							onClick={() => void inspect()}
						>
							{loading ? "Inspecting…" : "Refresh preview"}
						</Button>
					</div>
				</div>
			</div>
		</Modal>
	);
}

function PreviewCard({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="flex flex-col gap-1 rounded-sm border border-border bg-muted/30 p-3">
			<h3 className="m-0 text-xs font-semibold">{title}</h3>
			<div className="flex flex-col gap-1 text-muted-foreground [&_p]:m-0">
				{children}
			</div>
		</section>
	);
}

function PreviewDetails({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<details className="[padding-block-start:0.25rem]">
			<summary className="cursor-pointer font-medium text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring">
				{label}
			</summary>
			<ul className="mb-0 flex max-h-32 flex-col gap-1 overflow-auto [padding-inline-start:1.25rem]">
				{children}
			</ul>
		</details>
	);
}
