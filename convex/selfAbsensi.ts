import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

// ─── Profile Photo Enrollment ────────────────────────────────────────────────

export const saveProfilePhoto = mutation({
  args: {
    photoStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data petugas tidak ditemukan. Hubungi admin." });
    }
    await ctx.db.patch(officer._id, {
      faceDescriptors: args.photoStorageId,
      faceEnrolledAt: new Date().toISOString(),
    });
    return null;
  },
});

export const clearFaceEnrollment = mutation({
  args: { officerId: v.id("officers") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db.get(args.officerId);
    if (!officer) throw new ConvexError({ code: "NOT_FOUND", message: "Petugas tidak ditemukan" });
    if (officer.userId !== user._id) {
      const isManager = user.role === "admin" || user.role === "supervisor";
      if (!isManager) throw new ConvexError({ code: "FORBIDDEN", message: "Akses ditolak" });
    }
    await ctx.db.patch(args.officerId, { faceDescriptors: undefined, faceEnrolledAt: undefined });
    return null;
  },
});

// ─── Self-Attendance ──────────────────────────────────────────────────────────

// Upload URL for foto absensi
export const generateAbsensiUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Get my today assignment + absensi
export const getMyTodayAssignment = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) return null;

    const today = new Date().toISOString().slice(0, 10);
    const assignment = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_officer_date", (q) => q.eq("officerId", officer._id).eq("tanggal", today))
      .first();
    if (!assignment) return { officer, assignment: null, shift: null, absensi: null };

    const [shift, absensiRecord] = await Promise.all([
      ctx.db.get(assignment.shiftId),
      ctx.db
        .query("absensi")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
        .first(),
    ]);

    // Resolve foto URLs
    let fotoMasukUrl: string | null = null;
    let fotoKeluarUrl: string | null = null;
    if (absensiRecord?.fotoMasuk) {
      fotoMasukUrl = await ctx.storage.getUrl(absensiRecord.fotoMasuk as `${string}`).catch(() => null);
    }
    if (absensiRecord?.fotoKeluar) {
      fotoKeluarUrl = await ctx.storage.getUrl(absensiRecord.fotoKeluar as `${string}`).catch(() => null);
    }

    // Resolve profile photo URL
    let profilePhotoUrl: string | null = null;
    if (officer.faceDescriptors) {
      profilePhotoUrl = await ctx.storage.getUrl(officer.faceDescriptors as `${string}`).catch(() => null);
    }

    return {
      officer: { ...officer, profilePhotoUrl },
      assignment,
      shift,
      absensi: absensiRecord ? { ...absensiRecord, fotoMasukUrl, fotoKeluarUrl } : null,
    };
  },
});

// Geofence validation helper (server-side Haversine)
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Self check-in
export const selfCheckIn = mutation({
  args: {
    lat: v.number(),
    lng: v.number(),
    fotoStorageId: v.optional(v.string()),
    tanggal: v.string(), // "YYYY-MM-DD"
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) throw new ConvexError({ code: "NOT_FOUND", message: "Data petugas tidak ditemukan" });

    const assignment = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_officer_date", (q) => q.eq("officerId", officer._id).eq("tanggal", args.tanggal))
      .first();
    if (!assignment) throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ada jadwal untuk hari ini" });

    // Check no existing check-in
    const existing = await ctx.db
      .query("absensi")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .first();
    if (existing?.waktuMasuk) throw new ConvexError({ code: "CONFLICT", message: "Sudah absen masuk" });

    // Geofence check
    if (assignment.siteId) {
      const fences = await ctx.db
        .query("geoFence")
        .withIndex("by_site_aktif", (q) => q.eq("siteId", assignment.siteId!).eq("aktif", true))
        .collect();
      if (fences.length > 0) {
        const inZone = fences.some(
          (f) => haversineMeters(args.lat, args.lng, f.lat, f.lng) <= f.radius,
        );
        if (!inZone) {
          throw new ConvexError({ code: "FORBIDDEN", message: "Anda berada di luar zona lokasi kerja" });
        }
      }
    }

    // Determine status based on shift jam mulai
    const shift = await ctx.db.get(assignment.shiftId);
    const now = new Date();
    const nowIso = now.toISOString();
    let status: "hadir" | "terlambat" = "hadir";
    let keterlambatanMenit = 0;

    if (shift) {
      const [jamH, jamM] = shift.jamMulai.split(":").map(Number);
      const shiftStart = new Date(args.tanggal);
      shiftStart.setUTCHours(jamH - 7, jamM, 0, 0); // assume WIB offset
      const diffMs = now.getTime() - shiftStart.getTime();
      const toleransiMs = 15 * 60 * 1000;
      if (diffMs > toleransiMs) {
        status = "terlambat";
        keterlambatanMenit = Math.round(diffMs / 60000);
      }
    }

    const fotoMasuk = args.fotoStorageId ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        waktuMasuk: nowIso,
        lokasiMasuk: { lat: args.lat, lng: args.lng },
        fotoMasuk,
        status,
        keterlambatanMenit,
        isLate: status === "terlambat",
        dicatatOleh: user._id,
      });
    } else {
      await ctx.db.insert("absensi", {
        assignmentId: assignment._id,
        officerId: officer._id,
        siteId: assignment.siteId,
        tanggal: args.tanggal,
        waktuMasuk: nowIso,
        lokasiMasuk: { lat: args.lat, lng: args.lng },
        fotoMasuk,
        status,
        keterlambatanMenit,
        isLate: status === "terlambat",
        dicatatOleh: user._id,
      });
    }
    return { status, keterlambatanMenit };
  },
});

// Self check-out
export const selfCheckOut = mutation({
  args: {
    lat: v.number(),
    lng: v.number(),
    fotoStorageId: v.optional(v.string()),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const officer = await ctx.db
      .query("officers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!officer) throw new ConvexError({ code: "NOT_FOUND", message: "Data petugas tidak ditemukan" });

    const assignment = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_officer_date", (q) => q.eq("officerId", officer._id).eq("tanggal", args.tanggal))
      .first();
    if (!assignment) throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ada jadwal" });

    const absensiRecord = await ctx.db
      .query("absensi")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
      .first();
    if (!absensiRecord) throw new ConvexError({ code: "NOT_FOUND", message: "Belum absen masuk" });
    if (absensiRecord.waktuKeluar) throw new ConvexError({ code: "CONFLICT", message: "Sudah absen keluar" });

    // Geofence check
    if (assignment.siteId) {
      const fences = await ctx.db
        .query("geoFence")
        .withIndex("by_site_aktif", (q) => q.eq("siteId", assignment.siteId!).eq("aktif", true))
        .collect();
      if (fences.length > 0) {
        const inZone = fences.some(
          (f) => haversineMeters(args.lat, args.lng, f.lat, f.lng) <= f.radius,
        );
        if (!inZone) {
          throw new ConvexError({ code: "FORBIDDEN", message: "Anda berada di luar zona lokasi kerja" });
        }
      }
    }

    await ctx.db.patch(absensiRecord._id, {
      waktuKeluar: new Date().toISOString(),
      lokasiKeluar: { lat: args.lat, lng: args.lng },
      fotoKeluar: args.fotoStorageId ?? undefined,
    });
    return null;
  },
});
