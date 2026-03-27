import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { loadPath } from "./store";
import { refreshFiles, workspaceStore } from "./workspaceStore";

export async function createNote() {
	const ws = workspaceStore.get().workspacePath;
	if (!ws) return;
	const picked = await save({
		defaultPath: ws,
		title: "New Markdown file",
		filters: [{ name: "Markdown", extensions: ["md"] }],
	});
	if (typeof picked !== "string") return;
	const path = picked.endsWith(".md") ? picked : `${picked}.md`;
	await invoke("write_file_text", { path, content: "" });
	await refreshFiles();
	await loadPath(path);
}
