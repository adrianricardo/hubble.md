import { describe, expect, it } from "vitest";
import {
	applyTrackedMarkdownEdit,
	buildTrackedMarkdownSnapshot,
	createTrackedMarkdownDocument,
	updateTrackedMarkdownDocument,
} from "./AgentBlockEditing";

describe("tracked markdown document", () => {
	it("creates and updates revision/hash metadata", () => {
		const initial = createTrackedMarkdownDocument({
			path: "/tmp/example.md",
			markdown: "# Title\n\nHello.",
			updatedAt: "2026-03-19T00:00:00.000Z",
		});

		expect(initial.revision).toBe(1);
		expect(initial.contentHash.length).toBeGreaterThan(0);

		const unchanged = updateTrackedMarkdownDocument(initial, {
			path: "/tmp/example.md",
			markdown: "# Title\n\nHello.",
			updatedAt: "2026-03-19T01:00:00.000Z",
		});
		expect(unchanged).toEqual(initial);

		const changed = updateTrackedMarkdownDocument(initial, {
			path: "/tmp/example.md",
			markdown: "# Title\n\nHello there.",
			updatedAt: "2026-03-19T01:00:00.000Z",
		});
		expect(changed.revision).toBe(2);
		expect(changed.updatedAt).toBe("2026-03-19T01:00:00.000Z");

		const newPath = updateTrackedMarkdownDocument(changed, {
			path: "/tmp/other.md",
			markdown: "Fresh file",
			updatedAt: "2026-03-19T02:00:00.000Z",
		});
		expect(newPath.revision).toBe(1);
		expect(newPath.path).toBe("/tmp/other.md");
	});
});

describe("tracked markdown snapshot", () => {
	it("builds top-level block refs from markdown", () => {
		const document = createTrackedMarkdownDocument({
			path: "/tmp/example.md",
			markdown: "# Title\n\nFirst paragraph.\n\n- item 1\n- item 2",
		});

		const snapshot = buildTrackedMarkdownSnapshot(document);
		expect(snapshot.blocks).toEqual([
			{
				ref: "b1",
				type: "heading",
				markdown: "# Title",
				textPreview: "Title",
				level: 1,
			},
			{
				ref: "b2",
				type: "paragraph",
				markdown: "First paragraph.",
				textPreview: "First paragraph.",
			},
			{
				ref: "b3",
				type: "bulletList",
				markdown: "- item 1\n- item 2",
				textPreview: "item 1item 2",
			},
		]);
	});
});

describe("tracked markdown edit", () => {
	it("applies block operations and returns the next snapshot", () => {
		const current = createTrackedMarkdownDocument({
			path: "/tmp/example.md",
			markdown: "# Title\n\nFirst paragraph.\n\nSecond paragraph.",
			updatedAt: "2026-03-19T00:00:00.000Z",
		});

		const result = applyTrackedMarkdownEdit(current, {
			baseRevision: 1,
			updatedAt: "2026-03-19T01:00:00.000Z",
			operations: [
				{
					op: "replace_block",
					ref: "b2",
					block: { markdown: "Updated paragraph." },
				},
				{
					op: "insert_after",
					ref: "b2",
					blocks: [{ markdown: "Inserted paragraph." }],
				},
				{
					op: "find_replace_in_block",
					ref: "b3",
					find: "Second",
					replace: "Final",
					occurrence: "first",
				},
			],
		});

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}

		expect(result.nextState.revision).toBe(2);
		expect(result.nextState.markdown).toBe(
			"# Title\n\nUpdated paragraph.\n\nInserted paragraph.\n\nFinal paragraph.",
		);
		expect(result.snapshot.blocks.map((block) => block.ref)).toEqual([
			"b1",
			"b2",
			"b3",
			"b4",
		]);
		expect(result.snapshot.blocks[2]?.markdown).toBe("Inserted paragraph.");
	});

	it("supports delete, replace_range, and stale revision errors", () => {
		const current = createTrackedMarkdownDocument({
			path: "/tmp/example.md",
			markdown: "One.\n\nTwo.\n\nThree.\n\nFour.",
		});

		const edited = applyTrackedMarkdownEdit(current, {
			baseRevision: 1,
			operations: [
				{ op: "delete_block", ref: "b2" },
				{
					op: "replace_range",
					fromRef: "b3",
					toRef: "b4",
					blocks: [{ markdown: "Tail." }],
				},
			],
		});

		expect(edited.success).toBe(true);
		if (!edited.success) {
			return;
		}
		expect(edited.nextState.markdown).toBe("One.\n\nTail.");

		const stale = applyTrackedMarkdownEdit(edited.nextState, {
			baseRevision: 1,
			operations: [{ op: "delete_block", ref: "b1" }],
		});
		expect(stale.success).toBe(false);
		if (stale.success) {
			return;
		}
		expect(stale.code).toBe("STALE_REVISION");
		expect(stale.snapshot.revision).toBe(edited.nextState.revision);
	});

	it("rejects invalid refs, multi-block replacements, and missing find text", () => {
		const current = createTrackedMarkdownDocument({
			path: "/tmp/example.md",
			markdown: "# Title\n\nParagraph.",
		});

		const invalidRef = applyTrackedMarkdownEdit(current, {
			baseRevision: 1,
			operations: [{ op: "delete_block", ref: "b99" }],
		});
		expect(invalidRef.success).toBe(false);
		if (!invalidRef.success) {
			expect(invalidRef.code).toBe("INVALID_REF");
		}

		const invalidBlock = applyTrackedMarkdownEdit(current, {
			baseRevision: 1,
			operations: [
				{
					op: "replace_block",
					ref: "b2",
					block: { markdown: "One.\n\nTwo." },
				},
			],
		});
		expect(invalidBlock.success).toBe(false);
		if (!invalidBlock.success) {
			expect(invalidBlock.code).toBe("INVALID_BLOCK_MARKDOWN");
		}

		const missingFind = applyTrackedMarkdownEdit(current, {
			baseRevision: 1,
			operations: [
				{
					op: "find_replace_in_block",
					ref: "b2",
					find: "Missing",
					replace: "Found",
				},
			],
		});
		expect(missingFind.success).toBe(false);
		if (!missingFind.success) {
			expect(missingFind.code).toBe("FIND_NOT_FOUND");
		}
	});
});
