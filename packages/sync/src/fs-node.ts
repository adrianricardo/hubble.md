import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import {
	contentHash,
	type FileSystem,
	type LocalAsset,
	type LocalFile,
} from "./fs.js";

const MD_EXTENSIONS = new Set(["md", "markdown", "mdown"]);
const IMAGE_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"bmp",
	"svg",
	"webp",
]);
const MAX_ASSET_SIZE = 10 * 1024 * 1024; // 10 MB

export function createNodeFileSystem(): FileSystem {
	return {
		async readFile(path) {
			return readFileSync(path, "utf-8");
		},
		async writeFile(path, content) {
			writeFileSync(path, content);
		},
		async deleteFile(path) {
			unlinkSync(path);
		},
		async readFileOrNull(path) {
			return existsSync(path) ? readFileSync(path, "utf-8") : null;
		},
		async ensureDir(path) {
			mkdirSync(path, { recursive: true });
		},
		async listMarkdownFiles(dir) {
			const results: LocalFile[] = [];
			await walkMarkdown(dir, dir, results);
			return results;
		},
		async readBinaryFile(path) {
			return new Uint8Array(readFileSync(path));
		},
		async writeBinaryFile(path, data) {
			writeFileSync(path, data);
		},
		async listAssetFiles(dir) {
			const results: LocalAsset[] = [];
			await walkAssets(dir, dir, results);
			return results;
		},
	};
}

async function walkMarkdown(
	root: string,
	dir: string,
	out: LocalFile[],
): Promise<void> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			await walkMarkdown(root, full, out);
		} else {
			const ext = entry.name.split(".").pop()?.toLowerCase();
			if (ext && MD_EXTENSIONS.has(ext)) {
				const content = readFileSync(full, "utf-8");
				out.push({
					relativePath: relative(root, full),
					content,
					hash: await contentHash(content),
				});
			}
		}
	}
}

async function walkAssets(
	root: string,
	dir: string,
	out: LocalAsset[],
): Promise<void> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			await walkAssets(root, full, out);
		} else {
			const ext = entry.name.split(".").pop()?.toLowerCase();
			if (!ext || !IMAGE_EXTENSIONS.has(ext)) continue;
			const size = statSync(full).size;
			if (size > MAX_ASSET_SIZE) continue;
			const data = readFileSync(full);
			out.push({
				relativePath: relative(root, full),
				hash: await contentHash(new Uint8Array(data)),
			});
		}
	}
}
