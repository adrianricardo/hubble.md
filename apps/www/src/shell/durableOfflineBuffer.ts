/**
 * Durable in-editor offline buffer for `@convex-dev/prosemirror-sync`.
 *
 * Why this exists
 * ---------------
 * `@convex-dev/prosemirror-sync` keeps unsynced local steps only in
 * `prosemirror-collab`'s in-memory buffer. Its on-disk/offline cache is
 * read-only dead code: `getCachedState` reads
 * `sessionStorage['convex-sync-<id>']` as `{ content, version, steps }` and the
 * extension's `onCreate` replays `restoredSteps` — but nothing in the package
 * ever WRITES that key (both halves carry `// TODO: Verify that this works`).
 * So a reload while offline loses unsynced edits.
 *
 * This module is the missing writer + a durable backing store. It is a thin,
 * NON-FORK layer on the package's own primitives:
 *
 *  - `createDurableOfflinePersister` tracks the last *confirmed* (synced)
 *    document and, on every editor transaction, writes the confirmed snapshot +
 *    the current `collab.sendableSteps` to:
 *      1. IndexedDB  — durable across tab-close / app-restart, and
 *      2. sessionStorage under `convex-sync-<id>` — the exact key + shape the
 *         package's own `getCachedState` read path already consumes.
 *  - `hydrateSessionCache` copies an IndexedDB buffer into sessionStorage
 *    BEFORE the editor mounts, so the package's read path also fires after a
 *    full app restart (sessionStorage does not survive that; IndexedDB does).
 *
 * What is persisted (and why it is correct)
 * -----------------------------------------
 * `content` = the last CONFIRMED doc (the snapshot the server already has),
 * `version` = the collab version those unconfirmed steps are based on,
 * `steps`   = the unconfirmed `sendableSteps`, serialized.
 *
 * On restore the package loads `content` at `version` and replays `steps` on
 * top, so the steps become sendable again and flush through the normal sync
 * path on reconnect. We must persist the *confirmed* doc (not the current doc)
 * — otherwise replaying the steps would double-apply them, or, if we skipped
 * replay, the offline edits would never be sent to the server.
 *
 * While genuinely offline the confirmed version is frozen (Convex can't reach
 * the server, so no remote steps / rebase arrive), which is exactly why
 * tracking "confirmed = the doc at the moment `sendableSteps === null`" is
 * sound for the offline-reload case this targets.
 */

import * as collab from "@tiptap/pm/collab";
import type { EditorState } from "@tiptap/pm/state";

/** The cache-key prefix `getCachedState` uses when no `cacheKeyPrefix` is passed. */
const SESSION_CACHE_PREFIX = "convex-sync";

const DB_NAME = "hubble-live-offline";
const STORE_NAME = "step-buffers";
const DB_VERSION = 1;

/**
 * The persisted unit. Shapes 1:1 with what `getCachedState` parses:
 * `{ content, version, steps }` (plus our own `updatedAt` bookkeeping, ignored
 * by the package's reader).
 */
export type DurableBuffer = {
	/** Last confirmed/synced doc JSON (the snapshot at `version`). */
	content: unknown;
	/** Collab version the unconfirmed steps are based on. */
	version: number;
	/** Serialized unconfirmed ProseMirror steps (sendableSteps). */
	steps: object[];
	/** Local bookkeeping; not read by the package. */
	updatedAt: number;
};

/** Async key/value backing store for durable buffers, keyed by sync doc id. */
export interface DurableBufferStore {
	load(docId: string): Promise<DurableBuffer | null>;
	save(docId: string, buffer: DurableBuffer): Promise<void>;
	clear(docId: string): Promise<void>;
}

// --- sessionStorage bridge (the package's synchronous read interface) -------

function sessionCacheKey(docId: string): string {
	return `${SESSION_CACHE_PREFIX}-${docId}`;
}

function getSessionStorage(): Storage | null {
	try {
		if (typeof globalThis === "undefined") return null;
		const candidate = (globalThis as { sessionStorage?: Storage })
			.sessionStorage;
		return candidate ?? null;
	} catch {
		// Accessing sessionStorage can throw in sandboxed contexts.
		return null;
	}
}

/**
 * Write a buffer into sessionStorage in the exact `{ content, version, steps }`
 * shape `getCachedState` expects. Synchronous, so a same-tab reload restores
 * immediately without waiting on IndexedDB.
 */
