import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

function hitungUrutanHari(
  tanggal: Date,
  tanggalMulaiRotasi: Date,
  panjangSiklus: number,
): number {
  const MS_PER_HARI = 24 * 60 * 60 * 1000;
  const selisihHari = Math.floor(
    (tanggal.getTime() - tanggalMulaiRotasi.getTime()) / MS_PER_HARI,
  );
  const urutan = selisihHari % panjangSiklus;
  return urutan < 0 ? urutan + panjangSiklus : urutan;
}

// Ditambahkan di assignments.ts, sebelum registrasi rute

async function hitungJadwalGenerate(bulan: number, tahun: number) {
    const daftarShift = await prisma.shift.findMany({ where: { aktif: true, kode: { not: null } } });
    const petaKodeShift = new Map(
        daftarShift.map((s) => [s.kode as string, { id: s.id, nama: s.nama, kode: s.kode!, jamMulai: s.jamMulai, jamSelesai: s.jamSelesai }]),
    );

    const semuaRegu = await prisma.regu.findMany({ include: { pola_rotasi: true } });
    const reguMap = new Map<string, { tanggalMulaiRotasi: Date; pola: Map<number, string>; panjangSiklus: number }>();
    for (const regu of semuaRegu) {
        const pola = new Map<number, string>();
        for (const p of regu.pola_rotasi) pola.set(p.urutan_hari, p.kode_shift);
        reguMap.set(regu.id.toString(), { tanggalMulaiRotasi: regu.tanggal_mulai_rotasi, pola, panjangSiklus: regu.pola_rotasi.length });
    }

    const petugasAktif = await prisma.officer.findMany({
        where: { status: "aktif", regu_id: { not: null } },
        select: { id: true, nama: true, regu_id: true },
    });

    const jumlahHari = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
    const daftarTanggal = Array.from({ length: jumlahHari }, (_, i) => new Date(Date.UTC(tahun, bulan - 1, i + 1)));

    const hasil: Array<{ officerId: number; nama: string; tanggal: string; kode: string; shiftId: number | null }> = [];

    for (const petugas of petugasAktif) {
        const dataRegu = reguMap.get(petugas.regu_id!.toString());
        for (const tanggal of daftarTanggal) {
            const iso = tanggal.toISOString().slice(0, 10);
            if (!dataRegu || dataRegu.panjangSiklus === 0) {
                hasil.push({ officerId: petugas.id, nama: petugas.nama, tanggal: iso, kode: "-", shiftId: null });
                continue;
            }
            const urutanHari = hitungUrutanHari(tanggal, dataRegu.tanggalMulaiRotasi, dataRegu.panjangSiklus);
            const kodeShift = dataRegu.pola.get(urutanHari) ?? "O";
            const infoShift = petaKodeShift.get(kodeShift);
            hasil.push({ officerId: petugas.id, nama: petugas.nama, tanggal: iso, kode: kodeShift, shiftId: infoShift?.id ?? null });
        }
    }

    return { hasil, petugasAktif, daftarTanggal, petaKodeShift };
}


type CreateAssignmentBody = {
  officerId?: number;
  siteId?: number;
  shiftId?: number;
  tanggal?: string;
  catatan?: string | null;
};

type UpdateAssignmentBody = Partial<CreateAssignmentBody>;

