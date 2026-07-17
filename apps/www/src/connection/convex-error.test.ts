import { describe, expect, it } from "vitest";
import { categorizeError, describeError } from "./convex-error";

describe("Convex connection error copy", () => {
	it("explains a production outage without exposing the raw transport error", () => {
		const message = describeError(
			categorizeError(new TypeError("Failed to fetch")),
		);

		expect(message).toBe(
			"Couldn't reach this deployment. Check the URL and your connection.",
		);
	});

	it("identifies a deployment that is missing the Tubble backend", () => {
		const message = describeError(
			categorizeError(
				new Error("Could not find public function 'folders:listForUser'"),
			),
		);

		expect(message).toBe(
			"This deployment doesn't expose folders:listForUser. It may not be running the Tubble backend.",
		);
	});

	it("identifies an incompatible backend function signature", () => {
		const message = describeError(
			categorizeError(
				new Error(
					"Validator error while calling function 'folders:listForUser'",
				),
			),
		);

		expect(message).toBe(
			"folders:listForUser rejected the call. The backend's function signature may differ from what this app expects.",
		);
	});

	it("gives an expired or unavailable account a recovery path", () => {
		const message = describeError(
			categorizeError(new Error("Authentication required")),
		);

		expect(message).toBe(
			"Your session no longer has access. Sign out, sign back in, and try again.",
		);
	});
});
