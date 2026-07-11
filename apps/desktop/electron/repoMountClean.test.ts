import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { contentHash, SYNCED_FOLDER_INDEX_REL } from "@hubble.md/sync";
import { afterEach, describe, expect, it } from "vitest";
import { isMountClean } from "./repoMountClean";

const tempDirs: string[] = [];

async function tempMount(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hubble-mount-clean-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	for (const dir of tempDirs.splice(0)) {
		await fs.rm(dir, { recursive: true, force: true });
	}
});

describe("isMountClean", () => {
	it("returns true when indexed files match and only state files are extra", async () => {
		const mount = await tempMount();
		const docPath = path.join(mount, "Doc.md");
		await fs.writeFile(docPath, "hello");
		await writeIndex(mount, {
			[docPath]: {
				documentId: "d1",
				workspaceId: "w1",
				folderId: "f1",
				inode: null,
				hash: await contentHash("hello"),
				role: "editor",
			},
		});

		expect(await isMountClean(mount)).toBe(true);
	});

	it("returns false when an indexed file has local edits", async () => {
		const mount = await tempMount();
		const docPath = path.join(mount, "Doc.md");
		await fs.writeFile(docPath, "hello");
		await writeIndex(mount, {
			[docPath]: {
				documentId: "d1",
				workspaceId: "w1",
				folderId: "f1",
				inode: null,
				hash: await contentHash("hello"),
				role: "editor",
			},
		});
		await fs.writeFile(docPath, "local edit");

		expect(await isMountClean(mount)).toBe(false);
	});

	it("returns false when an untracked file exists outside .hubble state", async () => {
		const mount = await tempMount();
		const docPath = path.join(mount, "Doc.md");
		await fs.writeFile(docPath, "hello");
		await writeIndex(mount, {
			[docPath]: {
				documentId: "d1",
				workspaceId: "w1",
				folderId: "f1",
				inode: null,
				hash: await contentHash("hello"),
				role: "editor",
			},
		});
		await fs.writeFile(path.join(mount, "scratch.md"), "new");

		expect(await isMountClean(mount)).toBe(false);
	});
});

async function writeIndex(
	mount: string,
	index: Record<string, unknown>,
): Promise<void> {
	const indexPath = path.join(mount, ...SYNCED_FOLDER_INDEX_REL.split("/"));
	await fs.mkdir(path.dirname(indexPath), { recursive: true });
	await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
	await fs.writeFile(path.join(mount, ".hubble", "state.json"), "{}");
}
