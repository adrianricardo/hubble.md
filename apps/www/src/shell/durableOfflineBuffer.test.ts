import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearSessionCache,
	createMemoryBufferStore,
	type DurableBuffer,
	hydrateSessionCache,
	writeSessionCache,
} from "./durableOfflineBuffer";

function installSessionStorage() {
	const items = new Map<string, string>();
	const storage: Storage = {
		get length() {
			return items.size;
		},
		clear() {
			items.clear();
		},
		getItem(key) {
			return items.get(key) ?? null;
		},
		key(index) {
			return [...items.keys()][index] ?? null;
		},
		removeItem(key) {
			items.delete(key);
		},
		setItem(key, value) {
			items.set(key, value);
		},
	};
	vi.stubGlobal("sessionStorage", storage);
	return storage;
}

const buffer: DurableBuffer = {
	content: { type: "doc", content: [{ type: "paragraph" }] },
	version: 7,
	steps: [{ stepType: "replace", from: 1, to: 1 }],
	updatedAt: 123,
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("durable offline buffer session bridge", () => {
	it("writes the exact cache shape consumed by prosemirror-sync", () => {
		const storage = installSessionStorage();

		writeSessionCache("doc-1", buffer);

		expect(JSON.parse(storage.getItem("convex-sync-doc-1") ?? "")).toEqual({
			content: buffer.content,
			version: buffer.version,
			steps: buffer.steps,
		});
	});

	it("hydrates from an existing session cache before the durable store", async () => {
		installSessionStorage();
		const store = createMemoryBufferStore();
		await store.save("doc-1", {
			content: { type: "doc", content: [] },
			version: 3,
			steps: [],
			updatedAt: 99,
		});
		writeSessionCache("doc-1", buffer);

		const restored = await hydrateSessionCache("doc-1", store);

		expect(restored).toMatchObject({
			content: buffer.content,
			version: buffer.version,
			steps: buffer.steps,
		});
	});

	it("hydrates sessionStorage from the durable store after a full restart", async () => {
		const storage = installSessionStorage();
		const store = createMemoryBufferStore();
		await store.save("doc-1", buffer);

		const restored = await hydrateSessionCache("doc-1", store);

		expect(restored).toEqual(buffer);
		expect(JSON.parse(storage.getItem("convex-sync-doc-1") ?? "")).toEqual({
			content: buffer.content,
			version: buffer.version,
			steps: buffer.steps,
		});
	});

	it("clears the upstream session cache", () => {
		const storage = installSessionStorage();
		writeSessionCache("doc-1", buffer);

		clearSessionCache("doc-1");

		expect(storage.getItem("convex-sync-doc-1")).toBeNull();
	});
});
