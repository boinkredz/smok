import { prisma } from "../lib/prisma.js";

export type AttendanceInput = {
  userId: number;
  tanggal: string;
  latitude: number;
  longitude: number;
  selfieUrl?: string | null;
};

type AssignmentRow = {
  assignmentId: number;
  officerId: number;
  tanggal: Date | string;
  shiftNama: string | null;
  jamMulai: string | null;
  jamSelesai: string | null;

  attendanceId: number | null;
  waktuMasuk: Date | string | null;
  waktuKeluar: Date | string | null;
  fotoMasukUrl: string | null;
  fotoKeluarUrl: string | null;

  siteId: number | null;
  siteName: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  radiusMeters: number | null;
};

export type TodayAssignmentResult = {
  id: number;
  officerId: number;
  tanggal: Date | string;
  status: string;
  shiftNama: string | null;
  jamMulai: string | null;
  jamSelesai: string | null;
  sites: {
    id: number;
    name: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    radius_meters: number | null;
  } | null;
  attendance: {
    id: number;
    waktuMasuk: Date | string | null;
    waktuKeluar: Date | string | null;
    fotoMasukUrl: string | null;
    fotoKeluarUrl: string | null;
  } | null;
};

function validateCoordinates(
  latitude: number,
  longitude: number,
): void {
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
}

function validateDate(tanggal: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) ||
    Number.isNaN(Date.parse(`${tanggal}T00:00:00`))
  ) {
    throw new Error(
      "Format tanggal tidak valid. Gunakan YYYY-MM-DD.",
    );
  }
}

function calculateDistanceInMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const latitudeDifference = toRadians(
    latitude2 - latitude1,
  );

  const longitudeDifference = toRadians(
    longitude2 - longitude1,
  );

  const value = Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const safeValue = Math.min(1, Math.max(0, value));

  return Math.round(
    earthRadius *
      2 *
      Math.atan2(
        Math.sqrt(safeValue),
        Math.sqrt(1 - safeValue),
      ),
  );
}

async function getOfficerByUserId(userId: number) {
  const officer = await prisma.officer.findFirst({
    where: {
      userId,
    },
  });

  if (!officer) {
    throw new Error(
      "Akun login belum terhubung dengan data petugas.",
    );
  }

  return officer;
}

