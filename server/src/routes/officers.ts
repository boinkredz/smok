import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import argon2 from "argon2";

type OfficerParams = {
  id: string;
};

type OfficerBody = {
  nama: string;
  nik: string;
  jabatan: string;
  lokasiTugas: string;
  telepon?: string | null;
  email: string;
  status: "aktif" | "cuti" | "nonaktif";
  tanggalMasuk?: string | null;
  catatan?: string | null;
  supervisorId?: number | null;
  danruId?: number | null;
  password?: string;      // 👈 tambahkan ini
  roleAkun?: string;      // 👈 dan ini
};

export default async function officersRoutes(
  app: FastifyInstance,
) {
  // GET /api/officers
  app.get<{
  Querystring: { status?: "aktif" | "cuti" | "nonaktif" };
}>("/officers", async (request, reply) => {
  const { status } = request.query;

  try {
    const officers = await prisma.officer.findMany({
      where: status ? { status } : undefined,
      orderBy: { nama: "asc" },
    });

    return reply.send({ data: officers });
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({
      status: "error",
      message: "Gagal mengambil data officer.",
    });
  }
});

  // GET /api/officers/:id
  app.get<{
    Params: OfficerParams;
  }>("/officers/:id", async (request, reply) => {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({
        status: "error",
        message: "ID officer tidak valid.",
      });
    }

    try {
      const officer = await prisma.officer.findUnique({
        where: {
          id,
        },
      });

      if (!officer) {
        return reply.code(404).send({
          status: "error",
          message: "Officer tidak ditemukan.",
        });
      }

      return reply.send({
        data: officer,
      });
    } catch (error) {
      app.log.error(error);

      return reply.code(500).send({
        status: "error",
        message: "Gagal mengambil detail officer.",
      });
    }
  });

  // POST /api/officers
  app.post<{ Body: OfficerBody }>("/officers", async (request, reply) => {
    const body = request.body;
    if (!body.nama?.trim() || !body.nik?.trim() || !body.jabatan?.trim() ||
        !body.lokasiTugas?.trim() || !body.email?.trim() || !body.password?.trim()) {
      return reply.code(400).send({
        status: "error",
        message: "Nama, NIK, jabatan, lokasi, email, dan password wajib diisi.",
      });
    }

    try {
      const guardRole = await prisma.role.findUnique({ where: { name: "Guard" } });
      const hashedPassword = await argon2.hash(body.password);
       // 1️⃣ Buat user terlebih dahulu
      const user = await prisma.user.create({
        data: {
          email: body.email.trim().toLowerCase(),
          passwordHash: hashedPassword,
          roleId: guardRole?.id ?? 2,
          name: body.nama.trim(),
        },
      });
      
      // 2️⃣ Baru buat officer dan hubungkan ke user
      const officer = await prisma.officer.create({
        data: {
          nama: body.nama.trim(),
          nik: body.nik.trim(),
          jabatan: body.jabatan.trim(),
          lokasiTugas: body.lokasiTugas.trim(),
          telepon: body.telepon?.trim() || null,
          email: body.email.trim().toLowerCase(),
          status: body.status,
          tanggalMasuk: body.tanggalMasuk ? new Date(body.tanggalMasuk) : null,
          catatan: body.catatan?.trim() || null,
          supervisorId: body.supervisorId ?? null,
          danruId: body.danruId ?? null,
          userId:user.id,
        },
      });

      return reply.send({
        status: "success",
        message: "Officer berhasil ditambahkan beserta akun user.",
        data: officer,
      });
    } catch (error: any) {
      app.log.error(error);
      if (error?.code === "P2002") {
        return reply.code(409).send({ status: "error", message: "NIK atau email sudah digunakan." });
      }
      return reply.code(500).send({ status: "error", message: "Gagal menambahkan officer." });
    }
  });


  // PUT /api/officers/:id
  app.put<{
    Params: OfficerParams;
    Body: OfficerBody;
  }>("/officers/:id", async (request, reply) => {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({
        status: "error",
        message: "ID officer tidak valid.",
      });
    }

    const body = request.body;

    if (
      !body.nama?.trim() ||
      !body.nik?.trim() ||
      !body.jabatan?.trim() ||
      !body.lokasiTugas?.trim() ||
      !body.email?.trim()
    ) {
      return reply.code(400).send({
        status: "error",
        message: "Nama, NIK, jabatan, lokasi, dan email wajib diisi.",
      });
    }

    try {
      const officer = await prisma.officer.update({
        where: {
          id,
        },
        data: {
          nama: body.nama.trim(),
          nik: body.nik.trim(),
          jabatan: body.jabatan.trim(),
          lokasiTugas: body.lokasiTugas.trim(),
          telepon: body.telepon?.trim() || null,
          email: body.email.trim().toLowerCase(),
          status: body.status,
          tanggalMasuk: body.tanggalMasuk
            ? new Date(body.tanggalMasuk)
            : null,
          catatan: body.catatan?.trim() || null,
          supervisorId: body.supervisorId ?? null,
          danruId: body.danruId ?? null,
        },
      });

      return reply.send({
        status: "success",
        message: "Data officer berhasil diperbarui.",
        data: officer,
      });
    } catch (error: any) {
      app.log.error(error);

      if (error?.code === "P2025") {
        return reply.code(404).send({
          status: "error",
          message: "Officer tidak ditemukan.",
        });
      }

      if (error?.code === "P2002") {
        return reply.code(409).send({
          status: "error",
          message: "NIK atau email sudah digunakan.",
        });
      }

      return reply.code(500).send({
        status: "error",
        message: "Gagal memperbarui data officer.",
      });
    }
  });
}