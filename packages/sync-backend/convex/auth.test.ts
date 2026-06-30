/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { DAILY_SIGNUP_CAP, recordLaunchSignupOrThrow } from "./auth";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("launch signup cap", () => {
	test("records new signups by UTC day", async () => {
		const t = convexTest(schema, modules);
		const now = Date.UTC(2026, 5, 30, 12);

		await t.run((ctx) => recordLaunchSignupOrThrow(ctx, now));
		await t.run((ctx) => recordLaunchSignupOrThrow(ctx, now));

		const days = await t.run((ctx) =>
			ctx.db.query("launchSignupDays").collect(),
		);
		expect(days).toHaveLength(1);
		expect(days[0]).toMatchObject({
			day: "2026-06-30",
			count: 2,
			updatedAt: now,
		});
	});

	test("rejects signups after the daily cap", async () => {
		const t = convexTest(schema, modules);
		const now = Date.UTC(2026, 5, 30, 12);
		await t.run((ctx) =>
			ctx.db.insert("launchSignupDays", {
				day: "2026-06-30",
				count: DAILY_SIGNUP_CAP,
				updatedAt: now,
			}),
		);

		await expect(
			t.run((ctx) => recordLaunchSignupOrThrow(ctx, now + 1)),
		).rejects.toThrow("Daily signup limit reached");

		const day = await t.run((ctx) =>
			ctx.db
				.query("launchSignupDays")
				.withIndex("by_day", (q) => q.eq("day", "2026-06-30"))
				.unique(),
		);
		expect(day?.count).toBe(DAILY_SIGNUP_CAP);
	});
});
