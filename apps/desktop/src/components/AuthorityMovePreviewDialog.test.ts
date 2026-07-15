import { describe, expect, it } from "vitest";
import {
	canConfirmGitToCloud,
	displayFolderName,
	previewChanged,
	safeGitFolderName,
} from "./authorityMovePreviewModel";

describe("authority move preview helpers", () => {
	it("normalizes a cloud folder name without inventing a path hierarchy", () => {
		expect(safeGitFolderName("  Product notes / Q3  ")).toBe(
			"Product-notes-Q3",
		);
		expect(safeGitFolderName("💫")).toBe("hubble-folder");
	});

	it("derives a label from canonical and trailing-slash folder ids", () => {
		expect(displayFolderName("notes/research")).toBe("research");
		expect(displayFolderName("notes/research/")).toBe("research");
	});

	it("only reports staleness after an established fingerprint changes", () => {
		expect(previewChanged(null, "next")).toBe(false);
		expect(previewChanged("same", "same")).toBe(false);
		expect(previewChanged("before", "after")).toBe(true);
	});

	it("exposes confirmation only after every verified-cutover prerequisite", () => {
		const ready = {
			online: true,
			journaled: true,
			hasInspection: true,
			confirmationBlocked: false,
			hasWorkspace: true,
			membersLoaded: true,
			authReady: true,
			stale: false,
			busy: false,
		};
		expect(canConfirmGitToCloud(ready)).toBe(true);
		for (const key of [
			"online",
			"journaled",
			"hasInspection",
			"hasWorkspace",
			"membersLoaded",
			"authReady",
		] as const) {
			expect(canConfirmGitToCloud({ ...ready, [key]: false })).toBe(false);
		}
		expect(canConfirmGitToCloud({ ...ready, confirmationBlocked: true })).toBe(
			false,
		);
		expect(canConfirmGitToCloud({ ...ready, stale: true })).toBe(false);
		expect(canConfirmGitToCloud({ ...ready, busy: true })).toBe(false);
	});
});
