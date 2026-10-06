import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { requireRole, requireUser, roleOf } from "./lib/auth";
import {
  jenisInsidenValidator,
  lampiranValidator,
  ttdValidator,
  cekFisikItemValidator,
  cekPeralatanItemValidator,
} from "./schema/insiden";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve lampiran storage IDs to URLs */
async function resolveLampiran(
  ctx: { storage: { getUrl: (id: string) => Promise<string | null> } },
  lampiran: Array<{ storageId: string; keterangan: string }>,
) {
  return Promise.all(
    lampiran.map(async (item) => {
      const url = await ctx.storage.getUrl(item.storageId);
      return { ...item, url };
    }),
  );
}

/** Resolve TTD storage ID to URL */
async function resolveTtd(
  ctx: { storage: { getUrl: (id: string) => Promise<string | null> } },
  ttd?: { storageId: string },
): Promise<string | null> {
  if (!ttd) return null;
  return await ctx.storage.getUrl(ttd.storageId);
}

/** Format counter to "BA-001" */
function formatNomorBA(counter: number): string {
  return `BA-${String(counter).padStart(3, "0")}`;
}

// ─── File Upload ──────────────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ─── Berita Acara ─────────────────────────────────────────────────────────────

export const createBeritaAcara = mutation({
  args: {
    siteId: v.optional(v.id("sites")),
    lokasiGedung: v.string(),
    tanggal: v.string(),
    waktu: v.string(),
    jenisInsiden: jenisInsidenValidator,
    lokasiDetail: v.string(),
    kronologi: v.string(),
    tindakan: v.string(),
    hasilTindakan: v.string(),
    petugasNama: v.string(),
    petugasJabatan: v.string(),
    ttdPetugas: v.optional(ttdValidator),
    atasanNama: v.optional(v.string()),
    atasanJabatan: v.optional(v.string()),
    ttdAtasan: v.optional(ttdValidator),
    ketahuiNama: v.optional(v.string()),
    ketahuiJabatan: v.optional(v.string()),
    ttdKetahui: v.optional(ttdValidator),
    tempatTtd: v.string(),
    lampiran: v.array(lampiranValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get or create counter
    const existing = await ctx.db.query("baCounter").first();
    let nextCounter: number;

    if (existing) {
      nextCounter = existing.counter + 1;
      await ctx.db.patch(existing._id, { counter: nextCounter });
    } else {
      nextCounter = 1;
      await ctx.db.insert("baCounter", { counter: 1 });
    }

    const nomorBA = formatNomorBA(nextCounter);

    const baId = await ctx.db.insert("beritaAcara", {
      nomorBA,
      siteId: args.siteId,
      lokasiGedung: args.lokasiGedung,
      tanggal: args.tanggal,
      waktu: args.waktu,
      jenisInsiden: args.jenisInsiden,
      lokasiDetail: args.lokasiDetail,
      kronologi: args.kronologi,
      tindakan: args.tindakan,
      hasilTindakan: args.hasilTindakan,
      petugasNama: args.petugasNama,
      petugasJabatan: args.petugasJabatan,
      ttdPetugas: args.ttdPetugas,
      atasanNama: args.atasanNama,
      atasanJabatan: args.atasanJabatan,
      ttdAtasan: args.ttdAtasan,
      ketahuiNama: args.ketahuiNama,
      ketahuiJabatan: args.ketahuiJabatan,
      ttdKetahui: args.ttdKetahui,
      tempatTtd: args.tempatTtd,
      lampiran: args.lampiran,
      createdBy: user._id,
    });

    return baId;
  },
});

export const deleteBeritaAcara = mutation({
  args: { baId: v.id("beritaAcara") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const ba = await ctx.db.get(args.baId);
    if (!ba) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Berita Acara tidak ditemukan",
      });
    }

    await ctx.db.delete(args.baId);
  },
});

export const listBeritaAcara = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const role = roleOf(user);

    let results;
    if (role === "admin" || role === "supervisor") {
      results = await ctx.db
        .query("beritaAcara")
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      // danru/anggota only see their own
      results = await ctx.db
        .query("beritaAcara")
        .withIndex("by_created", (q) => q.eq("createdBy", user._id))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return {
      ...results,
      page: await Promise.all(
        results.page.map(async (ba) => {
          const lampiranWithUrls = await resolveLampiran(ctx, ba.lampiran);
          const site = ba.siteId ? await ctx.db.get(ba.siteId) : null;
          return {
            ...ba,
            lampiran: lampiranWithUrls,
            site: site
              ? { _id: site._id, nama: site.nama }
              : null,
          };
        }),
      ),
    };
  },
});