export function writeSessionCache(docId: string, buffer: DurableBuffer): void {
	const storage = getSessionStorage();
	if (!storage) return;
	try {
		storage.setItem(
			sessionCacheKey(docId),
			JSON.stringify({
				content: buffer.content,
				version: buffer.version,
				steps: buffer.steps,
			}),
		);
	} catch {
		// Quota / serialization failures are non-fatal: durability degrades to
		// the IndexedDB copy (hydrated on next mount), never a crash.
	}
}

export function clearSessionCache(docId: string): void {
	const storage = getSessionStorage();
	if (!storage) return;
	try {
		storage.removeItem(sessionCacheKey(docId));
	} catch {
		// no-op
	}
}

function readSessionCache(docId: string): DurableBuffer | null {
	const storage = getSessionStorage();
	if (!storage) return null;
	try {
		const raw = storage.getItem(sessionCacheKey(docId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as {
			content?: unknown;
			version?: unknown;
			steps?: unknown;
		};
		if (
			typeof parsed.version !== "number" ||
			!Array.isArray(parsed.steps) ||
			parsed.content === undefined
		) {
			return null;
		}
		return {
			content: parsed.content,
			version: parsed.version,
			steps: parsed.steps as object[],
			updatedAt: Date.now(),
		};
	} catch {
		return null;
	}
}

/**
 * Pre-mount hydration: if a durable buffer exists in IndexedDB but not in
 * sessionStorage (i.e. the tab/app was restarted), copy it into sessionStorage
 * so the package's `getCachedState` finds it. Returns the buffer (or null) so
 * callers can seed the persister's confirmed baseline from the same data.
 */
export async function hydrateSessionCache(
	docId: string,
	store: DurableBufferStore,
): Promise<DurableBuffer | null> {
	// A live same-tab buffer is already authoritative; return the same snapshot
	// the upstream synchronous reader will restore so the persister seeds the
	// matching confirmed baseline.
	const sessionBuffer = readSessionCache(docId);
	if (sessionBuffer) return sessionBuffer;
	const buffer = await store.load(docId).catch(() => null);
	if (buffer) writeSessionCache(docId, buffer);
	return buffer;
}

// --- IndexedDB store --------------------------------------------------------

function getIndexedDb(): IDBFactory | null {
	try {
		const candidate = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
		return candidate ?? null;
	} catch {
		return null;
	}
}

/**
 * IndexedDB-backed store. Durable across reload, tab-close and app-restart.
 * Falls back to a no-op if IndexedDB is unavailable (e.g. SSR / private mode);
 * in that case sessionStorage still covers the same-tab reload case.
 */
export function createIndexedDbBufferStore(): DurableBufferStore {
	const idb = getIndexedDb();
	if (!idb) return createMemoryBufferStore();

	let dbPromise: Promise<IDBDatabase> | null = null;
	const openDb = (): Promise<IDBDatabase> => {
		if (!dbPromise) {
			dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
				const req = idb.open(DB_NAME, DB_VERSION);
				req.onupgradeneeded = () => {
					if (!req.result.objectStoreNames.contains(STORE_NAME)) {
						req.result.createObjectStore(STORE_NAME);
					}
				};
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			}).catch((error) => {
				dbPromise = null;
				throw error;
			});
		}
		return dbPromise;
	};

	const run = <T>(
		mode: IDBTransactionMode,
		body: (store: IDBObjectStore) => IDBRequest<T> | null,
	): Promise<T | undefined> =>
		openDb().then(
			(db) =>
				new Promise<T | undefined>((resolve, reject) => {
					const tx = db.transaction(STORE_NAME, mode);
					const request = body(tx.objectStore(STORE_NAME));
					tx.oncomplete = () => resolve(request?.result);
					tx.onerror = () => reject(tx.error);
					tx.onabort = () => reject(tx.error);
				}),
		);

	return {
		async load(docId) {
			const value = await run<DurableBuffer>("readonly", (s) => s.get(docId));
			return value ?? null;
		},
		async save(docId, buffer) {
			await run("readwrite", (s) => s.put(buffer, docId));
		},
		async clear(docId) {
			await run("readwrite", (s) => s.delete(docId));
		},
	};
}

