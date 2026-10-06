import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./lib/auth";

// ─── Shift Templates ─────────────────────────────────────────────────────────

export const listShifts = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("shifts").collect();
  },
});

export const createShift = mutation({
  args: {
    nama: v.string(),
    jamMulai: v.string(),
    jamSelesai: v.string(),
    warnaTema: v.optional(v.string()),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    return await ctx.db.insert("shifts", args);
  },
});

export const updateShift = mutation({
  args: {
    shiftId: v.id("shifts"),
    nama: v.string(),
    jamMulai: v.string(),
    jamSelesai: v.string(),
    warnaTema: v.optional(v.string()),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const { shiftId, ...fields } = args;
    const shift = await ctx.db.get(shiftId);
    if (!shift) throw new ConvexError({ code: "NOT_FOUND", message: "Shift tidak ditemukan" });
    await ctx.db.patch(shiftId, fields);
    return null;
  },
});

export const deleteShift = mutation({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    await ctx.db.delete(args.shiftId);
    return null;
  },
});

// ─── Shift Assignments ────────────────────────────────────────────────────────

export const listAssignments = query({
  args: { tanggal: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const assignments = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_date", (q) => q.eq("tanggal", args.tanggal))
      .collect();

    return await Promise.all(
      assignments.map(async (a) => {
        const [officer, shift, site] = await Promise.all([
          ctx.db.get(a.officerId),
          ctx.db.get(a.shiftId),
          a.siteId ? ctx.db.get(a.siteId) : null,
        ]);
        const absensiRecord = await ctx.db
          .query("absensi")
          .withIndex("by_assignment", (q) => q.eq("assignmentId", a._id))
          .first();

        // Resolve photo URLs
        let fotoMasukUrl: string | null = null;
        let fotoKeluarUrl: string | null = null;
        if (absensiRecord?.fotoMasuk) {
          fotoMasukUrl = await ctx.storage.getUrl(absensiRecord.fotoMasuk as `${string}`).catch(() => null);
        }
        if (absensiRecord?.fotoKeluar) {
          fotoKeluarUrl = await ctx.storage.getUrl(absensiRecord.fotoKeluar as `${string}`).catch(() => null);
        }

        return {
          ...a,
          officer,
          shift,
          site,
          absensi: absensiRecord
            ? { ...absensiRecord, fotoMasukUrl, fotoKeluarUrl }
            : null,
        };
      }),
    );
  },
});

// Assignments for a calendar week/month range
export const listAssignmentsRange = query({
  args: {
    tanggalMulai: v.string(), // "YYYY-MM-DD"
    tanggalSelesai: v.string(),
    siteId: v.optional(v.id("sites")),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let assignments;
    if (args.siteId) {
      assignments = await ctx.db
        .query("shiftAssignments")
        .withIndex("by_site_date", (q) =>
          q
            .eq("siteId", args.siteId)
            .gte("tanggal", args.tanggalMulai)
            .lte("tanggal", args.tanggalSelesai),
        )
        .collect();
    } else {
      assignments = await ctx.db
        .query("shiftAssignments")
        .withIndex("by_date", (q) =>
          q.gte("tanggal", args.tanggalMulai).lte("tanggal", args.tanggalSelesai),
        )
        .collect();
    }

    return await Promise.all(
      assignments.map(async (a) => {
        const [officer, shift] = await Promise.all([
          ctx.db.get(a.officerId),
          ctx.db.get(a.shiftId),
        ]);
        return { ...a, officer, shift };
      }),
    );
  },
});

export const createAssignment = mutation({
  args: {
    officerId: v.id("officers"),
    shiftId: v.id("shifts"),
    siteId: v.optional(v.id("sites")),
    tanggal: v.string(),
    catatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const existing = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_officer_date", (q) =>
        q.eq("officerId", args.officerId).eq("tanggal", args.tanggal),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Petugas sudah dijadwalkan pada tanggal ini",
      });
    }
    return await ctx.db.insert("shiftAssignments", args);
  },
});

export const updateAssignment = mutation({
  args: {
    assignmentId: v.id("shiftAssignments"),
    shiftId: v.id("shifts"),
    siteId: v.optional(v.id("sites")),
    catatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    const { assignmentId, ...fields } = args;
    await ctx.db.patch(assignmentId, fields);
    return null;
  },
});

export const deleteAssignment = mutation({
  args: { assignmentId: v.id("shiftAssignments") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "supervisor"]);
    await ctx.db.delete(args.assignmentId);
    return null;
  },
});

