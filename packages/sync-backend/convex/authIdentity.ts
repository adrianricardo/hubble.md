import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function currentActorName(
	ctx: MutationCtx | QueryCtx,
	fallback?: string,
): Promise<string | undefined> {
	const userId = await getAuthUserId(ctx);
	if (!userId) return fallback;
	const user = await ctx.db.get(userId);
	return user?.name ?? user?.email ?? fallback;
}