export async function getTodayAssignment(
  userId: number,
  tanggal: string,
): Promise<TodayAssignmentResult | null> {
  validateDate(tanggal);

  const officer = await getOfficerByUserId(userId);

  const rows = await prisma.$queryRaw<AssignmentRow[]>`
    SELECT
      a.id AS "assignmentId",
      a."officerId" AS "officerId",
      a.tanggal AS "tanggal",
      a."shiftNama" AS "shiftNama",
      a."jamMulai" AS "jamMulai",
      a."jamSelesai" AS "jamSelesai",

      att.id AS "attendanceId",
      att."waktuMasuk" AS "waktuMasuk",
      att."waktuKeluar" AS "waktuKeluar",
      att."fotoMasukUrl" AS "fotoMasukUrl",
      att."fotoKeluarUrl" AS "fotoKeluarUrl",

      s.id AS "siteId",
      s.name AS "siteName",
      s.latitude AS "latitude",
      s.longitude AS "longitude",
      s.radius_meters AS "radiusMeters"

    FROM public.assignments AS a

    LEFT JOIN public.attendances AS att
      ON att."assignmentId" = a.id
     AND att."officerId" = a."officerId"

    LEFT JOIN public.sites AS s
      ON s.id = a."siteId"

    WHERE a."officerId" = ${officer.id}
      AND a.tanggal::date = ${tanggal}::date

    ORDER BY a.id DESC
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  const status = row.waktuKeluar
    ? "Selesai"
    : row.waktuMasuk
      ? "Hadir"
      : "Belum diproses";

  return {
    id: row.assignmentId,
    officerId: row.officerId,
    tanggal: row.tanggal,
    status,
    shiftNama: row.shiftNama,
    jamMulai: row.jamMulai,
    jamSelesai: row.jamSelesai,

    sites:
      row.siteId === null
        ? null
        : {
            id: row.siteId,
            name: row.siteName,
            latitude: row.latitude,
            longitude: row.longitude,
            radius_meters: row.radiusMeters,
          },

    attendance:
      row.attendanceId === null
        ? null
        : {
            id: row.attendanceId,
            waktuMasuk: row.waktuMasuk,
            waktuKeluar: row.waktuKeluar,
            fotoMasukUrl: row.fotoMasukUrl,
            fotoKeluarUrl: row.fotoKeluarUrl,
          },
  };
}

async function getAssignmentForAttendance(
  userId: number,
  tanggal: string,
) {
  const assignment = await getTodayAssignment(
    userId,
    tanggal,
  );

  if (!assignment) {
    throw new Error(
      "Belum ada penugasan untuk tanggal tersebut.",
    );
  }

  if (!assignment.sites) {
    throw new Error(
      "Penugasan belum terhubung dengan lokasi site.",
    );
  }

  const site = assignment.sites;

  if (
    site.latitude === null ||
    site.longitude === null ||
    site.radius_meters === null
  ) {
    throw new Error(
      "Koordinat atau radius lokasi belum lengkap.",
    );
  }

  return {
    assignment,
    site,
  };
}

export async function checkIn(input: AttendanceInput) {
  validateDate(input.tanggal);
  validateCoordinates(
    input.latitude,
    input.longitude,
  );

  const { assignment, site } =
    await getAssignmentForAttendance(
      input.userId,
      input.tanggal,
    );

  const distance = calculateDistanceInMeters(
    input.latitude,
    input.longitude,
    Number(site.latitude),
    Number(site.longitude),
  );

  if (distance > Number(site.radius_meters)) {
    throw new Error(
      `Anda berada ${distance} meter dari lokasi. ` +
        `Batas maksimal adalah ${site.radius_meters} meter.`,
    );
  }

  const existingAttendance =
    await prisma.attendance.findUnique({
      where: {
        assignmentId: assignment.id,
      },
    });

  if (existingAttendance?.waktuMasuk) {
    throw new Error(
      "Anda sudah melakukan absen masuk.",
    );
  }

  return prisma.attendance.upsert({
    where: {
      assignmentId: assignment.id,
    },
    create: {
      officerId: assignment.officerId,
      assignmentId: assignment.id,
      tanggal: new Date(
        `${input.tanggal}T00:00:00+07:00`,
      ),
      waktuMasuk: new Date(),
      latMasuk: input.latitude,
      lngMasuk: input.longitude,
      fotoMasukUrl: input.selfieUrl ?? null,
    },
    update: {
      waktuMasuk: new Date(),
      latMasuk: input.latitude,
      lngMasuk: input.longitude,
      fotoMasukUrl: input.selfieUrl ?? null,
    },
  });
}

export async function checkOut(input: AttendanceInput) {
  validateDate(input.tanggal);
  validateCoordinates(
    input.latitude,
    input.longitude,
  );

  const { assignment, site } =
    await getAssignmentForAttendance(
      input.userId,
      input.tanggal,
    );

  const distance = calculateDistanceInMeters(
    input.latitude,
    input.longitude,
    Number(site.latitude),
    Number(site.longitude),
  );

  if (distance > Number(site.radius_meters)) {
    throw new Error(
      `Anda berada ${distance} meter dari lokasi. ` +
        `Batas maksimal adalah ${site.radius_meters} meter.`,
    );
  }

  const attendance =
    await prisma.attendance.findUnique({
      where: {
        assignmentId: assignment.id,
      },
    });

  if (!attendance?.waktuMasuk) {
    throw new Error(
      "Anda belum melakukan absen masuk.",
    );
  }

  if (attendance.waktuKeluar) {
    throw new Error(
      "Anda sudah melakukan absen keluar.",
    );
  }

  return prisma.attendance.update({
    where: {
      assignmentId: assignment.id,
    },
    data: {
      waktuKeluar: new Date(),
      latKeluar: input.latitude,
      lngKeluar: input.longitude,
      fotoKeluarUrl: input.selfieUrl ?? null,
    },
  });
}