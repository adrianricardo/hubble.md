/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
	return t.withIdentity({ subject: `${userId}|session` });
}

// A document whose workspace owner is `ownerId`, so requireDocumentOwner passes
// for that user (workspace ownership confers the document "owner" role).
async function setupOwnedDocument(t: ReturnType<typeof convexTest>) {
	const ownerId = await t.run((ctx) =>
		ctx.db.insert("users", { email: "owner@example.com", name: "Owner" }),
	);
	const documentId = await t.run(async (ctx) => {
		const workspaceId = await ctx.db.insert("workspaces", {
			name: "Team",
			ownerId,
			createdAt: Date.now(),
		});
		return ctx.db.insert("documents", {
			workspaceId,
			title: "Doc",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
	});
	return { ownerId, documentId };
}

describe("setUserShareByEmail", () => {
	test("known email creates a docShares row", async () => {
		const t = convexTest(schema, modules);
		const { ownerId, documentId } = await setupOwnedDocument(t);
		const targetId = await t.run((ctx) =>
			ctx.db.insert("users", { email: "target@example.com" }),
		);

		const result = await asUser(t, ownerId).mutation(
			api.documents.setUserShareByEmail,
			{ documentId, email: "Target@example.com", role: "editor" },
		);
		expect(result).toEqual({ status: "shared", userId: targetId });

		const share = await t.run((ctx) =>
			ctx.db
				.query("docShares")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", documentId).eq("userId", targetId),
				)
				.unique(),
		);
		expect(share?.role).toBe("editor");
	});

	test("unknown email creates a document invite without throwing", async () => {
		const t = convexTest(schema, modules);
		const { ownerId, documentId } = await setupOwnedDocument(t);

		const result = await asUser(t, ownerId).mutation(
			api.documents.setUserShareByEmail,
			{ documentId, email: "ghost@example.com", role: "viewer" },
		);
		expect(result).toEqual({ status: "invited", userId: null });

		const invites = await t.run((ctx) => ctx.db.query("invites").collect());
		expect(invites).toHaveLength(1);
		expect(invites[0]).toMatchObject({
			email: "ghost@example.com",
			documentId,
			documentRole: "viewer",
		});
		const shares = await t.run((ctx) => ctx.db.query("docShares").collect());
		expect(shares).toHaveLength(0);
	});
});
