import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { haversineMeter } from "../utils/geo.js";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function buildDateTime(
  tanggalAcuan: string | undefined,
  waktu: string | null | undefined
): Date | null {
  if (!waktu) return null;

  const isFormatSingkat = /^\d{2}:\d{2}$/.test(waktu);

  if (isFormatSingkat) {
    if (!tanggalAcuan) {
      throw new Error(
        "tanggalAcuan wajib tersedia ketika waktu dikirim dalam format HH:MM"
      );
    }
    return new Date(`${tanggalAcuan}T${waktu}:00`);
  }

  // Diasumsikan sudah berupa ISO 8601 lengkap
  const parsed = new Date(waktu);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Format waktu tidak valid: ${waktu}`);
  }
  return parsed;
}

export default async function patroliRoutes(app: FastifyInstance) {
  /* PATCH /api/patroli/tugas/:id/status — jalur relatif, tanpa duplikasi awalan */
  app.patch(
  "/tugas/:id/status",
  { preHandler: app.authenticate },
  async (req, reply) => {
    const { id } = req.params as { id: string };
    const tugasId = Number(id);

    if (!Number.isInteger(tugasId)) {
      return reply.status(400).send({ message: "ID tugas tidak valid" });
    }

    const { status, latitude, longitude } = req.body as {
      status: "BELUM_DIMULAI" | "SEDANG_BERLANGSUNG" | "SELESAI" | "DIBATALKAN";
      latitude?: number;
      longitude?: number;
    };

    const allowed = ["BELUM_DIMULAI", "SEDANG_BERLANGSUNG", "SELESAI", "DIBATALKAN"];
    if (!allowed.includes(status)) {
      return reply.code(400).send({ message: "Status tidak valid" });
    }

    const data: Record<string, unknown> = { status, updated_at: new Date() };
    const lokasiStr =
      latitude != null && longitude != null ? `${latitude},${longitude}` : undefined;

    if (status === "SEDANG_BERLANGSUNG") {
      data.waktu_mulai_aktual = new Date();
      if (lokasiStr) data.lokasi_mulai = lokasiStr;
    }
    if (status === "SELESAI") {
      data.waktu_selesai_aktual = new Date();
      if (lokasiStr) data.lokasi_selesai = lokasiStr;
    }

    try {
      const updated = await prisma.patroli_tugas.update({
        where: { id: tugasId },
        data,
      });
      return reply.send(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return reply
          .status(404)
          .send({ message: "Tugas patroli tidak ditemukan" });
      }
      app.log.error(error, "Gagal memperbarui status tugas patroli");
      return reply
        .status(500)
        .send({ message: "Gagal memperbarui status tugas patroli" });
    }
  },
);

  /* GET /api/patroli/tugas/:tugasId/checklist — jalur relatif */
  app.get(
    "/tugas/:tugasId/checklist",
    { preHandler: app.authenticate },
    async (req, reply) => {
      const { tugasId } = req.params as { tugasId: string };

      const tugas = await prisma.patroli_tugas.findUnique({ where: { id: Number(tugasId) } });
      if (!tugas) return reply.code(404).send({ message: "Tugas tidak ditemukan" });
      if (!tugas.rute_id) return reply.code(400).send({ message: "Tugas ini belum memiliki rute" });

      const daftarCheckpoint = await prisma.rute_patroli_checkpoint.findMany({
        where: { rute_id: tugas.rute_id },
        orderBy: { urutan: "asc" },
        include: { checkpoint_patroli: true },
      });

      const daftarChecklist = await prisma.checklist_patroli.findMany({
        where: {
          rute_id: tugas.rute_id,
          aktif: true,
          checkpoint_id: { in: daftarCheckpoint.map((rc) => rc.checkpoint_patroli.id) },
        },
      });

      const checklistMap = new Map<string, typeof daftarChecklist>();
      for (const cl of daftarChecklist) {
        const key = cl.checkpoint_id.toString();
        if (!checklistMap.has(key)) checklistMap.set(key, []);
        checklistMap.get(key)!.push(cl);
      }

      const kunjunganList = await prisma.kunjungan_checkpoint.findMany({
        where: { tugas_id: Number(tugasId) },
        include: { checklist_jawaban: true },
      });

      const kunjunganMap = new Map(kunjunganList.map((k) => [k.checkpoint_id.toString(), k]));

      const hasil = daftarCheckpoint.map((rc) => {
        const cp = rc.checkpoint_patroli;
        const kunjungan = kunjunganMap.get(cp.id.toString());
        const pertanyaanCheckpoint = checklistMap.get(cp.id.toString()) ?? [];

        return {
          checkpoint_id: cp.id.toString(),
          kode: cp.kode,
          nama: cp.nama,
          deskripsi: cp.deskripsi,
          latitude: cp.latitude?.toString() ?? null,
          longitude: cp.longitude?.toString() ?? null,
          radius_meter: cp.radius_meter,
          urutan: rc.urutan,
          wajib: rc.wajib,
          pertanyaan: pertanyaanCheckpoint.map((cl) => ({
            id: cl.id.toString(),
            pertanyaan: cl.pertanyaan,
            tipe_jawaban: cl.tipe_jawaban,
            wajib: cl.wajib,
          })),
          sudah_dikunjungi: Boolean(kunjungan),
          kunjungan: kunjungan
            ? {
                id: kunjungan.id.toString(),
                waktu_kunjungan: kunjungan.waktu_kunjungan,
                status_temuan: kunjungan.status_temuan,
                catatan: kunjungan.catatan,
                foto_path: kunjungan.foto_path,
                jarak_meter: kunjungan.jarak_meter.toString(),
                jawaban: kunjungan.checklist_jawaban.map((j) => ({
                  checklist_patroli_id: j.checklist_patroli_id.toString(),
                  jawaban: j.jawaban,
                })),
              }
            : null,
        };
      });

      return reply.send({
        tugas_id: tugasId,
        status_tugas: tugas.status,
        total_checkpoint: hasil.length,
        total_dikunjungi: hasil.filter((h) => h.sudah_dikunjungi).length,
        checkpoints: hasil,
      });
    }
  );

 /* POST /api/patroli/rute/:ruteId/checkpoints */
app.post(
  "/rute/:ruteId/checkpoints",
  { preHandler: app.authenticate },
  async (request, reply) => {
    const { ruteId } = request.params as { ruteId: string };
    const ruteIdNum = Number(ruteId);

    if (!Number.isInteger(ruteIdNum)) {
      return reply.status(400).send({ message: "ID rute tidak valid" });
    }

    const body = request.body as {
      nama: string;
      urutan?: number;
      deskripsi?: string;
      koordinat?: { lat: number; lng: number } | null;
      wajib?: boolean;
      radiusMeter?: number;
    };

    if (!body.nama || body.nama.trim() === "") {
      return reply.status(400).send({ message: "Nama checkpoint wajib diisi" });
    }

    try {
      const rute = await prisma.rute_patroli.findUnique({
        where: { id: BigInt(ruteIdNum) },
      });
      if (!rute) {
        return reply.status(404).send({ message: "Rute patroli tidak ditemukan" });
      }

      const kodeUnik = `CP-${Date.now().toString(36).toUpperCase()}`;

      const result = await prisma.$transaction(async (tx) => {
  // Urutan SELALU dihitung otomatis di awal, body.urutan diabaikan sepenuhnya
  const urutanRelasi =
    (await tx.rute_patroli_checkpoint.count({
      where: { rute_id: BigInt(ruteIdNum) },
    })) + 1;

  const checkpoint = await tx.checkpoint_patroli.create({
    data: {
      site_id: rute.site_id,
      nama: body.nama,
      deskripsi: body.deskripsi ?? null,
      latitude: body.koordinat?.lat ?? null,
      longitude: body.koordinat?.lng ?? null,
      radius_meter: body.radiusMeter ?? 30,
      urutan: urutanRelasi, // <-- Diselaraskan, bukan body.urutan ?? 1
      kode: kodeUnik,
    },
  });

  const relasi = await tx.rute_patroli_checkpoint.create({
    data: {
      rute_id: BigInt(ruteIdNum),
      checkpoint_id: checkpoint.id,
      urutan: urutanRelasi, // <-- Nilai yang sama dengan di atas
      wajib: body.wajib ?? true,
    },
  });

  return { checkpoint, relasi };
});

      return reply.status(201).send({
        id: result.relasi.id.toString(),
        ruteId: ruteIdNum.toString(),
        checkpointId: result.checkpoint.id.toString(),
        urutan: result.relasi.urutan,
        wajib: result.relasi.wajib,
        nama: result.checkpoint.nama,
        deskripsi: result.checkpoint.deskripsi,
        qrCode: result.checkpoint.kode,
        koordinat:
          result.checkpoint.latitude != null && result.checkpoint.longitude != null
            ? {
                lat: Number(result.checkpoint.latitude),
                lng: Number(result.checkpoint.longitude),
              }
            : null,
        radiusMeter: Number(result.checkpoint.radius_meter),
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ message: "Gagal menambahkan checkpoint" });
    }
  }
);
/*
 * GET /api/patroli/tugas
 *
 * Mendukung dua mode filter: tanggal tunggal (?tanggal=YYYY-MM-DD)
 * atau rentang tanggal (?tanggal_mulai_dari=...&tanggal_mulai_sampai=...).
 * Apabila tidak ada parameter yang dikirim, seluruh data dikembalikan.
 */
app.get("/tugas", { preHandler: app.authenticate }, async (request, reply) => {
  const { tanggal, tanggal_mulai_dari, tanggal_mulai_sampai } = request.query as {
    tanggal?: string;
    tanggal_mulai_dari?: string;
    tanggal_mulai_sampai?: string;
  };

  try {
    const tugas = await prisma.$queryRaw`
      SELECT
        pt.*,
        o.nama AS nama_petugas,
        s.name AS nama_lokasi,
        rp.nama AS nama_rute,
        rp.durasi_target_menit,
        COALESCE(cp_count.total_checkpoint, 0)      AS total_checkpoint,
        COALESCE(kj_count.checkpoints_dikunjungi, 0) AS checkpoints_dikunjungi,
        kj_last.latitude        AS lokasi_terakhir_lat,
        kj_last.longitude       AS lokasi_terakhir_lng,
        kj_last.waktu_kunjungan AS lokasi_terakhir_pada
      FROM patroli_tugas pt
      LEFT JOIN officers     o  ON o.id = pt.officer_id
      LEFT JOIN sites        s  ON s.id = pt.site_id
      LEFT JOIN rute_patroli rp ON rp.id = pt.rute_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total_checkpoint
        FROM rute_patroli_checkpoint rpc WHERE rpc.rute_id = pt.rute_id
      ) cp_count ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS checkpoints_dikunjungi
        FROM kunjungan_checkpoint kc WHERE kc.tugas_id = pt.id
      ) kj_count ON true
      LEFT JOIN LATERAL (
        SELECT latitude, longitude, waktu_kunjungan
        FROM kunjungan_checkpoint kc
        WHERE kc.tugas_id = pt.id
        ORDER BY kc.waktu_kunjungan DESC LIMIT 1
      ) kj_last ON true
      WHERE
        CASE
          WHEN ${tanggal ?? null}::date IS NOT NULL
            THEN pt.tanggal = ${tanggal ?? null}::date
          WHEN ${tanggal_mulai_dari ?? null}::date IS NOT NULL
               AND ${tanggal_mulai_sampai ?? null}::date IS NOT NULL
            THEN pt.tanggal BETWEEN ${tanggal_mulai_dari ?? null}::date
                                 AND ${tanggal_mulai_sampai ?? null}::date
          ELSE true
        END
      ORDER BY pt.tanggal ASC, pt.jam_mulai_rencana ASC
    `;

    const serialized = (tugas as any[]).map((row) => {
      const {
        lokasi_terakhir_lat,
        lokasi_terakhir_lng,
        lokasi_terakhir_pada,
        rute_id,
        total_checkpoint,
        checkpoints_dikunjungi,
        ...rest
      } = row;

      return {
        ...rest,
        rute_id: rute_id !== null ? rute_id.toString() : null,
        total_checkpoint: Number(total_checkpoint),
        checkpoints_dikunjungi: Number(checkpoints_dikunjungi),
        lokasi_terakhir:
          lokasi_terakhir_lat !== null && lokasi_terakhir_lng !== null
            ? { lat: Number(lokasi_terakhir_lat), lng: Number(lokasi_terakhir_lng), pada: lokasi_terakhir_pada }
            : null,
      };
    });

    return reply.status(200).send(serialized);
  } catch (error) {
    app.log.error(error, "Gagal mengambil data tugas patroli");
    return reply.status(500).send({ message: "Gagal mengambil data tugas patroli" });
  }
});

  /*
   * GET /api/patroli/rute
   *
   * Mengambil daftar rute patroli, dilengkapi nama lokasi
   * serta jumlah checkpoint pada masing-masing rute.
   */
app.get("/rute", { preHandler: app.authenticate }, async (request, reply) => {
  const { aktifOnly } = request.query as { aktifOnly?: string };
  const filterAktif = aktifOnly === "true";

  try {
        const rute = await prisma.$queryRaw`
          SELECT
            rp.id,
            rp.site_id,
            rp.kode,
            rp.nama,
            rp.deskripsi,
            rp.durasi_target_menit,
            rp.aktif,
            rp.created_at,
            rp.updated_at,
            s.name AS nama_lokasi,
            (
              SELECT COUNT(*)
              FROM rute_patroli_checkpoint rpc
              WHERE rpc.rute_id = rp.id
            ) AS jumlah_checkpoint
          FROM rute_patroli rp
          LEFT JOIN sites s ON s.id = rp.site_id
          ORDER BY rp.id DESC
        `;

        const serialized = (rute as any[]).map((item) => ({
          ...item,
          id: item.id.toString(),
          jumlah_checkpoint: Number(item.jumlah_checkpoint),
        }));

        return reply.status(200).send(serialized);
      } catch (error) {
        app.log.error(error, "Gagal mengambil data rute patroli");
        return reply.status(500).send({
          message: "Gagal mengambil data rute patroli",
        });
      }
    }
  );

  /*
   * POST /api/patroli/tugas
   *
   * Membuat tugas patroli baru. Kolom "dibuat_oleh" diisi
   * dari request.user.userId (hasil verifikasi JWT), bukan
   * dari payload klien, demi mencegah manipulasi identitas.
   *
   * jam_mulai_rencana dan jam_selesai_rencana digabungkan dengan
   * "tanggal" agar tidak menghasilkan epoch 1970-01-01.
   */
  app.post(
    "/tugas",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const currentUser = request.user as { userId: number };
      const body = request.body as Partial<{
        tanggal: string;
        site_id: number;
        officer_id: number | null;
        shift_id: number | null;
        rute_id: number | string | null;
        lokasi_mulai: string | null;
        lokasi_selesai: string | null;
        jam_mulai_rencana: string | null;
        jam_selesai_rencana: string | null;
        catatan: string | null;
        status: string;
      }>;

      if (!body.tanggal || !body.site_id) {
        return reply.status(400).send({
          message: "site_id, officer_id, shift_id, atau rute_id yang dikirim tidak ditemukan",
        });
      }

      try {
        const created = await prisma.patroli_tugas.create({
          data: {
            tanggal: new Date(body.tanggal),
            site_id: body.site_id,
            officer_id: body.officer_id ?? null,
            shift_id: body.shift_id ?? null,
            rute_id: body.rute_id != null ? BigInt(body.rute_id) : null,
            lokasi_mulai: body.lokasi_mulai ?? null,
            lokasi_selesai: body.lokasi_selesai ?? null,
            jam_mulai_rencana: buildDateTime(body.tanggal, body.jam_mulai_rencana),
            jam_selesai_rencana: buildDateTime(body.tanggal, body.jam_selesai_rencana),
            catatan: body.catatan ?? null,
            status: body.status ?? "BELUM_DIMULAI",
            dibuat_oleh: currentUser.userId,
          },
        });

        return reply.status(201).send(created);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          return reply.status(400).send({
            message:
              "site_id, officer_id, atau rute_id yang dikirim tidak ditemukan",
          });
        }

        app.log.error(error, "Gagal membuat tugas patroli");
        return reply.status(500).send({
          message: "Gagal membuat tugas patroli",
        });
      }
    }
  );

  /*
   * PUT /api/patroli/tugas/:id
   *
   * Memperbarui tugas patroli yang sudah ada. Hanya kolom yang
   * dikirim pada body yang akan diperbarui (partial update).
   *
   * tanggalAcuan diambil dari body.tanggal apabila tersedia; jika
   * tidak, diambil dari data tersimpan di database, agar
   * jam_mulai_rencana/jam_selesai_rencana tidak salah digabungkan
   * dengan tanggal hari ini secara keliru.
   */
  app.put(
    "/tugas/:id",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tugasId = Number(id);

      if (!Number.isInteger(tugasId)) {
        return reply.status(400).send({ message: "ID tugas tidak valid" });
      }

      const body = request.body as Partial<{
        tanggal: string;
        site_id: number;
        officer_id: number | null;
        shift_id: number | null;
        rute_id: number | string | null;
        lokasi_mulai: string | null;
        lokasi_selesai: string | null;
        jam_mulai_rencana: string | null;
        jam_selesai_rencana: string | null;
        catatan: string | null;
        status: string;
      }>;

      try {
        let tanggalAcuan: string | undefined = body.tanggal;

        if (
          (body.jam_mulai_rencana !== undefined ||
            body.jam_selesai_rencana !== undefined) &&
          !tanggalAcuan
        ) {
          const existing = await prisma.patroli_tugas.findUnique({
            where: { id: tugasId },
            select: { tanggal: true },
          });

          if (!existing) {
            return reply
              .status(404)
              .send({ message: "Tugas patroli tidak ditemukan" });
          }

          tanggalAcuan = existing.tanggal.toISOString().slice(0, 10);
        }

        const dataToUpdate: Prisma.patroli_tugasUpdateInput = {
          updated_at: new Date(),
        };

        if (body.tanggal !== undefined) {
          dataToUpdate.tanggal = new Date(body.tanggal);
        }

        if (body.site_id !== undefined) {
          dataToUpdate.sites = { connect: { id: body.site_id } };
        }

        if (body.officer_id !== undefined) {
          dataToUpdate.officers = body.officer_id
            ? { connect: { id: body.officer_id } }
            : { disconnect: true };
        }

        if (body.shift_id !== undefined) {
          dataToUpdate.shifts = body.shift_id
            ? { connect: { id: body.shift_id } }
            : { disconnect: true };
        }

        if (body.rute_id !== undefined) {
          dataToUpdate.rute_patroli = body.rute_id
            ? { connect: { id: BigInt(body.rute_id) } }
            : { disconnect: true };
        }

        if (body.lokasi_mulai !== undefined) {
          dataToUpdate.lokasi_mulai = body.lokasi_mulai;
        }

        if (body.lokasi_selesai !== undefined) {
          dataToUpdate.lokasi_selesai = body.lokasi_selesai;
        }

        if (body.jam_mulai_rencana !== undefined) {
          dataToUpdate.jam_mulai_rencana = buildDateTime(
            tanggalAcuan,
            body.jam_mulai_rencana
          );
        }

        if (body.jam_selesai_rencana !== undefined) {
          dataToUpdate.jam_selesai_rencana = buildDateTime(
            tanggalAcuan,
            body.jam_selesai_rencana
          );
        }

        if (body.catatan !== undefined) {
          dataToUpdate.catatan = body.catatan;
        }

        if (body.status !== undefined) {
          dataToUpdate.status = body.status;
        }

        const updated = await prisma.patroli_tugas.update({
          where: { id: tugasId },
          data: dataToUpdate,
        });

        return reply.status(200).send(updated);
      } catch (error) {
         if (error instanceof Error && error.message.includes("Format waktu")) {
            return reply.status(400).send({ message: error.message });
          }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          return reply
            .status(404)
            .send({ message: "Tugas patroli tidak ditemukan" });
        }

        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          return reply.status(400).send({
            message:
              "site_id, officer_id, atau rute_id yang dikirim tidak ditemukan",
          });
        }

        app.log.error(error, "Gagal memperbarui tugas patroli");
        return reply.status(500).send({
          message: "Gagal memperbarui tugas patroli",
        });
      }
    }
  );

  /*
   * DELETE /api/patroli/tugas/:id
   *
   * Menghapus tugas patroli berdasarkan ID.
   */
  app.delete(
    "/tugas/:id",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tugasId = Number(id);

      if (!Number.isInteger(tugasId)) {
        return reply.status(400).send({ message: "ID tugas tidak valid" });
      }

      try {
        await prisma.patroli_tugas.delete({ where: { id: tugasId } });
        return reply
          .status(200)
          .send({ message: "Tugas patroli berhasil dihapus" });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          return reply
            .status(404)
            .send({ message: "Tugas patroli tidak ditemukan" });
        }

        app.log.error(error, "Gagal menghapus tugas patroli");
        return reply.status(500).send({
          message: "Gagal menghapus tugas patroli",
        });
      }
    }
  );

  app.post(
    "/tugas/:tugasId/checkpoint",
    { preHandler: app.authenticate },
    async (req, reply) => {
      const currentUser = req.user as { userId: number };
      const { tugasId } = req.params as { tugasId: string };
      const idTugas = Number(tugasId);

      if (!Number.isInteger(idTugas)) {
        return reply.status(400).send({ message: "ID tugas tidak valid" });
      }

      const tugas = await prisma.patroli_tugas.findUnique({ where: { id: idTugas } });
      if (!tugas) {
        return reply.status(404).send({ message: "Tugas tidak ditemukan" });
      }

      let checkpointId: bigint | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;
      let catatan: string | null = null;
      let statusTemuan: string | null = null;
      let jawabanRaw: string | null = null;
      let fotoPath: string | null = null;

      const uploadDir = path.resolve("../uploads/checkpoint");
      await mkdir(uploadDir, { recursive: true });

      for await (const part of req.parts()) {
        if (part.type === "file") {
          const namaBerkas = `${randomUUID()}${path.extname(part.filename)}`;
          const tujuanPath = path.join(uploadDir, namaBerkas);
          await pipeline(part.file, createWriteStream(tujuanPath));
          fotoPath = `/uploads/checkpoint/${namaBerkas}`;
        } else {
          switch (part.fieldname) {
            case "checkpoint_id": checkpointId = BigInt(part.value as string); break;
            case "latitude": latitude = Number(part.value); break;
            case "longitude": longitude = Number(part.value); break;
            case "catatan": catatan = part.value as string; break;
            case "status_temuan": statusTemuan = part.value as string; break;
            case "jawaban": jawabanRaw = part.value as string; break;
          }
        }
      }

      // foto_path bersifat WAJIB sesuai skema, bukan opsional
      if (checkpointId === null || latitude === null || longitude === null || !fotoPath) {
        return reply.status(400).send({
          message: "checkpoint_id, latitude, longitude, dan foto wajib dikirim",
        });
      }

      const checkpoint = await prisma.checkpoint_patroli.findUnique({ where: { id: checkpointId } });
      if (!checkpoint) {
        return reply.status(404).send({ message: "Checkpoint tidak ditemukan" });
      }

      const jarak = haversineMeter(
        latitude, longitude,
        Number(checkpoint.latitude), Number(checkpoint.longitude)
      );
      const dalamRadius = jarak <= checkpoint.radius_meter;

      if (!dalamRadius) {
        return reply.status(422).send({
          message: `Lokasi terlalu jauh dari checkpoint (${jarak.toFixed(1)} meter, batas ${checkpoint.radius_meter} meter)`,
          jarak_meter: jarak,
        });
      }

      let daftarJawaban: { checklist_patroli_id: string; jawaban: string }[] = [];
      if (jawabanRaw) {
        try {
          daftarJawaban = JSON.parse(jawabanRaw);
        } catch {
          return reply.status(400).send({ message: "Format field jawaban tidak valid" });
        }
      }

      try {
        const kunjungan = await prisma.kunjungan_checkpoint.create({
          data: {
            tugas_id: idTugas,
            checkpoint_id: checkpointId,
            waktu_kunjungan: new Date(),
            latitude,
            longitude,
            jarak_meter: jarak,
            dalam_radius: dalamRadius,
            status_temuan: statusTemuan ?? "normal",
            catatan,
            foto_path: fotoPath,
            dibuat_oleh: currentUser.userId,
            checklist_jawaban: {
              create: daftarJawaban.map((j) => ({
                checklist_patroli_id: BigInt(j.checklist_patroli_id),
                jawaban: j.jawaban,
              })),
            },
          },
          include: { checklist_jawaban: true },
        });

        return reply.status(201).send({
          id: kunjungan.id.toString(),
          checkpoint_id: kunjungan.checkpoint_id.toString(),
          waktu_kunjungan: kunjungan.waktu_kunjungan,
          jarak_meter: kunjungan.jarak_meter.toString(),
          dalam_radius: kunjungan.dalam_radius,
          status_temuan: kunjungan.status_temuan,
          foto_path: kunjungan.foto_path,
          jawaban: kunjungan.checklist_jawaban.map((j) => ({
            checklist_patroli_id: j.checklist_patroli_id.toString(),
            jawaban: j.jawaban,
          })),
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return reply.status(409).send({
            message: "Checkpoint ini sudah pernah dikunjungi pada tugas ini",
          });
        }
        app.log.error(error, "Gagal mencatat kunjungan checkpoint");
        return reply.status(500).send({ message: "Gagal mencatat kunjungan checkpoint" });
      }
    }
  );

  /*
 * GET /api/patroli/rute/:ruteId/checkpoints
 *
 * Mengambil daftar checkpoint yang terhubung dengan sebuah rute patroli,
 * diurutkan berdasarkan "urutan" kunjungan.
 */
app.get(
  "/rute/:ruteId/checkpoints",
  { preHandler: app.authenticate },
  async (request, reply) => {
    const { ruteId } = request.params as { ruteId: string };
    const ruteIdNum = Number(ruteId);

    if (!Number.isInteger(ruteIdNum)) {
      return reply.status(400).send({ message: "ID rute tidak valid" });
    }

    try {
      const checkpoints = await prisma.$queryRaw`
        SELECT
          rpc.id,
          rpc.rute_id,
          rpc.checkpoint_id,
          rpc.urutan,
          rpc.wajib,
          cp.kode,
          cp.nama,
          cp.deskripsi,
          cp.latitude,
          cp.longitude,
          cp.radius_meter
        FROM rute_patroli_checkpoint rpc
        LEFT JOIN checkpoint_patroli cp ON cp.id = rpc.checkpoint_id
        WHERE rpc.rute_id = ${BigInt(ruteIdNum)}
        ORDER BY rpc.urutan ASC
      `;

      const serialized = (checkpoints as any[]).map((row) => ({
        id: row.id.toString(),
        ruteId: row.rute_id.toString(),
        checkpointId: row.checkpoint_id.toString(),
        urutan: row.urutan,
        wajib: row.wajib,
        nama: row.nama,
        deskripsi: row.deskripsi,
        qrCode: row.kode,
        koordinat:
          row.latitude != null && row.longitude != null
            ? { lat: Number(row.latitude), lng: Number(row.longitude) }
            : null,
        radiusMeter: row.radius_meter != null ? Number(row.radius_meter) : null,
      }));

      return reply.status(200).send(serialized);
    } catch (error) {
      app.log.error(error, "Gagal mengambil data checkpoint rute");
      return reply
        .status(500)
        .send({ message: "Gagal mengambil data checkpoint rute" });
    }
  }
);
app.delete(
  "/checkpoint/:id",
  { preHandler: app.authenticate },
  async (request, reply) => {
    const { id } = request.params as { id: string };

    let checkpointIdBig: bigint;
    try {
      checkpointIdBig = BigInt(id);
    } catch {
      return reply.status(400).send({ message: "ID checkpoint tidak valid" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.rute_patroli_checkpoint.deleteMany({
          where: { checkpoint_id: checkpointIdBig },
        });
        await tx.checkpoint_patroli.delete({ where: { id: checkpointIdBig } });
      });

      return reply.status(200).send({ message: "Checkpoint berhasil dihapus" });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return reply.status(404).send({ message: "Checkpoint tidak ditemukan" });
      }
      app.log.error(error, "Gagal menghapus checkpoint");
      return reply.status(500).send({ message: "Gagal menghapus checkpoint" });
    }
  }
);
}