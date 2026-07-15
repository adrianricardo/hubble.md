export function safeGitFolderName(name: string): string {
	const normalized = name
		.normalize("NFKD")
		.replace(/[^a-zA-Z0-9._ -]/g, "")
		.trim()
		.replace(/\s+/g, "-");
	return normalized || "hubble-folder";
}

export function displayFolderName(folderId: string): string {
	const normalized = folderId.replace(/\/+$/, "");
	return normalized.split("/").pop() || normalized || folderId;
}

export function previewChanged(
	previousFingerprint: string | null,
	nextFingerprint: string,
): boolean {
	return (
		previousFingerprint !== null && previousFingerprint !== nextFingerprint
	);
}

export function canConfirmGitToCloud(input: {
	online: boolean;
	journaled: boolean;
	hasInspection: boolean;
	confirmationBlocked: boolean;
	hasWorkspace: boolean;
	membersLoaded: boolean;
	authReady: boolean;
	stale: boolean;
	busy: boolean;
}): boolean {
	return (
		input.online &&
		input.journaled &&
		input.hasInspection &&
		!input.confirmationBlocked &&
		input.hasWorkspace &&
		input.membersLoaded &&
		input.authReady &&
		!input.stale &&
		!input.busy
	);
}
