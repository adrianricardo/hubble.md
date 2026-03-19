import type {
	ApplyTrackedMarkdownEditRequest,
	TrackedMarkdownSnapshot,
} from "@hubble.md/editor";
import {
	type AgentPresenceState,
	applyCurrentTrackedMarkdownEdit,
	clearAgentPresence,
	getCurrentTrackedMarkdownDocument,
	getCurrentTrackedMarkdownSnapshot,
	setAgentPresence,
} from "./store";

export function getCurrentDocumentState() {
	return getCurrentTrackedMarkdownDocument();
}

export function getCurrentDocumentSnapshot(): TrackedMarkdownSnapshot | null {
	return getCurrentTrackedMarkdownSnapshot();
}

export async function applyCurrentDocumentEdit(
	request: ApplyTrackedMarkdownEditRequest,
) {
	return applyCurrentTrackedMarkdownEdit(request);
}

export function setCurrentAgentPresence(
	presence: Omit<AgentPresenceState, "updatedAt">,
) {
	return setAgentPresence(presence);
}

export function clearCurrentAgentPresence() {
	clearAgentPresence();
}
