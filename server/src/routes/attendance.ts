import { FastifyInstance } from "fastify";

import {
  checkIn,
  checkOut,
  getTodayAssignment,
} from "../services/attendance.service.js";

type AuthenticatedUser = {
  id?: number | string;
  userId?: number | string;
};

type AuthenticatedRequest = {
  user?: AuthenticatedUser;
};

function getUserId(
  request: AuthenticatedRequest,
): number {
  const userIdValue =
    request.user?.userId ??
    request.user?.id;

  const userId = Number(userIdValue);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(
      "Sesi login tidak memiliki ID user yang valid.",
    );
  }

  return userId;
}

function getTodayIndonesia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function getCoordinates(body: {
  latitude?: unknown;
  longitude?: unknown;
}) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

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

export default async function attendanceRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/api/absensi/me/today-assignment",
    async (request, reply) => {
      try {
        const query = request.query as {
          tanggal?: string;
        };

        const tanggal =
          query.tanggal ?? getTodayIndonesia();

        const assignment =
          await getTodayAssignment(
            getUserId(
              request as AuthenticatedRequest,
            ),
            tanggal,
          );

        if (!assignment) {
  return reply.code(404).send({
    status: "error",
    message:
      "Belum ada penugasan untuk tanggal tersebut.",
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

if (
  site.latitude === null ||
  site.longitude === null
) {
  return reply.code(400).send({
    status: "error",
    message:
      "Koordinat lokasi site belum tersedia.",
  });
}

        return reply.send({
          status: "ok",
          assignment: {
            id: assignment.id,
            officerId: assignment.officerId,
            tanggal: assignment.tanggal,
            shiftNama: assignment.shiftNama,
            lokasi: site.name,
            status: assignment.status,
            keterangan: null,

            site: {
              id: site.id,
              name: site.name,
              latitude: site.latitude.toString(),
              longitude: site.longitude.toString(),
              radius_meters: site.radius_meters,
            },

            attendance: assignment.attendance
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
        return reply.code(401).send({
          status: "error",
          message: getErrorMessage(
            error,
            "Sesi login tidak valid.",
          ),
        });
      }
    },
  );

  app.post(
    "/api/absensi/check-in",
    async (request, reply) => {
      try {
        const body = request.body as {
          tanggal?: string;
          latitude?: unknown;
          longitude?: unknown;
          selfieUrl?: string | null;
        };

        const coordinates = getCoordinates(body);

        const attendance = await checkIn({
          userId: getUserId(
            request as AuthenticatedRequest,
          ),
          tanggal:
            body.tanggal ?? getTodayIndonesia(),
          ...coordinates,
          selfieUrl: body.selfieUrl,
        });

        return reply.code(201).send({
          status: "ok",
          message: "Absen masuk berhasil.",
          attendance,
        });
      } catch (error) {
        return reply.code(400).send({
          status: "error",
          message: getErrorMessage(
            error,
            "Absen masuk gagal.",
          ),
        });
      }
    },
  );

  app.post(
    "/api/absensi/check-out",
    async (request, reply) => {
      try {
        const body = request.body as {
          tanggal?: string;
          latitude?: unknown;
          longitude?: unknown;
          selfieUrl?: string | null;
        };

        const coordinates = getCoordinates(body);

        const attendance = await checkOut({
          userId: getUserId(
            request as AuthenticatedRequest,
          ),
          tanggal:
            body.tanggal ?? getTodayIndonesia(),
          ...coordinates,
          selfieUrl: body.selfieUrl,
        });

        return reply.send({
          status: "ok",
          message: "Absen keluar berhasil.",
          attendance,
        });
      } catch (error) {
        return reply.code(400).send({
          status: "error",
          message: getErrorMessage(
            error,
            "Absen keluar gagal.",
          ),
        });
      }
    },
  );
}