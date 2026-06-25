import { Extension } from "@tiptap/core";
import type { DurableOfflinePersister } from "./durableOfflineBuffer";

/**
 * Tiptap extension that drives a {@link DurableOfflinePersister} on every
 * transaction, persisting unsynced `collab` steps to durable storage and
 * clearing them once acknowledged.
 *
 * Uses `onTransaction` (not `onUpdate`) so it also observes the collab
 * confirmation transactions that flip `sendableSteps` back to `null` — those
 * don't change the doc and so don't fire `onUpdate`, but they are exactly when
 * the durable buffer should be cleared.
 */
export function createDurableOfflineExtension(
	persister: DurableOfflinePersister,
): Extension {
	return Extension.create({
		name: "hubble-durable-offline",
		onCreate() {
			// Capture the confirmed baseline (no-cache case) or persist already-
			// restored steps (resume-offline case) before any user edit.
			persister.handleTransaction(this.editor.state);
		},
		onTransaction() {
			persister.handleTransaction(this.editor.state);
		},
	});
}
