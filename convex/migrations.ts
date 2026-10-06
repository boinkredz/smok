import { internalMutation } from "./_generated/server";

/**
 * One-time migration: convert old "petugas" role to "anggota"
 * Run this once after deploying the new role system.
 */
export const migratePetugasToAnggota = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let migrated = 0;
    for (const user of users) {
      if ((user.role as string) === "petugas") {
        await ctx.db.patch(user._id, { role: "anggota" });
        migrated++;
      }
    }
    return { migrated };
  },
});