export default async function assignmentRoutes(app: FastifyInstance) {
  
  // GET /assignments — mengambil daftar jadwal, dengan filter opsional berdasarkan tanggal
  app.get(
    "/assignments",
    { preHandler: app.authenticate },
    async (request, reply) => {
    const { tanggal_mulai_dari, tanggal_mulai_sampai, reguId, siteId } =
      request.query as {
        tanggal_mulai_dari?: string;
        tanggal_mulai_sampai?: string;
        reguId?: string;
        siteId?: string;
      };

    const whereClause: Record<string, unknown> = {};
    
    if (siteId) {
      whereClause.siteId = Number(siteId);
    }
    if (tanggal_mulai_dari && tanggal_mulai_sampai) {
      whereClause.tanggal = {
        gte: new Date(`${tanggal_mulai_dari}T00:00:00.000Z`),
        lte: new Date(`${tanggal_mulai_sampai}T23:59:59.999Z`),
      };
    }

    if (reguId === "tanpa-regu") {
      whereClause.officer = { regu_id: null };
    } else if (reguId) {
      whereClause.officer = { regu_id: Number(reguId) };
    }

       const data = await prisma.assignment.findMany({
      where: whereClause,
      include: {
        officer: { select: { id: true, nama: true, jabatan: true } },
        sites: { select: { id: true, name: true } },
        shifts: { select: { id: true, nama: true, kode: true, warnaTema: true } },
      },
      orderBy: { tanggal: "asc" },
    });

       return reply.send({
      data,
      tanggal_mulai_dari: tanggal_mulai_dari ?? null,
      tanggal_mulai_sampai: tanggal_mulai_sampai ?? null,
      reguId: reguId ?? null,
      siteId: siteId ?? null,
    });
    },
  );

  // POST /assignments — membuat jadwal baru, dengan shiftId kini tersimpan langsung
  app.post(
    "/assignments",
    { preHandler: app.authenticate },
    async (request, reply) => {
      try {
        const { officerId, siteId, shiftId, tanggal, catatan } =
          request.body as CreateAssignmentBody;

        if (!officerId || !shiftId || !tanggal) {
          return reply.code(400).send({
            status: "error",
            message: "officerId, shiftId, dan tanggal wajib diisi.",
          });
        }

        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });

        if (!shift) {
          return reply.code(404).send({
            status: "error",
            message: "Shift tidak ditemukan.",
          });
        }

        const assignment = await prisma.assignment.create({
          data: {
            officerId,
            shiftId,
            siteId: siteId ?? null,
            tanggal: new Date(tanggal),
            shiftNama: shift.nama,
            jamMulai: String(shift.jamMulai),
            jamSelesai: String(shift.jamSelesai),
            catatan: catatan ?? null,
          },
        });

        return reply.code(201).send({
          status: "ok",
          message: "Jadwal berhasil ditambahkan.",
          data: assignment,
        });
      } catch (error: any) {
        app.log.error(error);

        if (error.code === "P2002") {
          return reply.code(409).send({
            status: "error",
            message: "Petugas sudah memiliki jadwal pada tanggal tersebut.",
          });
        }

        return reply.code(500).send({
          status: "error",
          message: "Gagal menambahkan jadwal.",
        });
      }
    },
  );

  // PATCH /assignments/:id — memperbarui jadwal, dengan shiftId ikut diperbarui
  app.patch(
    "/assignments/:id",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { officerId, siteId, shiftId, tanggal, catatan } =
        request.body as UpdateAssignmentBody;

      try {
        const dataUpdate: Record<string, unknown> = {};

        if (officerId !== undefined) dataUpdate.officerId = officerId;
        if (siteId !== undefined) dataUpdate.siteId = siteId ?? null;
        if (tanggal !== undefined) dataUpdate.tanggal = new Date(tanggal);
        if (catatan !== undefined) dataUpdate.catatan = catatan ?? null;

        if (shiftId !== undefined) {
          const shift = await prisma.shift.findUnique({ where: { id: shiftId } });

          if (!shift) {
            return reply.code(404).send({
              status: "error",
              message: "Shift tidak ditemukan.",
            });
          }

          dataUpdate.shiftId = shiftId;
          dataUpdate.shiftNama = shift.nama;
          dataUpdate.jamMulai = String(shift.jamMulai);
          dataUpdate.jamSelesai = String(shift.jamSelesai);
        }

        const assignment = await prisma.assignment.update({
          where: { id: Number(id) },
          data: dataUpdate,
        });

        return reply.send({
          status: "ok",
          message: "Jadwal berhasil diperbarui.",
          data: assignment,
        });
      } catch (error: any) {
        app.log.error(error);

        if (error.code === "P2025") {
          return reply.code(404).send({
            status: "error",
            message: "Jadwal tidak ditemukan.",
          });
        }

        if (error.code === "P2002") {
          return reply.code(409).send({
            status: "error",
            message: "Petugas sudah memiliki jadwal pada tanggal tersebut.",
          });
        }

        return reply.code(500).send({
          status: "error",
          message: "Gagal memperbarui jadwal.",
        });
      }
    },
  );

  app.delete(
  "/assignments/:id",
  { preHandler: app.authenticate },
  async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const assignment = await prisma.assignment.delete({
        where: { id: Number(id) },
      });

      return reply.send({
        status: "ok",
        message: "Jadwal berhasil dihapus.",
        data: assignment,
      });
    } catch (error: any) {
      app.log.error(error);

      if (error.code === "P2025") {
        return reply.code(404).send({
          status: "error",
          message: "Jadwal tidak ditemukan.",
        });
      }

      return reply.code(500).send({
        status: "error",
        message: "Gagal menghapus jadwal.",
      });
    }
  },
);

  // GET /assignments/generate/preview — TANPA menyimpan ke basis data
    app.get<{ Querystring: { bulan: string; tahun: string } }>(
        "/assignments/generate/preview",
        { preHandler: app.authenticate },
        async (request, reply) => {
            const bulan = Number(request.query.bulan);
            const tahun = Number(request.query.tahun);
            if (!bulan || !tahun) {
                return reply.code(400).send({ status: "error", message: "Parameter bulan dan tahun wajib diisi." });
            }
            const { hasil, petugasAktif, daftarTanggal } = await hitungJadwalGenerate(bulan, tahun);
            return reply.send({
                status: "ok",
                data: { rows: hasil, totalPetugas: petugasAktif.length, totalHari: daftarTanggal.length },
            });
        },
    );
    app.post<{ Body: { bulan: number; tahun: number } }>(
      "/assignments/generate",
      { preHandler: [app.authenticate] },
      async (request, reply) => {
          try {
              const { bulan, tahun } = request.body;
              if (!bulan || !tahun || bulan < 1 || bulan > 12) {
                  return reply.code(400).send({
                      status: "error",
                      message: "Parameter 'bulan' dan 'tahun' wajib benar.",
                  });
              }

              const { hasil, petugasAktif, daftarTanggal, petaKodeShift } =
                  await hitungJadwalGenerate(bulan, tahun);

              // Susun seluruh operasi upsert sebagai daftar Promise TANPA mengeksekusinya.
              // Pemanggilan method Prisma (mis. .upsert()) tidak langsung mengirim
              // permintaan ke basis data sebelum di-`await` atau diteruskan ke $transaction.
              const operasiTulis = hasil
                  .filter((baris) => baris.kode !== "-")
                  .map((baris) => {
                      const infoShift = petaKodeShift.get(baris.kode);
                      return prisma.assignment.upsert({
                          where: {
                              officerId_tanggal: {
                                  officerId: baris.officerId,
                                  tanggal: new Date(baris.tanggal),
                              },
                          },
                          update: {
                              shiftId: infoShift?.id ?? null,
                              shiftNama: infoShift?.nama ?? "Libur",
                              jamMulai: infoShift?.jamMulai ?? null,
                              jamSelesai: infoShift?.jamSelesai ?? null,
                          },
                          create: {
                              officerId: baris.officerId,
                              tanggal: new Date(baris.tanggal),
                              shiftId: infoShift?.id ?? null,
                              shiftNama: infoShift?.nama ?? "Libur",
                              jamMulai: infoShift?.jamMulai ?? null,
                              jamSelesai: infoShift?.jamSelesai ?? null,
                          },
                      });
                  });

              const jumlahDilewati = hasil.length - operasiTulis.length;

              // Eksekusi seluruh operasi dalam SATU transaksi berkelompok.
              // Prisma akan mengirimkan semuanya dalam satu round-trip logis
              // ke basis data, alih-alih menunggu satu per satu secara berurutan.
              const hasilTransaksi = await prisma.$transaction(operasiTulis);

              return reply.send({
                  status: "ok",
                  message: `Jadwal berhasil digenerate untuk periode ${bulan}/${tahun}.`,
                  data: {
                      jumlahDibuat: hasilTransaksi.length,
                      jumlahDilewati,
                      totalPetugas: petugasAktif.length,
                      totalHari: daftarTanggal.length,
                  },
              });
          } catch (error: any) {
              app.log.error(error);
              return reply.code(500).send({
                  status: "error",
                  message: "Gagal melakukan generate jadwal.",
              });
          }
      },
  );
  

}