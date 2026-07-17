import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	describeAuthError,
	describeSignupAvailabilityError,
	HostedTrialNotice,
	SignupAvailabilityNotice,
} from "./AuthScreens";

describe("HostedTrialNotice", () => {
	it("states the trial boundary and links to independent deployment", () => {
		const html = renderToStaticMarkup(<HostedTrialNotice visible />);

		expect(html).toContain("best-effort service");
		expect(html).toContain("no uptime, backup, support,");
		expect(html).toContain("critical, sensitive, or irreplaceable work");
		expect(html).toContain("Keep your own copies");
		expect(html).toContain(
			"https://github.com/adrianricardo/tubble.md/blob/main/specs/public-try-it-today-launch/DEPLOY.md",
		);
	});

	it("removes the collapsed notice link from keyboard navigation", () => {
		const html = renderToStaticMarkup(<HostedTrialNotice visible={false} />);

		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain('tabindex="-1"');
	});
});

describe("SignupAvailabilityNotice", () => {
	it("announces an operator pause without hiding the sign-in path", () => {
		const html = renderToStaticMarkup(
			<SignupAvailabilityNotice message="New signups are temporarily paused. Existing accounts can still sign in." />,
		);

		expect(html).toContain('aria-live="polite"');
		expect(html).toContain("New signups are temporarily paused");
		expect(html).toContain("Existing accounts can still sign in");
	});

	it("announces the daily cap before signup", () => {
		const html = renderToStaticMarkup(
			<SignupAvailabilityNotice message="Daily signup limit reached. Signups reopen tomorrow." />,
		);

		expect(html).toContain('aria-live="polite"');
		expect(html).toContain("Daily signup limit reached");
		expect(html).toContain("Signups reopen tomorrow");
	});
});

describe("signup failure recovery", () => {
	it("fails closed with human-readable outage copy", () => {
		expect(
			describeSignupAvailabilityError(new TypeError("Failed to fetch")),
		).toBe(
			"The hosted trial is unavailable right now. Signups remain closed. Existing users can still try signing in.",
		);
	});

	it("fails closed with human-readable deployment-mismatch copy", () => {
		expect(
			describeSignupAvailabilityError(
				new Error("Could not find public function 'auth:signupAvailability'"),
			),
		).toBe(
			"The hosted trial is temporarily misconfigured. Signups remain closed. Existing users can still try signing in.",
		);
	});

	it("gives an unavailable account a safe sign-in response", () => {
		expect(describeAuthError(new Error("InvalidAccountId"), "signIn")).toBe(
			"Email or password didn't match.",
		);
		expect(
			describeAuthError(
				new Error(
					"[CONVEX A(auth:signIn)] [Request ID: redacted] Server Error Called by client",
				),
				"signIn",
			),
		).toBe("Email or password didn't match.");
		expect(
			describeAuthError(new Error("Authentication required"), "signIn"),
		).toBe(
			"Your session no longer has access. Sign out, sign back in, and try again.",
		);
	});
});
