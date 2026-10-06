import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Role } from "../schema/users";
import { DEVICE_LOCKED_ROLES } from "../schema/users";

export type { Role };
export { DEVICE_LOCKED_ROLES };

type AuthContext = QueryCtx | MutationCtx;

/**
 * Mengambil pengguna yang sedang login.
 *
 * Jika tidak ada identity dari provider autentikasi eksternal,
 * sistem menggunakan tokenIdentifier "local-admin" sebagai
 * identitas lokal bawaan aplikasi.
 */
export async function requireUser(
  ctx: AuthContext,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();

  const tokenIdentifier =
    identity?.tokenIdentifier?.trim() || "local-admin";

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (query) =>
      query.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();

  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message:
        `Pengguna dengan token "${tokenIdentifier}" tidak ditemukan. ` +
        `Pastikan pengguna local-admin sudah dibuat.`,
    });
  }

  return user;
}

/**
 * Mengambil role pengguna dan menangani role lama.
 */
export function roleOf(user: Doc<"users">): Role {
  const rawRole = user.role as string | undefined;

  // Kompatibilitas dengan data lama.
  if (!rawRole || rawRole === "petugas") {
    return "anggota" as Role;
  }

  return rawRole as Role;
}

/**
 * Memastikan pengguna memiliki salah satu role yang diizinkan.
 */
export async function requireRole(
  ctx: AuthContext,
  allowed: ReadonlyArray<Role>,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  const currentRole = roleOf(user);

  if (!allowed.includes(currentRole)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message:
        `Role "${currentRole}" tidak memiliki izin untuk tindakan ini.`,
    });
  }

  return user;
}

/**
 * Menentukan apakah role pengguna wajib menggunakan penguncian perangkat.
 */
export function isDeviceLocked(role: Role): boolean {
  return DEVICE_LOCKED_ROLES.includes(role);
}