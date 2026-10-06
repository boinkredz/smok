import { defineTable } from "convex/server";
import { v } from "convex/values";

// Shift template
export const shifts = defineTable({
  nama: v.string(), // e.g. "Shift Pagi"
  jamMulai: v.string(), // "HH:MM" 24h
  jamSelesai: v.string(), // "HH:MM" 24h
  warnaTema: v.optional(v.string()), // hex color e.g. "#3B82F6"
  keterangan: v.optional(v.string()),
});

// One assignment = one officer on one shift on one date at one site
export const shiftAssignments = defineTable({
  officerId: v.id("officers"),
  shiftId: v.id("shifts"),
  siteId: v.optional(v.id("sites")),
  tanggal: v.string(), // "YYYY-MM-DD"
  lokasiTugas: v.optional(v.string()), // legacy field, kept for backward compat
  catatan: v.optional(v.string()),
})
  .index("by_officer_date", ["officerId", "tanggal"])
  .index("by_date", ["tanggal"])
  .index("by_site_date", ["siteId", "tanggal"])
  .index("by_shift", ["shiftId"]);

export const shiftSwapRequests = defineTable({
  requesterId: v.id("officers"),
  targetId: v.id("officers"),
  requesterAssignmentId: v.id("shiftAssignments"),
  targetAssignmentId: v.id("shiftAssignments"),
  status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  approvedBy: v.optional(v.id("users")),
  alasan: v.optional(v.string()),
  tanggalRequest: v.string(), // ISO 8601 UTC
})
  .index("by_status", ["status"])
  .index("by_requester", ["requesterId"])
  .index("by_target", ["targetId"]);

export const cutiRequests = defineTable({
  officerId: v.id("officers"),
  jenis: v.union(v.literal("cuti"), v.literal("sakit")),
  tanggalMulai: v.string(), // YYYY-MM-DD
  tanggalSelesai: v.string(), // YYYY-MM-DD
  alasan: v.string(),
  suratSakit: v.optional(v.string()), // Convex storage ID
  status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  approvedBy: v.optional(v.id("users")),
  catatan: v.optional(v.string()),
  createdBy: v.id("users"),
})
  .index("by_officer", ["officerId"])
  .index("by_status", ["status"])
  .index("by_officer_year", ["officerId", "tanggalMulai"]);

export const cutiBalance = defineTable({
  officerId: v.id("officers"),
  tahun: v.number(),
  jatahTotal: v.number(),
  terpakai: v.number(),
  sisa: v.number(),
}).index("by_officer_year", ["officerId", "tahun"]);

export const absensiStatusValidator = v.union(
  v.literal("hadir"),
  v.literal("terlambat"),
  v.literal("izin"),
  v.literal("sakit"),
  v.literal("alpha"),
);

// Attendance record linked to an assignment
export const absensi = defineTable({
  assignmentId: v.id("shiftAssignments"),
  officerId: v.id("officers"),
  siteId: v.optional(v.id("sites")),
  tanggal: v.string(), // "YYYY-MM-DD"
  waktuMasuk: v.optional(v.string()), // ISO 8601 UTC
  waktuKeluar: v.optional(v.string()), // ISO 8601 UTC
  lokasiMasuk: v.optional(
    v.object({ lat: v.number(), lng: v.number(), alamat: v.optional(v.string()) }),
  ),
  lokasiKeluar: v.optional(
    v.object({ lat: v.number(), lng: v.number(), alamat: v.optional(v.string()) }),
  ),
  fotoMasuk: v.optional(v.string()), // Convex storage ID or URL
  fotoKeluar: v.optional(v.string()),
  status: absensiStatusValidator,
  keterlambatanMenit: v.optional(v.number()),
  isLate: v.optional(v.boolean()),
  keterangan: v.optional(v.string()),
  dicatatOleh: v.optional(v.id("users")),
})
  .index("by_officer_date", ["officerId", "tanggal"])
  .index("by_assignment", ["assignmentId"])
  .index("by_date", ["tanggal"])
  .index("by_site_date", ["siteId", "tanggal"]);
