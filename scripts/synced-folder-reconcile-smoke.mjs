#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createConvexBackend } from "../packages/convex-client/dist/index.js";
import { createNodeFileSystem } from "../packages/sync/dist/fs-node.js";
import {
	reconcileProjectionFile,
	writeReconcileBase,
} from "../packages/sync/dist/index.js";

const DEFAULT_WORKSPACE_NAME = "Synced Folder Smoke";

function parseArgs(argv) {
	const parsed = {
		url: process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? "",
		authToken: process.env.AUTH_TOKEN ?? process.env.CONVEX_AUTH_TOKEN ?? "",
		workspaceId: process.env.WORKSPACE_ID ?? "",
		workspaceName: process.env.WORKSPACE_NAME ?? DEFAULT_WORKSPACE_NAME,
		syncRoot:
			process.env.SYNC_ROOT ?? join(tmpdir(), "hubble-synced-folder-smoke"),
		actor: process.env.ACTOR ?? "synced-folder-reconcile-smoke",
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = () => {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`Missing value for ${arg}`);
			}
			index += 1;
			return value;
		};

		switch (arg) {
			case "--url":
				parsed.url = next();
				break;
			case "--auth-token":
				parsed.authToken = next();
				break;
			case "--workspace-id":
				parsed.workspaceId = next();
				break;
			case "--workspace-name":
				parsed.workspaceName = next();
				break;
			case "--sync-root":
				parsed.syncRoot = next();
				break;
			case "--actor":
				parsed.actor = next();
				break;
			case "--help":
			case "-h":
				parsed.help = true;
				break;
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return parsed;
}

function printHelp() {
	console.log(`Usage:
  CONVEX_URL=<url> AUTH_TOKEN=<jwt> node scripts/synced-folder-reconcile-smoke.mjs

Options:
  --url             Convex deployment URL. Defaults to CONVEX_URL or VITE_CONVEX_URL.
  --auth-token      Convex Auth JWT. Defaults to AUTH_TOKEN or CONVEX_AUTH_TOKEN.
  --workspace-id    Existing workspace id to seed into.
  --workspace-name  Workspace to create/reuse when --workspace-id is omitted.
                    Defaults to "${DEFAULT_WORKSPACE_NAME}".
  --sync-root       Local scratch root. Defaults to os.tmpdir()/hubble-synced-folder-smoke.
  --actor           Actor metadata for import/reconcile.

This is a package-level smoke. It bypasses desktop watcher, IPC, Settings, and
folder picker code.
`);
}

function requireInput(value, name) {
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

async function resolveWorkspaceId(backend, args) {
	if (args.workspaceId) return args.workspaceId;
	const existing = await backend.getWorkspace(args.workspaceName);
	if (existing) return existing;
	return backend.createWorkspace(args.workspaceName);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		return;
	}

	const url = requireInput(args.url, "CONVEX_URL");
	const authToken = requireInput(args.authToken, "AUTH_TOKEN");
	const syncRoot = resolve(args.syncRoot);
	const backend = createConvexBackend(url, authToken);
	const fs = createNodeFileSystem();
	const workspaceId = await resolveWorkspaceId(backend, args);
	const stamp = new Date()
		.toISOString()
		.replace(/[-:T.Z]/g, "")
		.slice(0, 14);
	const docPath = `Smoke Tests/reconcile-${stamp}.md`;
	const title = basename(docPath, ".md");
	const initialMarkdown = `# ${title}\n\nInitial smoke content.\n`;
	const editMarker = `\nDisk edit ${stamp}.\n`;

	const imported = await backend.importLiveDocument({
		workspaceId,
		path: docPath,
		title,
		markdown: initialMarkdown,
		actor: args.actor,
	});

	const document = await backend.getDocumentForAgent(imported.documentId);
	if (!document) {
		throw new Error(
			`Imported document could not be read: ${imported.documentId}`,
		);
	}
	if (!document.canWrite) {
		throw new Error(
			`Imported document is not writable: ${imported.documentId}`,
		);
	}

	const projectionPath = join(syncRoot, docPath);
	await mkdir(dirname(projectionPath), { recursive: true });
	await writeFile(projectionPath, document.markdown);
	await writeReconcileBase(fs, syncRoot, document.documentId, {
		markdown: document.markdown,
		revision: document.revision,
		path: docPath,
	});

	await writeFile(projectionPath, `${document.markdown}${editMarker}`);
	const outcome = await reconcileProjectionFile(backend, fs, {
		documentId: document.documentId,
		projectionPath,
		workspacePath: syncRoot,
		actor: args.actor,
		path: docPath,
	});

	if (outcome.status !== "reconciled") {
		throw new Error(`Expected reconciled outcome, got ${outcome.status}`);
	}
	if (outcome.revision <= document.revision) {
		throw new Error(
			`Expected revision to advance past ${document.revision}, got ${outcome.revision}`,
		);
	}

	const refreshed = await backend.getDocumentForAgent(document.documentId);
	if (!refreshed?.markdown.includes(editMarker.trim())) {
		throw new Error("Cloud document did not include the reconciled disk edit");
	}

	console.log("Synced-folder reconcile smoke passed");
	console.log(`Convex: ${url}`);
	console.log(`Workspace: ${workspaceId}`);
	console.log(`Document: ${document.documentId}`);
	console.log(`Projection: ${projectionPath}`);
	console.log(`Revision: ${document.revision} -> ${outcome.revision}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
