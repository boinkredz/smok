import type {
  FastifyInstance,
  FastifyRequest,
} from "fastify";

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

import prisma from "../lib/prisma.js";

import {
  checkIn,
  checkOut,
  getTodayAssignment,
} from "../services/attendance.service.js";

type AuthenticatedRequest = FastifyRequest & {
  user?: {
    id?: number | string;
    userId?: number | string;
  };
};

type MultipartResult = {
  tanggal: string;
  latitude: number;
  longitude: number;
  selfieUrl: string | null;
};

function getUserId(
  request: AuthenticatedRequest,
): number {
  const value =
    request.user?.userId ?? request.user?.id;

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      "Sesi login tidak memiliki ID user yang valid.",
    );
  }

  return id;
}

function todayIndonesia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getImageExtension(
  mimetype: string,
  filename?: string,
): string {
  const mimeExtensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };

  return (
    mimeExtensions[mimetype] ||
    path.extname(filename || "").toLowerCase() ||
    ".jpg"
  );
}

async function parseMultipart(
  request: FastifyRequest,
): Promise<MultipartResult> {
  const fields: Record<string, string> = {};
  let selfieUrl: string | null = null;

  for await (const part of (request as any).parts()) {
    if (part.type === "file") {
      if (part.fieldname !== "foto") {
        part.file.resume();
        continue;
      }

      if (!part.mimetype.startsWith("image/")) {
        part.file.resume();
        throw new Error(
          "File yang dikirim harus berupa gambar.",
        );
      }

      const extension = getImageExtension(
        part.mimetype,
        part.filename,
      );

      const filename =
        `${Date.now()}-${crypto.randomUUID()}${extension}`;

      const directory = path.resolve(
        "uploads/absensi",
      );

      await fs.mkdir(directory, {
        recursive: true,
      });

      const filePath = path.join(
        directory,
        filename,
      );

      await pipeline(
        part.file,
        createWriteStream(filePath),
      );

      if (part.file.truncated) {
        await fs.rm(filePath, {
          force: true,
        });

        throw new Error(
          "Ukuran file terlalu besar.",
        );
      }

      selfieUrl =
        `/uploads/absensi/${filename}`;
    } else {
      fields[part.fieldname] =
        String(part.value ?? "");
    }
  }

  return {
    tanggal:
      fields.tanggal || todayIndonesia(),
    latitude: Number(fields.latitude),
    longitude: Number(fields.longitude),
    selfieUrl,
  };
}

function validateCoordinates(
  latitude: number,
  longitude: number,
) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Koordinat GPS tidak valid.");
  }

  return {
    latitude,
    longitude,
  };
}

