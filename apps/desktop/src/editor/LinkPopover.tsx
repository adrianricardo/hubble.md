import { getActiveLinkRange } from "@hubble.md/editor";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Editor } from "@tiptap/core";
import { keymatch } from "keymatch";
import { type RefObject, useEffect, useReducer, useRef, useState } from "react";
import { FOCUS_LINK_POPOVER_EVENT } from "./SmartLinkExtension";

type PopoverMode = "hidden" | "preview" | "actions";
type MachineState = {
	mode: PopoverMode;
	activeKey: string | null;
	dismissedKey: string | null;
};
type MachineEvent =
	| { type: "LINK_SESSION_CHANGED"; activeKey: string | null }
	| { type: "EXPAND_REQUESTED" }
	| { type: "TOGGLE_ACTIONS_REQUESTED" }
	| { type: "ESCAPE_REQUESTED" };

const INITIAL_MACHINE_STATE: MachineState = {
	mode: "hidden",
	activeKey: null,
	dismissedKey: null,
};

function machineReducer(
	state: MachineState,
	event: MachineEvent,
): MachineState {
	switch (event.type) {
		case "LINK_SESSION_CHANGED": {
			const { activeKey } = event;
			if (!activeKey) return INITIAL_MACHINE_STATE;
			if (state.activeKey !== activeKey) {
				return { mode: "preview", activeKey, dismissedKey: null };
			}
			return { ...state, activeKey };
		}
		case "EXPAND_REQUESTED": {
			if (!state.activeKey) return state;
			return { ...state, mode: "actions", dismissedKey: null };
		}
		case "TOGGLE_ACTIONS_REQUESTED": {
			if (!state.activeKey) return state;
			if (state.mode === "preview") {
				return { ...state, mode: "actions", dismissedKey: null };
			}
			if (state.mode === "actions") {
				return { ...state, mode: "preview" };
			}
			return state;
		}
		case "ESCAPE_REQUESTED": {
			if (state.mode === "actions") {
				return { ...state, mode: "preview" };
			}
			if (state.mode === "preview" && state.activeKey) {
				return {
					...state,
					mode: "hidden",
					dismissedKey: state.activeKey,
				};
			}
			return state;
		}
		default:
			return state;
	}
}

