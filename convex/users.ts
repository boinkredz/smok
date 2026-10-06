import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser, roleOf } from "./lib/auth";
import { roleValidator } from "./schema/users";

type AppIdentity = {
  tokenIdentifier: string;
  name: string;
  email: string;
};

async function getAppIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<AppIdentity> {
  const identity = await ctx.auth.getUserIdentity();

  return {
    tokenIdentifier: identity?.tokenIdentifier ?? "local-admin",
    name: identity?.name ?? "Administrator",
    email: identity?.email ?? "admin@local.test",
  };
}

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    const tokenIdentifier =
      identity?.tokenIdentifier ?? "local-admin";

    const name = identity?.name ?? "Administrator";
    const email = identity?.email ?? "admin@local.test";

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier),
      )
      .unique();

    if (existingUser) {
      return existingUser._id;
    }

    const anyExistingUser = await ctx.db
      .query("users")
      .first();

    return await ctx.db.insert("users", {
      tokenIdentifier,
      name,
      email,
      role: anyExistingUser === null ? "admin" : "anggota",
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    const tokenIdentifier =
      identity?.tokenIdentifier ?? "local-admin";

    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier),
      )
      .unique();
  },
});

export const getMyRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return {
      userId: user._id,
      name: user.name,
      role: roleOf(user),
    };
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);

    const users = await ctx.db.query("users").take(200);

    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: roleOf(u),
    }));
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, ["admin"]);

    if (admin._id === args.userId && args.role !== "admin") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Anda tidak dapat menurunkan peran diri sendiri",
      });
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
    });

    return null;
  },
});