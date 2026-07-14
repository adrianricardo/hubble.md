import { api } from "@hubble.md/sync-backend";
import { beforeEach, describe, expect, it, vi } from "vitest";

const onUpdate = vi.fn();
const close = vi.fn(async () => {});

vi.mock("convex/browser", () => ({
	ConvexClient: class {
		onUpdate = onUpdate;
		close = close;
		setAuth() {}
	},
	ConvexHttpClient: class {},
}));

import { createConvexSubscriber } from "./index.js";

describe("createConvexSubscriber Workspace scope", () => {
	beforeEach(() => {
		onUpdate.mockReset();
		close.mockClear();
		onUpdate.mockImplementation(() => vi.fn());
	});

	it("subscribes only to folders and documents in the selected Workspace", () => {
		const subscriber = createConvexSubscriber("https://fake.convex.cloud");
		const callback = vi.fn();

		subscriber.onSyncedFolderChanged(
			{ kind: "workspace", workspaceId: "ws_selected" },
			callback,
			vi.fn(),
		);

		expect(onUpdate).toHaveBeenCalledTimes(2);
		expect(
			onUpdate.mock.calls.map(([query, args]) => ({ query, args })),
		).toEqual([
			{
				query: api.folders.list,
				args: { workspaceId: "ws_selected" },
			},
			{
				query: api.documents.listWithMarkdown,
				args: { workspaceId: "ws_selected" },
			},
		]);
		expect(
			onUpdate.mock.calls.some(([, args]) => args.workspaceId === "ws_other"),
		).toBe(false);
	});
});