// ─── Absensi ──────────────────────────────────────────────────────────────────

// Generate upload URL for selfie photo
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const recordAbsensi = mutation({
  args: {
    assignmentId: v.id("shiftAssignments"),
    waktuMasuk: v.optional(v.string()),
    waktuKeluar: v.optional(v.string()),
    lokasiMasuk: v.optional(
      v.object({ lat: v.number(), lng: v.number(), alamat: v.optional(v.string()) }),
    ),
    lokasiKeluar: v.optional(
      v.object({ lat: v.number(), lng: v.number(), alamat: v.optional(v.string()) }),
    ),
    fotoMasuk: v.optional(v.string()), // Convex storage ID
    fotoKeluar: v.optional(v.string()),
    status: v.union(
      v.literal("hadir"),
      v.literal("terlambat"),
      v.literal("izin"),
      v.literal("sakit"),
      v.literal("alpha"),
    ),
    keterlambatanMenit: v.optional(v.number()),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "supervisor"]);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Jadwal tidak ditemukan" });
    }

    // Auto-detect lateness
    const isLate = args.status === "terlambat" || (args.keterlambatanMenit ?? 0) > 0;

    const payload = {
      waktuMasuk: args.waktuMasuk,
      waktuKeluar: args.waktuKeluar,
      lokasiMasuk: args.lokasiMasuk,
      lokasiKeluar: args.lokasiKeluar,
      fotoMasuk: args.fotoMasuk,
      fotoKeluar: args.fotoKeluar,
      status: args.status,
      keterlambatanMenit: args.keterlambatanMenit,
      isLate,
      keterangan: args.keterangan,
      dicatatOleh: user._id,
    };

    const existing = await ctx.db
      .query("absensi")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("absensi", {
      assignmentId: args.assignmentId,
      officerId: assignment.officerId,
      siteId: assignment.siteId,
      tanggal: assignment.tanggal,
      ...payload,
    });
  },
});

export const absensiStatsForDate = query({
  args: { tanggal: v.string(), siteId: v.optional(v.id("sites")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // Count assignments scheduled for this date (optionally filtered by site)
    const allAssignments = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_date", (q) =>
        q.eq("tanggal", args.tanggal),
      )
      .collect();

    const assignments = args.siteId
      ? allAssignments.filter((a) => a.siteId === args.siteId)
      : allAssignments;

    // Count absensi records for this date
    const absensiRecords = args.siteId
      ? await ctx.db
          .query("absensi")
          .withIndex("by_site_date", (q) =>
            q.eq("siteId", args.siteId).eq("tanggal", args.tanggal),
          )
          .collect()
      : await ctx.db
          .query("absensi")
          .withIndex("by_date", (q) => q.eq("tanggal", args.tanggal))
          .collect();

    const hadir = absensiRecords.filter(
      (r) => r.status === "hadir" || r.status === "terlambat",
    ).length;

    return {
      personilHarusnya: assignments.length,
      personilHadir: hadir,
      statusKehadiran:
        hadir >= assignments.length ? "lengkap" : ("tidak_lengkap" as const),
    };
  },
});

export const absensiStats = query({
  args: { bulan: v.string() }, // "YYYY-MM"
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const start = args.bulan + "-01";
    const end = args.bulan + "-31";
    const records = await ctx.db
      .query("absensi")
      .withIndex("by_date", (q) => q.gte("tanggal", start).lte("tanggal", end))
      .collect();
    return {
      total: records.length,
      hadir: records.filter((r) => r.status === "hadir").length,
      terlambat: records.filter((r) => r.status === "terlambat").length,
      izin: records.filter((r) => r.status === "izin").length,
      sakit: records.filter((r) => r.status === "sakit").length,
      alpha: records.filter((r) => r.status === "alpha").length,
    };
  },
});

// ─── Generate Schedule ────────────────────────────────────────────────────