export function LinkPopover({
	editor,
	containerRef,
}: {
	editor: Editor | null;
	containerRef: RefObject<HTMLDivElement | null>;
}) {
	const [anchorLeft, setAnchorLeft] = useState(0);
	const [top, setTop] = useState(0);
	const [hrefValue, setHrefValue] = useState("");
	const [activeLink, setActiveLink] = useState<{
		from: number;
		to: number;
		href: string;
	} | null>(null);
	const [machineState, dispatch] = useReducer(
		machineReducer,
		INITIAL_MACHINE_STATE,
	);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const popoverWidth = machineState.mode === "preview" ? 165 : 238;

	useEffect(() => {
		if (!editor) return;
		const update = () => {
			const link = getActiveLinkRange(editor.state);
			setActiveLink(link);
			if (link) setHrefValue(link.href);
			const nextActiveKey = link ? `${link.from}:${link.to}` : null;
			dispatch({ type: "LINK_SESSION_CHANGED", activeKey: nextActiveKey });
			const container = containerRef.current;
			if (!container || !link) return;
			const coords = editor.view.coordsAtPos(editor.state.selection.from);
			const containerRect = container.getBoundingClientRect();
			const inlinePadding = 8;
			const minCenter = inlinePadding + popoverWidth / 2;
			const maxCenter = containerRect.width - inlinePadding - popoverWidth / 2;
			const desiredCenter =
				(coords.left + coords.right) / 2 - containerRect.left;
			const clampedCenter = Math.max(
				minCenter,
				Math.min(desiredCenter, maxCenter),
			);
			const desiredTop = coords.top - containerRect.top - 38;
			setAnchorLeft(clampedCenter);
			setTop(
				desiredTop < 0 ? coords.bottom - containerRect.top + 8 : desiredTop,
			);
		};

		update();
		editor.on("selectionUpdate", update);
		editor.on("transaction", update);
		editor.on("focus", update);
		editor.on("blur", update);
		window.addEventListener("resize", update);
		window.addEventListener("scroll", update, true);

		return () => {
			editor.off("selectionUpdate", update);
			editor.off("transaction", update);
			editor.off("focus", update);
			editor.off("blur", update);
			window.removeEventListener("resize", update);
			window.removeEventListener("scroll", update, true);
		};
	}, [editor, containerRef, popoverWidth]);

	useEffect(() => {
		const onFocusRequest = () => {
			dispatch({ type: "EXPAND_REQUESTED" });
		};
		window.addEventListener(
			FOCUS_LINK_POPOVER_EVENT,
			onFocusRequest as EventListener,
		);
		return () => {
			window.removeEventListener(
				FOCUS_LINK_POPOVER_EVENT,
				onFocusRequest as EventListener,
			);
		};
	}, []);

	useEffect(() => {
		if (machineState.mode !== "actions") return;
		queueMicrotask(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
	}, [machineState.mode]);

	useEffect(() => {
		if (!editor || !activeLink) return;
		const onKeyDown = (event: KeyboardEvent) => {
			const isInputFocused = document.activeElement === inputRef.current;
			const isVisible = machineState.mode !== "hidden";

			if (isInputFocused && keymatch(event, "Enter")) {
				event.preventDefault();
				dispatch({ type: "ESCAPE_REQUESTED" });
				editor.commands.focus(undefined, { scrollIntoView: false });
				return;
			}

			if ((isVisible || editor.isFocused) && keymatch(event, "Escape")) {
				event.preventDefault();
				const shouldReturnFocusToEditor =
					machineState.mode === "preview" || machineState.mode === "actions";
				dispatch({ type: "ESCAPE_REQUESTED" });
				if (shouldReturnFocusToEditor) {
					queueMicrotask(() => {
						editor.commands.focus(undefined, { scrollIntoView: false });
					});
				}
				return;
			}

			if (keymatch(event, "CmdOrCtrl+K")) {
				if (!isVisible) return;
				event.preventDefault();
				event.stopPropagation();
				dispatch({ type: "TOGGLE_ACTIONS_REQUESTED" });
				return;
			}

			if (machineState.mode !== "actions") return;
			if (keymatch(event, "CmdOrCtrl+Enter")) {
				event.preventDefault();
				void visitLink(activeLink.href);
				return;
			}
			if (keymatch(event, "CmdOrCtrl+Shift+C")) {
				event.preventDefault();
				void navigator.clipboard.writeText(activeLink.href);
				return;
			}
			if (keymatch(event, "CmdOrCtrl+Backspace")) {
				event.preventDefault();
				removeActiveLink(editor, activeLink.from, activeLink.to);
			}
		};

		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [editor, activeLink, machineState.mode]);

	if (!editor || !activeLink || machineState.mode === "hidden") return null;

	const handleInput = (href: string) => {
		setHrefValue(href);
		const linkType = editor.state.schema.marks.link;
		if (!linkType) return;
		const tr = editor.state.tr.removeMark(
			activeLink.from,
			activeLink.to,
			linkType,
		);
		tr.addMark(activeLink.from, activeLink.to, linkType.create({ href }));
		editor.view.dispatch(tr);
	};

	return (
		<div
			className="absolute z-[2]"
			style={{
				insetInlineStart: `${anchorLeft}px`,
				insetBlockStart: `${top}px`,
				transform: "translateX(-50%)",
			}}
		>
			{machineState.mode === "preview" ? (
				<button
					type="button"
					className="flex h-7 w-[165px] cursor-pointer overflow-hidden rounded-[2px] border border-zinc-300 bg-gradient-to-b from-white to-zinc-50 text-left shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
					onClick={() => dispatch({ type: "EXPAND_REQUESTED" })}
				>
					<span className="min-w-0 flex-1 overflow-hidden px-2 py-[5px] text-[11px] leading-[16px] text-zinc-700 text-clip whitespace-nowrap">
						{activeLink.href}
					</span>
					<span className="flex h-full items-center bg-accent px-[10px] text-[11px] font-semibold leading-[16px] tracking-[0.12em] text-white">
						⌘K
					</span>
				</button>
			) : (
				<div className="w-[238px] overflow-hidden rounded-[2px] border border-zinc-300 bg-gradient-to-b from-white to-zinc-50 shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
					<input
						ref={inputRef}
						type="text"
						value={hrefValue}
						onChange={(event) => handleInput(event.target.value)}
						className="block w-full border-none bg-transparent px-2 py-[5px] text-[11px] leading-[16px] text-black outline-none"
					/>
					<div className="border-block-start border-zinc-300">
						<div className="grid h-[30px] grid-cols-[1fr_1fr_63px] items-stretch text-[11px] leading-[16px]">
							<button
								type="button"
								className="flex items-center justify-center gap-1 font-semibold text-zinc-700"
								onClick={() =>
									removeActiveLink(editor, activeLink.from, activeLink.to)
								}
							>
								<span>Remove</span>
								<span className="text-[9px] leading-[14px] tracking-[0.12em] text-zinc-500">
									⌘⌫
								</span>
							</button>
							<button
								type="button"
								className="flex items-center justify-center gap-1 font-semibold text-zinc-700"
								onClick={() => {
									void navigator.clipboard.writeText(activeLink.href);
								}}
							>
								<span>Copy</span>
								<span className="text-[9px] leading-[14px] tracking-[0.12em] text-zinc-500">
									⌘⇧C
								</span>
							</button>
							<button
								type="button"
								className="flex items-center justify-center gap-1 bg-accent font-semibold text-white"
								onClick={() => {
									void visitLink(activeLink.href);
								}}
							>
								<span>Visit</span>
								<span className="text-[9px] leading-[14px] tracking-[0.12em] text-green-200">
									⌘↩
								</span>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function removeActiveLink(editor: Editor, from: number, to: number) {
	const linkType = editor.state.schema.marks.link;
	if (!linkType) return;
	const tr = editor.state.tr.removeMark(from, to, linkType);
	editor.view.dispatch(tr);
}

async function visitLink(href: string) {
	try {
		const parsed = new URL(href);
		const protocol = parsed.protocol.toLowerCase();
		if (protocol !== "http:" && protocol !== "https:") {
			// TODO: Replace console warnings with app toast notifications.
			console.warn(`[LinkPopover] blocked non-http(s) URL: ${href}`);
			return;
		}
		await openUrl(href);
	} catch {
		// TODO: Replace console warnings with app toast notifications.
		console.warn(`[LinkPopover] invalid URL: ${href}`);
	}
}