/** In-memory store for tests, SSR, and IndexedDB-unavailable fallback. */
export function createMemoryBufferStore(): DurableBufferStore {
	const map = new Map<string, DurableBuffer>();
	return {
		async load(docId) {
			return map.get(docId) ?? null;
		},
		async save(docId, buffer) {
			map.set(docId, buffer);
		},
		async clear(docId) {
			map.delete(docId);
		},
	};
}

// --- Persister --------------------------------------------------------------

export type PersistAction = "saved" | "cleared" | "idle";

export type DurableOfflinePersister = {
	/**
	 * Compute the buffer that WOULD be persisted for `state`, or `null` if the
	 * editor is fully synced. Pure (no side effects) — used by tests and by
	 * `handleTransaction`.
	 */
	computeBuffer(state: EditorState): DurableBuffer | null;
	/**
	 * Call on every editor transaction. Persists unsynced steps (sessionStorage
	 * sync + IndexedDB async) or clears the durable buffer once everything is
	 * acknowledged. Returns what it did.
	 */
	handleTransaction(state: EditorState): PersistAction;
};

export type DurableOfflinePersisterOptions = {
	docId: string;
	store: DurableBufferStore;
	/**
	 * Buffer restored from the durable store during hydration, if any. When
	 * present its `content`/`version` seed the confirmed baseline so the first
	 * persist after a restore re-derives the same (correct) base doc rather than
	 * mistaking the already-restored steps for confirmed content.
	 */
	restoredBuffer?: DurableBuffer | null;
	onError?: (error: unknown) => void;
};

/**
 * Tracks the confirmed snapshot and bridges unconfirmed steps to durable
 * storage. See the module header for the correctness argument.
 */
export function createDurableOfflinePersister(
	options: DurableOfflinePersisterOptions,
): DurableOfflinePersister {
	const { docId, store, restoredBuffer, onError } = options;

	// The last confirmed (server-acknowledged) doc + its collab version. Seeded
	// from a restored buffer when resuming offline; otherwise captured lazily on
	// the first fully-synced transaction.
	let confirmed: { content: unknown; version: number } | null = restoredBuffer
		? { content: restoredBuffer.content, version: restoredBuffer.version }
		: null;

	// Dedup signature so selection-only transactions (which don't change the
	// sendable steps) don't trigger redundant IndexedDB writes.
	let lastSignature: string | null = restoredBuffer
		? signatureOf(restoredBuffer)
		: null;
	let hasPersisted = restoredBuffer != null;

	const reportError = (error: unknown) => {
		if (onError) onError(error);
		else console.error("durable offline buffer error:", error);
	};

	const computeBuffer = (state: EditorState): DurableBuffer | null => {
		const sendable = collab.sendableSteps(state);
		if (!sendable) return null;
		// `confirmed` is guaranteed set whenever there are unconfirmed steps:
		// either seeded from a restored buffer, or captured on the prior synced
		// transaction. Fall back defensively to the current doc/version.
		const base = confirmed ?? {
			content: state.doc.toJSON(),
			version: sendable.version,
		};
		return {
			content: base.content,
			version: sendable.version,
			steps: sendable.steps.map((step) => step.toJSON()),
			updatedAt: Date.now(),
		};
	};

	const handleTransaction = (state: EditorState): PersistAction => {
		const sendable = collab.sendableSteps(state);

		if (!sendable) {
			// Fully synced: this doc IS the confirmed snapshot now.
			confirmed = {
				content: state.doc.toJSON(),
				version: collab.getVersion(state),
			};
			if (!hasPersisted) {
				lastSignature = null;
				return "idle";
			}
			hasPersisted = false;
			lastSignature = null;
			clearSessionCache(docId);
			store.clear(docId).catch(reportError);
			return "cleared";
		}

		const buffer = computeBuffer(state);
		if (!buffer) return "idle";
		const signature = signatureOf(buffer);
		if (signature === lastSignature) return "idle";
		lastSignature = signature;
		hasPersisted = true;
		writeSessionCache(docId, buffer);
		store.save(docId, buffer).catch(reportError);
		return "saved";
	};

	return { computeBuffer, handleTransaction };
}

function signatureOf(buffer: DurableBuffer): string {
	return JSON.stringify([buffer.version, buffer.steps]);
}