export const generateSchedule = mutation({
  args: {
    officerIds: v.array(v.id("officers")),
    shiftId: v.id("shifts"),
    siteId: v.optional(v.id("sites")),
    tanggalMulai: v.string(), // YYYY-MM-DD
    tanggalSelesai: v.string(), // YYYY-MM-DD
    pola: v.union(
      v.literal("setiap_hari"),
      v.literal("senin_jumat"),
      v.literal("senin_sabtu"),
    ),
    liburPerSiklus: v.optional(v.number()), // e.g. 1 = 1 day off per cycle
    siklus: v.optional(v.number()), // e.g. 4 = every 4 days
  },
  handler: async (ctx, args): Promise<{ created: number; skipped: number }> => {
    await requireRole(ctx, ["admin", "supervisor"]);

    const start = new Date(args.tanggalMulai + "T12:00:00Z");
    const end = new Date(args.tanggalSelesai + "T12:00:00Z");

    let created = 0;
    let skipped = 0;

    // For each officer, iterate dates
    for (const officerId of args.officerIds) {
      let cycleDay = 0; // for siklus pola
      const cur = new Date(start);
      while (cur <= end) {
        const tanggal =
          cur.getUTCFullYear() +
          "-" +
          String(cur.getUTCMonth() + 1).padStart(2, "0") +
          "-" +
          String(cur.getUTCDate()).padStart(2, "0");

        const dayOfWeek = cur.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
        let shouldWork = true;

        if (args.pola === "senin_jumat") {
          shouldWork = dayOfWeek >= 1 && dayOfWeek <= 5;
        } else if (args.pola === "senin_sabtu") {
          shouldWork = dayOfWeek >= 1 && dayOfWeek <= 6;
        } else if (args.pola === "setiap_hari" && args.siklus && args.liburPerSiklus) {
          // e.g. siklus=4, liburPerSiklus=1 => work 3 days, rest 1
          const workDays = args.siklus - args.liburPerSiklus;
          shouldWork = cycleDay < workDays;
        }

        if (shouldWork) {
          const existing = await ctx.db
            .query("shiftAssignments")
            .withIndex("by_officer_date", (q) =>
              q.eq("officerId", officerId).eq("tanggal", tanggal),
            )
            .first();

          if (existing) {
            skipped++;
          } else {
            await ctx.db.insert("shiftAssignments", {
              officerId,
              shiftId: args.shiftId,
              siteId: args.siteId,
              tanggal,
            });
            created++;
          }
        }

        // Advance cycle counter if using siklus pola
        if (args.pola === "setiap_hari" && args.siklus) {
          cycleDay = (cycleDay + 1) % args.siklus;
        }

        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    return { created, skipped };
  },
});

// Preview - count how many assignments would be created (without actually creating)
export const previewSchedule = mutation({
  args: {
    officerIds: v.array(v.id("officers")),
    shiftId: v.id("shifts"),
    tanggalMulai: v.string(),
    tanggalSelesai: v.string(),
    pola: v.union(
      v.literal("setiap_hari"),
      v.literal("senin_jumat"),
      v.literal("senin_sabtu"),
    ),
    liburPerSiklus: v.optional(v.number()),
    siklus: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ willCreate: number; willSkip: number }> => {
    await requireRole(ctx, ["admin", "supervisor"]);

    const start = new Date(args.tanggalMulai + "T12:00:00Z");
    const end = new Date(args.tanggalSelesai + "T12:00:00Z");

    let willCreate = 0;
    let willSkip = 0;

    for (const officerId of args.officerIds) {
      let cycleDay = 0;
      const cur = new Date(start);
      while (cur <= end) {
        const tanggal =
          cur.getUTCFullYear() +
          "-" +
          String(cur.getUTCMonth() + 1).padStart(2, "0") +
          "-" +
          String(cur.getUTCDate()).padStart(2, "0");

        const dayOfWeek = cur.getUTCDay();
        let shouldWork = true;

        if (args.pola === "senin_jumat") {
          shouldWork = dayOfWeek >= 1 && dayOfWeek <= 5;
        } else if (args.pola === "senin_sabtu") {
          shouldWork = dayOfWeek >= 1 && dayOfWeek <= 6;
        } else if (args.pola === "setiap_hari" && args.siklus && args.liburPerSiklus) {
          const workDays = args.siklus - args.liburPerSiklus;
          shouldWork = cycleDay < workDays;
        }

        if (shouldWork) {
          const existing = await ctx.db
            .query("shiftAssignments")
            .withIndex("by_officer_date", (q) =>
              q.eq("officerId", officerId).eq("tanggal", tanggal),
            )
            .first();
          if (existing) willSkip++;
          else willCreate++;
        }

        if (args.pola === "setiap_hari" && args.siklus) {
          cycleDay = (cycleDay + 1) % args.siklus;
        }

        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    return { willCreate, willSkip };
  },
});

// ─── Shift Swap ───────────────────────────────────────────────────────────

export const requestShiftSwap = mutation({
  args: {
    requesterAssignmentId: v.id("shiftAssignments"),
    targetAssignmentId: v.id("shiftAssignments"),
    alasan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) throw new ConvexError({ code: "NOT_FOUND", message: "Data petugas tidak ditemukan" });

    const reqAssignment = await ctx.db.get(args.requesterAssignmentId);
    const tgtAssignment = await ctx.db.get(args.targetAssignmentId);
    
    if (!reqAssignment || !tgtAssignment) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Jadwal tidak ditemukan" });
    }

    if (reqAssignment.officerId !== officer._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Jadwal yang dipilih bukan milik Anda",
      });
    }

    if (reqAssignment._id === tgtAssignment._id) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jadwal asal dan tujuan tidak boleh sama",
      });
    }

    return await ctx.db.insert("shiftSwapRequests", {
      requesterId: officer._id,
      targetId: tgtAssignment.officerId,
      requesterAssignmentId: args.requesterAssignmentId,
      targetAssignmentId: args.targetAssignmentId,
      status: "pending",
      alasan: args.alasan,
      tanggalRequest: new Date().toISOString(),
    });
  },
});

