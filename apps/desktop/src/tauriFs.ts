import { invoke } from "@tauri-apps/api/core";
import { contentHash, type FileSystem, type LocalFile } from "@hubble.md/sync";

type TauriFileEntry = {
	path: string;
	modified_at: number;
};

export function createTauriFileSystem(): FileSystem {
	return {
		async readFile(path) {
			return invoke<string>("read_file_text", { path });
		},
		async writeFile(path, content) {
			await invoke("write_file_text", { path, content });
		},
		async readFileOrNull(path) {
			try {
				return await invoke<string>("read_file_text", { path });
			} catch {
				return null;
			}
		},
		async ensureDir(path) {
			await invoke("ensure_directory", { path });
		},
		async listMarkdownFiles(dir) {
			const entries = await invoke<TauriFileEntry[]>("list_directory", {
				path: dir,
			});
			const results: LocalFile[] = [];
			for (const entry of entries) {
				const content = await invoke<string>("read_file_text", {
					path: entry.path,
				});
				const prefix = dir.endsWith("/") ? dir : `${dir}/`;
				const relativePath = entry.path.startsWith(prefix)
					? entry.path.slice(prefix.length)
					: entry.path;
				results.push({
					relativePath,
					content,
					hash: await contentHash(content),
				});
			}
			return results;
		},
	};
}