export default async function absensiRoutes(
  app: FastifyInstance,
) {
  /*
   * Mengambil penugasan petugas pada tanggal tertentu.
   */
  app.get(
    "/me/today-assignment",
    {
      onRequest: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const query = request.query as {
          tanggal?: string;
        };

        const assignment =
          await getTodayAssignment(
            getUserId(
              request as AuthenticatedRequest,
            ),
            query.tanggal ||
              todayIndonesia(),
          );

        if (!assignment) {
          return reply.code(200).send({
            success: true,
            status: "NO_SCHEDULE",
            message:
              "Tidak ada jadwal kerja untuk tanggal tersebut.",
            data: null,
          });
        }

        const site = assignment.sites;

        if (!site) {
          return reply.code(400).send({
            status: "error",
            message:
              "Penugasan belum terhubung dengan lokasi site.",
          });
        }

        return reply.send({
          status: "ok",
          assignment: {
            id: assignment.id,
            officerId: assignment.officerId,
            tanggal: assignment.tanggal,
            shiftNama:
              assignment.shiftNama || "-",
            lokasi: site.name || "-",
            site: {
              id: site.id,
              name: site.name,
              longitude:
  site.longitude === null || site.longitude === undefined
    ? null
    : site.longitude.toString(),
              latitude:
  site.latitude === null || site.latitude === undefined
    ? null
    : site.latitude.toString(),
              radius_meters:
                site.radius_meters,
            },
            attendance:
              assignment.attendance
                ? {
                    id: assignment.attendance.id,
                    waktuMasuk:
                      assignment.attendance.waktuMasuk,
                    waktuKeluar:
                      assignment.attendance.waktuKeluar,
                    fotoMasukUrl:
                      assignment.attendance.fotoMasukUrl,
                    fotoKeluarUrl:
                      assignment.attendance.fotoKeluarUrl,
                  }
                : null,
          },
        });
      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          status: "error",
          message:
            "Gagal mengambil data penugasan.",
        });
      }
    },
  );

  /*
   * Menyimpan foto profil atau foto wajah petugas.
   */
  app.post(
    "/face-enrollment",
    {
      onRequest: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = getUserId(
          request as AuthenticatedRequest,
        );

        const body = await parseMultipart(
          request,
        );

        if (!body.selfieUrl) {
          return reply.code(400).send({
            status: "error",
            message: "Foto profil wajib dikirim.",
          });
        }

        const officer =
          await prisma.officer.findUnique({
            where: {
              userId,
            },
            select: {
              id: true,
              nama: true,
              facePhotoUrl: true,
            },
          });

        if (!officer) {
          return reply.code(404).send({
            status: "error",
            message:
              "Data petugas tidak ditemukan.",
          });
        }

        const updatedOfficer =
          await prisma.officer.update({
            where: {
              id: officer.id,
            },
            data: {
              facePhotoUrl: body.selfieUrl,
              faceEnrolledAt: new Date(),
            },
            select: {
              id: true,
              nama: true,
              facePhotoUrl: true,
              faceEnrolledAt: true,
            },
          });

        return reply.send({
          status: "ok",
          message:
            "Foto profil berhasil disimpan.",
          officer: {
            id: updatedOfficer.id,
            nama: updatedOfficer.nama,
            facePhotoUrl:
              updatedOfficer.facePhotoUrl,
            faceEnrolledAt:
              updatedOfficer.faceEnrolledAt,
            isEnrolled: Boolean(
              updatedOfficer.facePhotoUrl &&
                updatedOfficer.faceEnrolledAt,
            ),
          },
        });
      } catch (error) {
        request.log.error(error);

        return reply.code(400).send({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Gagal menyimpan foto profil.",
        });
      }
    },
  );

  /*
   * Membaca status foto profil petugas yang sedang login.
   */
  app.get(
    "/face-status",
    {
      onRequest: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = getUserId(
          request as AuthenticatedRequest,
        );

        const officer =
          await prisma.officer.findUnique({
            where: {
              userId,
            },
            select: {
              id: true,
              nama: true,
              facePhotoUrl: true,
              faceEnrolledAt: true,
            },
          });

        if (!officer) {
          return reply.code(404).send({
            status: "error",
            message:
              "Data petugas tidak ditemukan.",
          });
        }

        return reply.send({
          status: "ok",
          officerId: officer.id,
          nama: officer.nama,
          facePhotoUrl: officer.facePhotoUrl,
          faceEnrolledAt: officer.faceEnrolledAt,
          isEnrolled: Boolean(
            officer.facePhotoUrl &&
              officer.faceEnrolledAt,
          ),
        });
      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          status: "error",
          message:
            "Gagal membaca status foto profil.",
        });
      }
    },
  );

  /*
   * Absen masuk.
   */
  app.post(
    "/check-in",
    {
      onRequest: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const body = await parseMultipart(
          request,
        );

        const gps = validateCoordinates(
          body.latitude,
          body.longitude,
        );

        const attendance = await checkIn({
          userId: getUserId(
            request as AuthenticatedRequest,
          ),
          tanggal: body.tanggal,
          ...gps,
          selfieUrl: body.selfieUrl,
        });

        return reply.code(201).send({
          status: "ok",
          message: "Absen masuk berhasil.",
          attendance,
        });
      } catch (error) {
        request.log.error(error);

        return reply.code(400).send({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Absen masuk gagal.",
        });
      }
    },
  );

  /*
   * Absen keluar.
   */
  app.post(
    "/check-out",
    {
      onRequest: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const body = await parseMultipart(
          request,
        );

        const gps = validateCoordinates(
          body.latitude,
          body.longitude,
        );

        const attendance = await checkOut({
          userId: getUserId(
            request as AuthenticatedRequest,
          ),
          tanggal: body.tanggal,
          ...gps,
          selfieUrl: body.selfieUrl,
        });

        return reply.send({
          status: "ok",
          message: "Absen keluar berhasil.",
          attendance,
        });
      } catch (error) {
        request.log.error(error);

        return reply.code(400).send({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Absen keluar gagal.",
        });
      }
    },
  );
}