export const approveShiftSwap = mutation({
  args: { swapId: v.id("shiftSwapRequests") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "supervisor"]);
    const swap = await ctx.db.get(args.swapId);
    if (!swap) throw new ConvexError({ code: "NOT_FOUND", message: "Permintaan tidak ditemukan" });

    // Swap the officerIds between the two assignments
    const reqA = await ctx.db.get(swap.requesterAssignmentId);
    const tgtA = await ctx.db.get(swap.targetAssignmentId);
    if (!reqA || !tgtA) throw new ConvexError({ code: "NOT_FOUND", message: "Jadwal tidak ditemukan" });

    await ctx.db.patch(swap.requesterAssignmentId, { officerId: tgtA.officerId });
    await ctx.db.patch(swap.targetAssignmentId, { officerId: reqA.officerId });
    await ctx.db.patch(args.swapId, { status: "approved", approvedBy: user._id });
  },
});

export const rejectShiftSwap = mutation({
  args: { swapId: v.id("shiftSwapRequests"), catatan: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "supervisor"]);
    await ctx.db.patch(args.swapId, {
  status: "rejected",
  approvedBy: user._id,
});
  },
});

export const listSwapRequests = query({
  args: { status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let list;
    if (args.status) {
      const status = args.status;
      list = await ctx.db
        .query("shiftSwapRequests")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(100);
    } else {
      list = await ctx.db.query("shiftSwapRequests").order("desc").take(100);
    }

    return await Promise.all(
      list.map(async (s) => {
        const requester = await ctx.db.get(s.requesterId);
        const target = await ctx.db.get(s.targetId);
        const reqA = await ctx.db.get(s.requesterAssignmentId);
        const tgtA = await ctx.db.get(s.targetAssignmentId);
        const reqShift = reqA?.shiftId ? await ctx.db.get(reqA.shiftId) : null;
        const tgtShift = tgtA?.shiftId ? await ctx.db.get(tgtA.shiftId) : null;
        return {
          ...s,
          requesterNama: requester?.nama,
          targetNama: target?.nama,
          requesterTanggal: reqA?.tanggal,
          targetTanggal: tgtA?.tanggal,
          requesterShiftNama: reqShift?.nama,
          targetShiftNama: tgtShift?.nama,
        };
      }),
    );
  },
});

export const getMySwapRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) return [];

    const asSelf = await ctx.db
      .query("shiftSwapRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", officer._id))
      .order("desc")
      .take(50);
    const asTarget = await ctx.db
      .query("shiftSwapRequests")
      .withIndex("by_target", (q) => q.eq("targetId", officer._id))
      .order("desc")
      .take(50);

    const combined = [...asSelf, ...asTarget].sort(
      (a, b) => b._creationTime - a._creationTime,
    );

    return await Promise.all(
      combined.slice(0, 50).map(async (s) => {
        const requester = await ctx.db.get(s.requesterId);
        const target = await ctx.db.get(s.targetId);
        const reqA = await ctx.db.get(s.requesterAssignmentId);
        const tgtA = await ctx.db.get(s.targetAssignmentId);
        const reqShift = reqA?.shiftId ? await ctx.db.get(reqA.shiftId) : null;
        const tgtShift = tgtA?.shiftId ? await ctx.db.get(tgtA.shiftId) : null;
        return {
          ...s,
          requesterNama: requester?.nama,
          targetNama: target?.nama,
          requesterTanggal: reqA?.tanggal,
          targetTanggal: tgtA?.tanggal,
          requesterShiftNama: reqShift?.nama,
          targetShiftNama: tgtShift?.nama,
        };
      }),
    );
  },
});

