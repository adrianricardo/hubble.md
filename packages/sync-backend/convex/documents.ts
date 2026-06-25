import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import {
	getHubbleEditorSchema,
	markdownToTiptapDoc,
	tiptapDocToMarkdown,
} from "@hubble.md/editor";
import { Step, Transform } from "@tiptap/pm/transform";
import { v } from "convex/values";
import { components } from "./_generated/api";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { currentActorName } from "./authIdentity";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

function normalizeTitle(title: string): string {
	const trimmed = title.trim();
	if (!trimmed) throw new Error("Document title is required");
	return trimmed;
}

function syncDocumentId(documentId: string): string {
	return `document:${documentId}`;
}

async function replaceLiveDocumentMarkdown(
	ctx: MutationCtx,
	documentId: string,
	markdown: string,
) {
	const schema = getHubbleEditorSchema();
	const id = syncDocumentId(documentId);
	const nextDoc = schema.nodeFromJSON(markdownToTiptapDoc(markdown));
	const snapshot = (await ctx.runQuery(
		components.prosemirrorSync.lib.getSnapshot,
		{ id },
	)) as { content: string | null; version?: number };

	if (!snapshot.content) {
		await prosemirrorSync.create(ctx, id, nextDoc.toJSON());
		return;
	}

	await prosemirrorSync.transform(
		ctx,
		id,
		schema,
		(doc) => {
			if (doc.eq(nextDoc)) return null;
			const tr = new Transform(doc);
			tr.replaceWith(0, doc.content.size, nextDoc.content);
			return tr;
		},
		{ clientId: "import" },
	);
}

async function projectMarkdown(
	ctx: QueryCtx,
	documentId: string,
): Promise<{ markdown: string; version: number | null }> {
	const schema = getHubbleEditorSchema();
	const id = syncDocumentId(documentId);
	const snapshot = (await ctx.runQuery(
		components.prosemirrorSync.lib.getSnapshot,
		{ id },
	)) as { content: string | null; version?: number };
	if (!snapshot.content || snapshot.version === undefined) {
		// A document row can exist before the editor creates its first live
		// ProseMirror snapshot; read projection should stay empty, not fail.
		return { markdown: "", version: null };
	}
	const transform = new Transform(
		schema.nodeFromJSON(JSON.parse(snapshot.content)),
	);
	const latest = (await ctx.runQuery(components.prosemirrorSync.lib.getSteps, {
		id,
		version: snapshot.version,
	})) as { steps: string[]; version: number };
	for (const step of latest.steps) {
		transform.step(Step.fromJSON(schema, JSON.parse(step)));
	}
	return {
		markdown: tiptapDocToMarkdown(transform.doc.toJSON()),
		version: latest.version,
	};
}

export const list = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
			.collect();
		return documents
			.filter((document) => document.deletedAt === undefined)
			.sort((a, b) => b.updatedAt - a.updatedAt);
	},
});

export const get = query({
	args: { documentId: v.id("documents") },
	handler: async (ctx, { documentId }) => {
		const document = await ctx.db.get(documentId);
		if (!document || document.deletedAt !== undefined) return null;
		return document;
	},
});

export const getWithMarkdown = query({
	args: { documentId: v.id("documents") },
	handler: async (ctx, { documentId }) => {
		const document = await ctx.db.get(documentId);
		if (!document || document.deletedAt !== undefined) return null;
		const projection = await projectMarkdown(ctx, documentId);
		return {
			...document,
			markdown: projection.markdown,
			version: projection.version,
		};
	},
});

export const listWithMarkdown = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
			.collect();
		const activeDocuments = documents
			.filter((document) => document.deletedAt === undefined)
			.sort((a, b) => b.updatedAt - a.updatedAt);
		return Promise.all(
			activeDocuments.map(async (document) => {
				const projection = await projectMarkdown(ctx, document._id);
				return {
					...document,
					markdown: projection.markdown,
					version: projection.version,
				};
			}),
		);
	},
});

export const create = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		title: v.string(),
		path: v.optional(v.string()),
		actor: v.optional(v.string()),
	},
	handler: async (ctx, { workspaceId, title, path, actor }) => {
		const now = Date.now();
		const resolvedActor = await currentActorName(ctx, actor);
		return ctx.db.insert("documents", {
			workspaceId,
			title: normalizeTitle(title),
			path: path?.trim() || undefined,
			createdBy: resolvedActor,
			createdAt: now,
			updatedBy: resolvedActor,
			updatedAt: now,
		});
	},
});

export const importMarkdown = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		path: v.string(),
		title: v.string(),
		markdown: v.string(),
		actor: v.optional(v.string()),
	},
	handler: async (ctx, { workspaceId, path, title, markdown, actor }) => {
		const resolvedActor = await currentActorName(ctx, actor);
		const normalizedTitle = normalizeTitle(title);
		const normalizedPath = path.trim();
		if (!normalizedPath) throw new Error("Document path is required");
		const pathMatches = await ctx.db
			.query("documents")
			.withIndex("by_workspace_path", (q) =>
				q.eq("workspaceId", workspaceId).eq("path", normalizedPath),
			)
			.collect();
		const existing = pathMatches.find(
			(document) => document.deletedAt === undefined,
		);
		const now = Date.now();
		const documentId = existing
			? existing._id
			: await ctx.db.insert("documents", {
					workspaceId,
					title: normalizedTitle,
					path: normalizedPath,
					createdBy: resolvedActor,
					createdAt: now,
					updatedBy: resolvedActor,
					updatedAt: now,
				});
		if (existing) {
			await ctx.db.patch(documentId, {
				title: normalizedTitle,
				path: normalizedPath,
				updatedBy: resolvedActor,
				updatedAt: now,
			});
		}
		await replaceLiveDocumentMarkdown(ctx, documentId, markdown);
		return {
			documentId,
			path: normalizedPath,
			title: normalizedTitle,
			created: !existing,
		};
	},
});

export const markEdited = mutation({
	args: {
		documentId: v.id("documents"),
		actor: v.optional(v.string()),
	},
	handler: async (ctx, { documentId, actor }) => {
		const document = await ctx.db.get(documentId);
		if (!document || document.deletedAt !== undefined) return;
		const resolvedActor = await currentActorName(ctx, actor);
		await ctx.db.patch(documentId, {
			updatedBy: resolvedActor,
			updatedAt: Date.now(),
		});
	},
});

export const rename = mutation({
	args: {
		documentId: v.id("documents"),
		title: v.string(),
		path: v.optional(v.string()),
		actor: v.optional(v.string()),
	},
	handler: async (ctx, { documentId, title, path, actor }) => {
		const document = await ctx.db.get(documentId);
		if (!document || document.deletedAt !== undefined) {
			throw new Error("Document not found");
		}
		const resolvedActor = await currentActorName(ctx, actor);
		await ctx.db.patch(documentId, {
			title: normalizeTitle(title),
			path: path?.trim() || undefined,
			updatedBy: resolvedActor,
			updatedAt: Date.now(),
		});
	},
});

export const remove = mutation({
	args: {
		documentId: v.id("documents"),
		actor: v.optional(v.string()),
	},
	handler: async (ctx, { documentId, actor }) => {
		const document = await ctx.db.get(documentId);
		if (!document || document.deletedAt !== undefined) return;
		const now = Date.now();
		const resolvedActor = await currentActorName(ctx, actor);
		await ctx.db.patch(documentId, {
			deletedAt: now,
			updatedBy: resolvedActor,
			updatedAt: now,
		});
	},
});
