export type LocalFile = {
	relativePath: string;
	content: string;
	hash: string;
};

export type LocalAsset = {
	relativePath: string;
	hash: string;
};

/** Platform-agnostic filesystem interface for sync operations */
export interface FileSystem {
	readFile(path: string): Promise<string>;
	writeFile(path: string, content: string): Promise<void>;
	deleteFile(path: string): Promise<void>;
	readFileOrNull(path: string): Promise<string | null>;
	ensureDir(path: string): Promise<void>;
	listMarkdownFiles(dir: string): Promise<LocalFile[]>;
	readBinaryFile(path: string): Promise<Uint8Array>;
	writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
	listAssetFiles(dir: string): Promise<LocalAsset[]>;
}

/** Isomorphic SHA-256 using Web Crypto API (works in browser + Node 20+) */
export async function contentHash(content: string): Promise<string> {
	const data = new TextEncoder().encode(content);
	const hash = await crypto.subtle.digest("SHA-256", data);
	const bytes = new Uint8Array(hash);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function binaryContentHash(data: Uint8Array): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", data);
	const bytes = new Uint8Array(hash);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
