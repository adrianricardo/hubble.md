import { Node } from "@tiptap/core";
import {
	NodeViewWrapper,
	ReactNodeViewRenderer,
	type ReactNodeViewProps,
} from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import "./EmbedExtension.css";

type EmbedAttrs = {
	name: string;
	tagName: string;
	props: Record<string, string>;
};

const KANBAN_ELEMENT = "hubble-kanban-embed";

export const EmbedExtension = Node.create({
	name: "embed",
	group: "block",
	atom: true,
	selectable: true,
	draggable: true,

	addAttributes() {
		return {
			name: { default: "" },
			tagName: { default: "" },
			props: { default: {} },
		};
	},

	renderHTML({ node }) {
		const attrs = node.attrs as EmbedAttrs;
		return [attrs.tagName || `embed-${attrs.name}`, attrs.props ?? {}];
	},

	addNodeView() {
		return ReactNodeViewRenderer(EmbedNodeView);
	},
});

class KanbanElement extends HTMLElement {
	#root: Root | null = null;
	#mountPoint: HTMLDivElement | null = null;

	connectedCallback() {
		if (!this.shadowRoot) {
			const shadow = this.attachShadow({ mode: "open" });
			const style = document.createElement("style");
			style.textContent = kanbanCss;
			this.#mountPoint = document.createElement("div");
			shadow.append(style, this.#mountPoint);
		}

		if (this.#mountPoint && !this.#root) {
			this.#root = createRoot(this.#mountPoint);
			this.#root.render(<KanbanApp />);
		}
	}

	disconnectedCallback() {
		this.#root?.unmount();
		this.#root = null;
	}
}

if (!customElements.get(KANBAN_ELEMENT)) {
	customElements.define(KANBAN_ELEMENT, KanbanElement);
}

function EmbedNodeView({ node }: ReactNodeViewProps) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const attrs = node.attrs as EmbedAttrs;

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		host.replaceChildren();
		if (attrs.name !== "kanban") {
			const error = document.createElement("p");
			error.className = "hubble-embed-error";
			error.textContent = `Unknown embed: ${attrs.tagName || attrs.name}`;
			host.append(error);
			return;
		}

		host.append(document.createElement(KANBAN_ELEMENT));
	}, [attrs.name, attrs.tagName]);

	return (
		<NodeViewWrapper className="hubble-embed">
			<div className="hubble-embed-host" ref={hostRef} />
		</NodeViewWrapper>
	);
}

type Status = "not-started" | "in-progress" | "done";

type Card = {
	id: string;
	title: string;
	description: string;
	status: Status;
};

const lanes: { id: Status; title: string }[] = [
	{ id: "not-started", title: "Not started" },
	{ id: "in-progress", title: "In progress" },
	{ id: "done", title: "Done" },
];

const initialCards: Card[] = [
	{
		id: "outline",
		title: "Outline embed API",
		description: "Write the host contract and lifecycle notes.",
		status: "not-started",
	},
	{
		id: "shadow",
		title: "Test Shadow DOM",
		description: "Confirm styles isolate and menus overflow.",
		status: "in-progress",
	},
	{
		id: "adr",
		title: "Record decision",
		description: "Update ADR-0005 with the spike outcome.",
		status: "done",
	},
];