export const getBeritaAcara = query({
  args: { baId: v.id("beritaAcara") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const role = roleOf(user);

    const ba = await ctx.db.get(args.baId);
    if (!ba) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Berita Acara tidak ditemukan",
      });
    }

    // Access check: non-admin/supervisor can only view own
    if (role !== "admin" && role !== "supervisor" && ba.createdBy !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin melihat Berita Acara ini",
      });
    }

    const lampiranWithUrls = await resolveLampiran(ctx, ba.lampiran);
    const site = ba.siteId ? await ctx.db.get(ba.siteId) : null;
    const ttdPetugasUrl = await resolveTtd(ctx, ba.ttdPetugas);
    const ttdAtasanUrl = await resolveTtd(ctx, ba.ttdAtasan);
    const ttdKetahuiUrl = await resolveTtd(ctx, ba.ttdKetahui);

    return {
      ...ba,
      lampiran: lampiranWithUrls,
      site: site ? { _id: site._id, nama: site.nama } : null,
      ttdPetugasUrl,
      ttdAtasanUrl,
      ttdKetahuiUrl,
    };
  },
});

// ─── Laporan Harian ───────────────────────────────────────────────────────────

export const createLaporanHarian = mutation({
  args: {
    siteId: v.optional(v.id("sites")),
    tanggal: v.string(),
    shift: v.string(),
    namaPembuat: v.string(),
    jabatanPembuat: v.string(),
    namaAtasan: v.optional(v.string()),
    jabatanAtasan: v.optional(v.string()),
    lokasiGedung: v.string(),
    personilHarusnya: v.number(),
    personilHadir: v.number(),
    statusKehadiran: v.union(v.literal("lengkap"), v.literal("tidak_lengkap")),
    adaTerlambat: v.boolean(),
    detailTerlambat: v.optional(v.string()),
    adaAbsen: v.boolean(),
    detailAbsen: v.optional(v.string()),
    detailBackup: v.optional(v.string()),
    cekFisik: v.array(cekFisikItemValidator),
    cekPeralatan: v.array(cekPeralatanItemValidator),
    adaDinamika: v.boolean(),
    dinamika: v.optional(v.string()),
    adaInfoRegu: v.boolean(),
    detailInfoRegu: v.optional(v.string()),
    adaEskalasi: v.boolean(),
    detailEskalasi: v.optional(v.string()),
    lampiran: v.array(lampiranValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "supervisor", "danru"]);

    const laporanId = await ctx.db.insert("laporanHarian", {
      siteId: args.siteId,
      tanggal: args.tanggal,
      shift: args.shift,
      namaPembuat: args.namaPembuat,
      jabatanPembuat: args.jabatanPembuat,
      namaAtasan: args.namaAtasan,
      jabatanAtasan: args.jabatanAtasan,
      lokasiGedung: args.lokasiGedung,
      personilHarusnya: args.personilHarusnya,
      personilHadir: args.personilHadir,
      statusKehadiran: args.statusKehadiran,
      adaTerlambat: args.adaTerlambat,
      detailTerlambat: args.detailTerlambat,
      adaAbsen: args.adaAbsen,
      detailAbsen: args.detailAbsen,
      detailBackup: args.detailBackup,
      cekFisik: args.cekFisik,
      cekPeralatan: args.cekPeralatan,
      adaDinamika: args.adaDinamika,
      dinamika: args.dinamika,
      adaInfoRegu: args.adaInfoRegu,
      detailInfoRegu: args.detailInfoRegu,
      adaEskalasi: args.adaEskalasi,
      detailEskalasi: args.detailEskalasi,
      lampiran: args.lampiran,
      createdBy: user._id,
    });

    return laporanId;
  },
});

export const deleteLaporanHarian = mutation({
  args: { laporanId: v.id("laporanHarian") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const laporan = await ctx.db.get(args.laporanId);
    if (!laporan) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Laporan Harian tidak ditemukan",
      });
    }

    await ctx.db.delete(args.laporanId);
  },
});

export const listLaporanHarian = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const role = roleOf(user);

    let results;
    if (role === "admin" || role === "supervisor") {
      results = await ctx.db
        .query("laporanHarian")
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      // danru/anggota only see their own
      results = await ctx.db
        .query("laporanHarian")
        .withIndex("by_created", (q) => q.eq("createdBy", user._id))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return {
      ...results,
      page: await Promise.all(
        results.page.map(async (laporan) => {
          const lampiranWithUrls = await resolveLampiran(ctx, laporan.lampiran);
          const site = laporan.siteId
            ? await ctx.db.get(laporan.siteId)
            : null;
          return {
            ...laporan,
            lampiran: lampiranWithUrls,
            site: site
              ? { _id: site._id, nama: site.nama }
              : null,
          };
        }),
      ),
    };
  },
});

export const getLaporanHarian = query({
  args: { laporanId: v.id("laporanHarian") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const role = roleOf(user);

    const laporan = await ctx.db.get(args.laporanId);
    if (!laporan) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Laporan Harian tidak ditemukan",
      });
    }

    // Access check: non-admin/supervisor can only view own
    if (
      role !== "admin" &&
      role !== "supervisor" &&
      laporan.createdBy !== user._id
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin melihat Laporan ini",
      });
    }

    const lampiranWithUrls = await resolveLampiran(ctx, laporan.lampiran);
    const site = laporan.siteId ? await ctx.db.get(laporan.siteId) : null;

    return {
      ...laporan,
      lampiran: lampiranWithUrls,
      site: site ? { _id: site._id, nama: site.nama } : null,
    };
  },
});
