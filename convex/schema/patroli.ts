import { defineTable } from "convex/server";
import { v } from "convex/values";

export const rutePatroli = defineTable({
  nama: v.string(),
  siteId: v.optional(v.id("sites")),
  estimasiMenit: v.number(), // estimated duration in minutes
  keterangan: v.optional(v.string()),
  aktif: v.boolean(),
})
  .index("by_aktif", ["aktif"])
  .index("by_site", ["siteId"]);

export const checkpoint = defineTable({
  ruteId: v.id("rutePatroli"),
  nama: v.string(),
  urutan: v.number(),
  deskripsi: v.optional(v.string()),
  koordinat: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  qrCode: v.string(), // unique UUID string for QR scanning
})
  .index("by_rute", ["ruteId"])
  .index("by_rute_urutan", ["ruteId", "urutan"])
  .index("by_qr", ["qrCode"]);

export const patroliStatusValidator = v.union(
  v.literal("dijadwalkan"),
  v.literal("berlangsung"),
  v.literal("selesai"),
  v.literal("dibatalkan"),
);

export const tugasPatroli = defineTable({
  ruteId: v.id("rutePatroli"),
  officerId: v.id("officers"),
  siteId: v.optional(v.id("sites")),
  tanggal: v.string(),
  jamMulaiRencana: v.string(),
  jamSelesaiRencana: v.string(),
  status: patroliStatusValidator,
  waktuMulai: v.optional(v.string()),
  waktuSelesai: v.optional(v.string()),
  catatan: v.optional(v.string()),
  catatanHasil: v.optional(v.string()),
  lokasiTerakhir: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  laporanDisubmit: v.optional(v.boolean()),
})
  .index("by_officer_date", ["officerId", "tanggal"])
  .index("by_date", ["tanggal"])
  .index("by_status", ["status"]);

export const checklistPatroli = defineTable({
  tugasId: v.id("tugasPatroli"),
  checkpointId: v.id("checkpoint"),
  dikunjungi: v.boolean(),
  waktuKunjungan: v.optional(v.string()),
  lokasiKunjungan: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  temuanStatus: v.union(v.literal("normal"), v.literal("temuan"), v.literal("darurat")),
  catatan: v.optional(v.string()),
  fotoId: v.optional(v.id("_storage")),
  fotoUrl: v.optional(v.string()),
})
  .index("by_tugas", ["tugasId"])
  .index("by_tugas_checkpoint", ["tugasId", "checkpointId"]);