function KanbanApp() {
	const [cards, setCards] = useState(initialCards);
	const [title, setTitle] = useState("");
	const [menuOpen, setMenuOpen] = useState<string | null>("adr");

	const addCard = () => {
		const trimmed = title.trim();
		if (!trimmed) return;
		setCards((current) => [
			...current,
			{
				id: crypto.randomUUID(),
				title: trimmed,
				description: "New card",
				status: "not-started",
			},
		]);
		setTitle("");
	};

	const moveCard = (cardId: string, status: Status) => {
		setCards((current) =>
			current.map((card) =>
				card.id === cardId ? { ...card, status } : card,
			),
		);
	};

	return (
		<section className="kanban" aria-label="Embedded Kanban board">
			<header className="kanban-header">
				<div>
					<p className="eyebrow">Embed spike</p>
					<h2>Kanban</h2>
				</div>
				<form
					className="new-card"
					onSubmit={(event) => {
						event.preventDefault();
						addCard();
					}}
				>
					<input
						value={title}
						onChange={(event) => setTitle(event.currentTarget.value)}
						placeholder="Add card"
						aria-label="Card title"
					/>
					<button type="submit">Add</button>
				</form>
			</header>
			<div className="lanes">
				{lanes.map((lane) => (
					<section
						className="lane"
						key={lane.id}
						onDragOver={(event) => event.preventDefault()}
						onDrop={(event) => {
							const cardId = event.dataTransfer.getData("text/plain");
							if (cardId) moveCard(cardId, lane.id);
						}}
					>
						<header className="lane-header">
							<h3>{lane.title}</h3>
							<span>{cards.filter((card) => card.status === lane.id).length}</span>
						</header>
						<div className="cards">
							{cards
								.filter((card) => card.status === lane.id)
								.map((card) => (
									<article
										className="card"
										draggable
										key={card.id}
										onDragStart={(event) => {
											event.dataTransfer.setData("text/plain", card.id);
										}}
									>
										<div className="card-top">
											<h4>{card.title}</h4>
											<button
												type="button"
												className="menu-button"
												aria-label={`Open ${card.title} menu`}
												onClick={() =>
													setMenuOpen((open) =>
														open === card.id ? null : card.id,
													)
												}
											>
												...
											</button>
											{menuOpen === card.id && (
												<div className="popover">
													<button type="button">Edit title</button>
													<button type="button">Duplicate</button>
													<button type="button">Archive</button>
												</div>
											)}
										</div>
										<p>{card.description}</p>
									</article>
								))}
						</div>
					</section>
				))}
			</div>
		</section>
	);
}

const kanbanCss = `
	:host {
		display: block;
		color: #182230;
		font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	}

	* {
		box-sizing: border-box;
	}

	.kanban {
		position: relative;
		overflow: visible;
		border: 1px solid #d0d5dd;
		border-radius: 12px;
		background: #f8fafc;
		box-shadow: 0 10px 30px rgb(16 24 40 / 0.08);
		padding-block: 16px;
		padding-inline: 16px;
	}

	.kanban-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
		margin-block-end: 14px;
	}

	.eyebrow,
	h2,
	h3,
	h4,
	p {
		margin: 0;
	}

	.eyebrow {
		color: #667085;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
	}

	h2 {
		font-size: 22px;
	}

	.new-card {
		display: flex;
		gap: 8px;
	}

	input,
	button {
		border: 1px solid #d0d5dd;
		border-radius: 8px;
		font: inherit;
	}

	input {
		inline-size: 180px;
		padding-block: 8px;
		padding-inline: 10px;
	}

	button {
		background: #fff;
		cursor: pointer;
		font-weight: 650;
		padding-block: 8px;
		padding-inline: 10px;
	}

	button:hover {
		background: #f2f4f7;
	}

	.lanes {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		overflow: visible;
	}

	.lane {
		min-block-size: 240px;
		overflow: visible;
		border: 1px solid #eaecf0;
		border-radius: 10px;
		background: #fff;
		padding-block: 12px;
		padding-inline: 12px;
	}

	.lane-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-block-end: 10px;
	}

	.lane-header h3 {
		font-size: 14px;
	}

	.lane-header span {
		border-radius: 999px;
		background: #eef4ff;
		color: #3538cd;
		font-size: 12px;
		font-weight: 700;
		padding-block: 2px;
		padding-inline: 8px;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.card {
		position: relative;
		border: 1px solid #d0d5dd;
		border-radius: 8px;
		background: #fff;
		box-shadow: 0 1px 2px rgb(16 24 40 / 0.08);
		cursor: grab;
		padding-block: 10px;
		padding-inline: 10px;
	}

	.card:active {
		cursor: grabbing;
	}

	.card-top {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 8px;
	}

	.card h4 {
		font-size: 14px;
	}

	.card p {
		color: #475467;
		font-size: 13px;
		margin-block-start: 6px;
	}

	.menu-button {
		block-size: 28px;
		inline-size: 28px;
		padding-block: 0;
		padding-inline: 0;
	}

	.popover {
		position: absolute;
		z-index: 10;
		inset-block-start: 34px;
		inset-inline-end: -220px;
		display: flex;
		min-inline-size: 140px;
		flex-direction: column;
		border: 1px solid #d0d5dd;
		border-radius: 8px;
		background: #fff;
		box-shadow: 0 12px 24px rgb(16 24 40 / 0.16);
		padding-block: 6px;
		padding-inline: 6px;
	}

	.popover button {
		border: 0;
		text-align: start;
	}
`;
