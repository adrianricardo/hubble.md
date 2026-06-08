import { describe, expect, it } from "vitest";
import { markdownToTiptapDoc } from "./markdownToProsemirror";
import { tiptapDocToMarkdown } from "./prosemirrorToMarkdown";

describe("embed markdown conversion", () => {
	it("parses an embed custom element into an embed node", () => {
		const doc = markdownToTiptapDoc(
			'# Roadmap\n\n<embed-kanban board="roadmap"></embed-kanban>',
		);

		expect(doc.content?.[1]).toEqual({
			type: "embed",
			attrs: {
				name: "kanban",
				tagName: "embed-kanban",
				props: {
					board: "roadmap",
				},
			},
		});
	});

	it("does not parse a nested embed element as an embed node", () => {
		const doc = markdownToTiptapDoc("<div><embed-kanban></embed-kanban></div>");

		expect(doc.content?.[0]?.type).toBe("paragraph");
		expect(doc.content?.[0]?.content?.[0]?.text).toBe(
			"<div><embed-kanban></embed-kanban></div>",
		);
	});

	it("does not parse embed HTML with sibling content as an embed node", () => {
		const doc = markdownToTiptapDoc(
			"<embed-kanban></embed-kanban><p>Keep me</p>",
		);

		expect(doc.content?.[0]?.type).toBe("paragraph");
		expect(doc.content?.some((node) => node.type === "embed")).toBe(false);
	});

	it("serializes an embed node back to custom element syntax", () => {
		const markdown = tiptapDocToMarkdown({
			type: "doc",
			content: [
				{
					type: "embed",
					attrs: {
						name: "kanban",
						tagName: "embed-kanban",
						props: {
							board: "roadmap",
						},
					},
				},
			],
		});

		expect(markdown).toBe('<embed-kanban board="roadmap"></embed-kanban>');
	});
});
