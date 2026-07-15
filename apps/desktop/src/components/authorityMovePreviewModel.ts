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
