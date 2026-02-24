import { Extension } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
export const FOCUS_LINK_POPOVER_EVENT = "hubble:focus-link-popover";

function findWordRangeAtCursor(
	state: EditorState,
): { from: number; to: number } | null {
	const { selection } = state;
	if (!selection.empty) return null;
	const $from = selection.$from;
	const parent = $from.parent;
	if (!parent.isTextblock) return null;

	const text = parent.textContent;
	const offset = $from.parentOffset;
	let start = offset;
	let end = offset;

	while (start > 0 && !/\s/.test(text[start - 1] ?? "")) {
		start -= 1;
	}
	while (end < text.length && !/\s/.test(text[end] ?? "")) {
		end += 1;
	}
	if (start === end) return null;

	const base = $from.start();
	return { from: base + start, to: base + end };
}

function toggleLinkAtSelection() {
	return () =>
		({
			state,
			dispatch,
		}: {
			state: EditorState;
			dispatch?: (tr: Transaction) => void;
		}) => {
			const linkType = state.schema.marks.link;
			if (!linkType) return false;

			const { selection } = state;
			const range = selection.empty
				? findWordRangeAtCursor(state)
				: { from: selection.from, to: selection.to };

			// Empty selection with no word under cursor: toggle the stored
			// link mark so subsequent typing inherits it, matching bold/italic.
			if (selection.empty && (!range || range.from >= range.to)) {
				if (dispatch) {
					const tr = state.tr.addStoredMark(linkType.create({ href: "" }));
					dispatch(tr);
				}
				window.dispatchEvent(new CustomEvent(FOCUS_LINK_POPOVER_EVENT));
				return true;
			}

			if (!range || range.from >= range.to) return false;

			const hasLink = state.doc.rangeHasMark(range.from, range.to, linkType);
			if (!hasLink) {
				const tr = state.tr.addMark(
					range.from,
					range.to,
					linkType.create({ href: "" }),
				);
				dispatch?.(tr);
			}
			window.dispatchEvent(new CustomEvent(FOCUS_LINK_POPOVER_EVENT));
			return true;
		};
}

export const SmartLinkExtension = Extension.create({
	name: "smartLinkToggle",
	priority: 1000,
	addCommands() {
		return {
			toggleLinkAtSelection: toggleLinkAtSelection(),
		};
	},
	addKeyboardShortcuts() {
		return {
			"Mod-k": () => this.editor.commands.toggleLinkAtSelection(),
		};
	},
});

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		smartLinkToggle: {
			toggleLinkAtSelection: () => ReturnType;
		};
	}
}