// Get assignments for a specific officer in a date range (for swap request selection)
export const listOfficerAssignments = query({
  args: {
    officerId: v.id("officers"),
    tanggalMulai: v.string(),
    tanggalSelesai: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const list = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_officer_date", (q) =>
        q.eq("officerId", args.officerId).gte("tanggal", args.tanggalMulai),
      )
      .filter((q) => q.lte(q.field("tanggal"), args.tanggalSelesai))
      .take(100);
    return await Promise.all(
      list.map(async (a) => {
        const shift = await ctx.db.get(a.shiftId);
        return { ...a, shiftNama: shift?.nama };
      }),
    );
  },
});

// ─── Rekap Absensi ────────────────────────────────────────────────────────────

export const rekapAbsensi = query({
  args: {
    tanggalMulai: v.string(), // YYYY-MM-DD
    tanggalSelesai: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args): Promise<Array<{
    officerId: string;
    nama: string;
    jabatan: string;
    lokasiTugas: string;
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpha: number;
    total: number;
  }>> => {
    const user = await requireUser(ctx);
    const role = user.role as string;

    let officerIds: string[] | null = null; // null = all officers

    if (role === "danru") {
      const myOfficer = await ctx.db
        .query("officers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      if (myOfficer) {
        const bawahan = await ctx.db
          .query("officers")
          .withIndex("by_danru", (q) => q.eq("danruId", myOfficer._id))
          .collect();
        officerIds = [myOfficer._id, ...bawahan.map((o) => o._id)];
      } else {
        officerIds = [];
      }
    } else if (role === "supervisor") {
      const myOfficer = await ctx.db
        .query("officers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      if (myOfficer) {
        const danruList = await ctx.db
          .query("officers")
          .withIndex("by_supervisor", (q) => q.eq("supervisorId", myOfficer._id))
          .collect();
        const anggotaLists = await Promise.all(
          danruList.map((d) =>
            ctx.db
              .query("officers")
              .withIndex("by_danru", (q) => q.eq("danruId", d._id))
              .collect()
          )
        );
        const anggota = anggotaLists.flat();
        officerIds = [myOfficer._id, ...danruList.map((o) => o._id), ...anggota.map((o) => o._id)];
      } else {
        officerIds = [];
      }
    } else if (role === "anggota" || role === "finance") {
      const myOfficer = await ctx.db
        .query("officers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      officerIds = myOfficer ? [myOfficer._id] : [];
    }
    // admin, hr → officerIds = null (all)

    const records = await ctx.db
      .query("absensi")
      .withIndex("by_date", (q) =>
        q.gte("tanggal", args.tanggalMulai).lte("tanggal", args.tanggalSelesai)
      )
      .collect();

    const filtered = officerIds !== null
      ? records.filter((r) => officerIds!.includes(r.officerId))
      : records;

    const map = new Map<string, { hadir: number; terlambat: number; izin: number; sakit: number; alpha: number }>();
    for (const r of filtered) {
      const id = r.officerId;
      if (!map.has(id)) map.set(id, { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpha: 0 });
      const entry = map.get(id)!;
      if (r.status === "hadir") entry.hadir++;
      else if (r.status === "terlambat") entry.terlambat++;
      else if (r.status === "izin") entry.izin++;
      else if (r.status === "sakit") entry.sakit++;
      else if (r.status === "alpha") entry.alpha++;
    }

    const result = await Promise.all(
      Array.from(map.entries()).map(async ([officerId, counts]) => {
        const officer = await ctx.db.get(officerId as import("./_generated/dataModel").Id<"officers">);
        return {
          officerId,
          nama: officer && "nama" in officer ? officer.nama : "—",
          jabatan: officer && "jabatan" in officer ? officer.jabatan : "—",
          lokasiTugas: officer && "lokasiTugas" in officer ? officer.lokasiTugas : "—",
          ...counts,
          total: counts.hadir + counts.terlambat + counts.izin + counts.sakit + counts.alpha,
        };
      })
    );

    return result.sort((a, b) => a.nama.localeCompare(b.nama));
  },
});

