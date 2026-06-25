#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import chokidar from "chokidar";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../packages/sync-backend/convex/_generated/api.js";

const DEFAULT_URL = "http://127.0.0.1:3210";
const DEFAULT_FILE = "realtime-poc.md";

function parseArgs(argv) {
	const parsed = {
		url:
			process.env.CONVEX_URL ?? process.env.VITE_TEST_CONVEX_URL ?? DEFAULT_URL,
		file: DEFAULT_FILE,
		actor: "file-reconcile-poc",
		initFromLive: false,
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
			case "--id":
				parsed.documentId = next();
				break;
			case "--url":
				parsed.url = next();
				break;
			case "--file":
				parsed.file = next();
				break;
			case "--actor":
				parsed.actor = next();
				break;
			case "--init-from-live":
				parsed.initFromLive = true;
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
  node scripts/reconcile-poc.mjs --id <documentId> [--file realtime-poc.md] [--url http://127.0.0.1:3210]

Options:
  --id              Stable Live Document id from Convex documents table.
  --file            One markdown file to watch. Defaults to ${DEFAULT_FILE}.
  --url             Convex deployment URL. Defaults to CONVEX_URL, VITE_TEST_CONVEX_URL, or ${DEFAULT_URL}.
  --actor           Actor metadata for the POC transform. Defaults to file-reconcile-poc.
  --init-from-live  Overwrite the watched file with the current live markdown before watching.
`);
}

function changedRange(baseMarkdown, nextMarkdown) {
	let from = 0;
	while (
		from < baseMarkdown.length &&
		from < nextMarkdown.length &&
		baseMarkdown[from] === nextMarkdown[from]
	) {
		from += 1;
	}

	let baseTo = baseMarkdown.length;
	let nextTo = nextMarkdown.length;
	while (
		baseTo > from &&
		nextTo > from &&
		baseMarkdown[baseTo - 1] === nextMarkdown[nextTo - 1]
	) {
		baseTo -= 1;
		nextTo -= 1;
	}

	if (from === baseMarkdown.length && from === nextMarkdown.length) return null;
	return {
		from,
		to: baseTo,
		markdown: nextMarkdown.slice(from, nextTo),
	};
}

async function getLiveDocument(client, documentId) {
	const document = await client.query(api.documents.getForAgent, {
		documentId,
	});
	if (!document) throw new Error(`Live Document not found: ${documentId}`);
	return document;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		return;
	}
	if (!args.documentId) {
		throw new Error("Missing required --id documentId");
	}

	const client = new ConvexHttpClient(args.url);
	const filePath = resolve(args.file);
	const live = await getLiveDocument(client, args.documentId);
	const syncDocId = `document:${args.documentId}`;

	await mkdir(dirname(filePath), { recursive: true });
	if (args.initFromLive || !existsSync(filePath)) {
		await writeFile(filePath, live.markdown);
	}

	let baseMarkdown = await readFile(filePath, "utf8");
	if (baseMarkdown !== live.markdown) {
		console.warn(
			"Watched file differs from live markdown at startup. For the cleanest POC, rerun with --init-from-live.",
		);
	}

	let projecting = false;
	let timer = null;

	const applyExternalSave = async () => {
		const nextMarkdown = await readFile(filePath, "utf8");
		if (projecting && nextMarkdown === baseMarkdown) return;

		const range = changedRange(baseMarkdown, nextMarkdown);
		if (!range) {
			console.log("no-op save: markdown unchanged");
			return;
		}

		const startedAt = Date.now();
		const result = await client.mutation(
			api.prosemirror.reconcileMarkdownRangePoc,
			{
				docId: syncDocId,
				baseMarkdown,
				from: range.from,
				to: range.to,
				markdown: range.markdown,
				actor: args.actor,
			},
		);
		const elapsed = Date.now() - startedAt;
		baseMarkdown = result.markdown;

		projecting = true;
		await writeFile(filePath, baseMarkdown);
		queueMicrotask(() => {
			projecting = false;
		});

		console.log(
			`reconciled ${range.to - range.from} base chars -> ${range.markdown.length} new chars in ${elapsed}ms`,
		);
	};

	console.log(`Watching ${filePath}`);
	console.log(`Convex: ${args.url}`);
	console.log(`Live Document: ${args.documentId}`);
	console.log(
		"Save the watched file while editing the same document in the browser.",
	);

	const watcher = chokidar.watch(filePath, { ignoreInitial: true });
	watcher.on("change", () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			void applyExternalSave().catch((err) => {
				console.error("reconcile failed:", err);
			});
		}, 250);
	});

	const shutdown = async (signal) => {
		if (timer) clearTimeout(timer);
		await watcher.close();
		console.log(`Stopped reconcile POC (${signal})`);
		process.exit(0);
	};
	process.on("SIGINT", () => {
		void shutdown("SIGINT");
	});
	process.on("SIGTERM", () => {
		void shutdown("SIGTERM");
	});
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
