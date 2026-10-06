import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { prisma } from "../lib/prisma.js";

type JwtUser = {
  id?: number | string;
  userId?: number | string;
  userid?: number | string;
  sub?: number | string;
};

type ChecklistItem = {
  perlengkapan_id?: number | string;
  perlengkapanId?: number | string;

  kondisi?: string | null;

  jumlah_diperiksa?: number | string;

  jumlah_baik?: number | string;
  jumlahBaik?: number | string;

  jumlah_rusak?: number | string;
  jumlahRusak?: number | string;

  jumlah_hilang?: number | string;
  jumlahHilang?: number | string;

  keterangan?: string | null;
};

type SubmitChecklistBody = {
  shiftassignmentid?: number | string;
  assignmentId?: number | string;

  catatan?: string | null;
  items?: ChecklistItem[];
};

function getUserId(
  request: FastifyRequest,
): number {
  const user = request.user as JwtUser | undefined;

  const rawUserId =
    user?.id ??
    user?.userId ??
    user?.userid ??
    user?.sub;

  const userId = Number(rawUserId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(
      `User ID tidak valid: ${JSON.stringify(user)}`,
    );
  }

  return userId;
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
  };
}

async function getOfficerByUserId(
  userId: number,
) {
  return prisma.officer.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      userId: true,
      nama: true,
      nik: true,
      status: true,
    },
  });
}

/**
 * GET /api/perlengkapan/today-assignment
 */
export async function getMyTodayAssignment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const userId = getUserId(request);

    const officer = await getOfficerByUserId(userId);

    if (!officer) {
      return reply.code(404).send({
        message:
          "Data officer tidak ditemukan untuk user yang login",
      });
    }

    const { start, end } = getTodayRange();

    const assignment =
      await prisma.shiftassignments.findFirst({
        where: {
          officerid: officer.id,
          tanggal: {
            gte: start,
            lte: end,
          },
        },
        include: {
          officers: true,
          shifts: true,
          cek_perlengkapan: {
            include: {
              cek_perlengkapan_detail: {
                include: {
                  perlengkapan: true,
                },
              },
            },
          },
        },
        orderBy: {
          tanggal: "asc",
        },
      });

    return reply.send({
      data: assignment,
    });
  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      message:
        "Gagal mengambil assignment perlengkapan hari ini",
    });
  }
}

/**
 * GET /api/perlengkapan/master
 */
export async function listMasterPerlengkapan(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = await prisma.perlengkapan.findMany({
      where: {
        aktif: true,
      },
      orderBy: {
        nama: "asc",
      },
    });

    return reply.send({
      data,
    });
  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      message:
        "Gagal mengambil master perlengkapan",
    });
  }
}

/**
 * GET /api/perlengkapan/cek?shiftassignmentid=1
 */
export async function getCekByAssignment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = request.query as {
      shiftassignmentid?: string;
      assignmentId?: string;
    };

    const rawAssignmentId =
      query.shiftassignmentid ??
      query.assignmentId;

    const shiftassignmentid = Number(
      rawAssignmentId,
    );

    if (
      !Number.isInteger(shiftassignmentid) ||
      shiftassignmentid <= 0
    ) {
      return reply.code(400).send({
        message:
          "shiftassignmentid wajib berupa angka positif",
      });
    }

    const userId = getUserId(request);

    const officer = await getOfficerByUserId(userId);

    if (!officer) {
      return reply.code(404).send({
        message: "Officer tidak ditemukan",
      });
    }

    const assignment =
      await prisma.shiftassignments.findFirst({
        where: {
          id: shiftassignmentid,
          officerid: officer.id,
        },
        select: {
          id: true,
        },
      });

    if (!assignment) {
      return reply.code(404).send({
        message:
          "Assignment tidak ditemukan atau bukan milik officer ini",
      });
    }

    const data =
      await prisma.cek_perlengkapan.findUnique({
        where: {
          shiftassignmentid,
        },
        include: {
          shiftassignments: true,
          officers: true,
          cek_perlengkapan_detail: {
            include: {
              perlengkapan: true,
            },
            orderBy: {
              id: "asc",
            },
          },
        },
      });

    return reply.send({
      data,
    });
  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      message:
        "Gagal mengambil checklist perlengkapan",
    });
  }
}

/**
 * POST /api/perlengkapan/cek
 */
export async function submitCek(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const userId = getUserId(request);

    const officer = await getOfficerByUserId(userId);

    if (!officer) {
      return reply.code(404).send({
        message: "Officer tidak ditemukan",
      });
    }

    const body =
      request.body as SubmitChecklistBody;

    const rawAssignmentId =
      body.shiftassignmentid ??
      body.assignmentId;

    const shiftassignmentid = Number(
      rawAssignmentId,
    );

    if (
      !Number.isInteger(shiftassignmentid) ||
      shiftassignmentid <= 0
    ) {
      return reply.code(400).send({
        message:
          "shiftassignmentid wajib diisi",
      });
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return reply.code(400).send({
        message:
          "items perlengkapan wajib diisi",
      });
    }

    const assignment =
      await prisma.shiftassignments.findFirst({
        where: {
          id: shiftassignmentid,
          officerid: officer.id,
        },
        select: {
          id: true,
        },
      });

    if (!assignment) {
      return reply.code(404).send({
        message:
          "Assignment tidak ditemukan atau bukan milik officer ini",
      });
    }

    const detailData = body.items.map(
      (item, index) => {
        const rawPerlengkapanId =
          item.perlengkapan_id ??
          item.perlengkapanId;

        const perlengkapan_id = Number(
          rawPerlengkapanId,
        );

        if (
          !Number.isInteger(perlengkapan_id) ||
          perlengkapan_id <= 0
        ) {
          throw new Error(
            `perlengkapan_id tidak valid pada item ke-${index + 1}`,
          );
        }

        const jumlah_diperiksa = Math.max(
          0,
          Number(
            item.jumlah_diperiksa ??
            0,
          ),
        );

        const jumlah_baik = Math.max(
          0,
          Number(
            item.jumlah_baik ??
              item.jumlahBaik ??
              0,
          ),
        );

        const jumlah_rusak = Math.max(
          0,
          Number(
            item.jumlah_rusak ??
              item.jumlahRusak ??
              0,
          ),
        );

        const jumlah_hilang = Math.max(
          0,
          Number(
            item.jumlah_hilang ??
              item.jumlahHilang ??
              0,
          ),
        );

        if (
          !Number.isInteger(jumlah_diperiksa) ||
          !Number.isInteger(jumlah_baik) ||
          !Number.isInteger(jumlah_rusak) ||
          !Number.isInteger(jumlah_hilang)
        ) {
          throw new Error(
            `Jumlah perlengkapan harus berupa angka bulat pada item ke-${index + 1}`,
          );
        }

        return {
          perlengkapan_id,
          kondisi: item.kondisi ?? "baik",
          jumlah_diperiksa,
          jumlah_baik,
          jumlah_rusak,
          jumlah_hilang,
          keterangan: item.keterangan ?? null,
        };
      },
    );

    const perlengkapanIds =
      detailData.map(
        (item) => item.perlengkapan_id,
      );

    const masterCount =
      await prisma.perlengkapan.count({
        where: {
          id: {
            in: perlengkapanIds,
          },
          aktif: true,
        },
      });

    if (masterCount !== perlengkapanIds.length) {
      return reply.code(400).send({
        message:
          "Ada perlengkapan yang tidak ditemukan atau tidak aktif",
      });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const cek =
          await tx.cek_perlengkapan.upsert({
            where: {
              shiftassignmentid,
            },
            update: {
              tanggal: new Date(),
              catatan: body.catatan ?? null,
              updated_at: new Date(),
            },
            create: {
              shiftassignmentid,
              officerid: officer.id,
              tanggal: new Date(),
              status: "submitted",
              catatan: body.catatan ?? null,
            },
          });

        await tx.cek_perlengkapan_detail.deleteMany({
          where: {
            cek_id: cek.id,
          },
        });

        await tx.cek_perlengkapan_detail.createMany({
          data: detailData.map((item) => ({
            cek_id: cek.id,
            perlengkapan_id: item.perlengkapan_id,
            kondisi: item.kondisi,
            jumlah_diperiksa:
              item.jumlah_diperiksa,
            jumlah_baik: item.jumlah_baik,
            jumlah_rusak: item.jumlah_rusak,
            jumlah_hilang: item.jumlah_hilang,
            keterangan: item.keterangan,
          })),
        });

        return tx.cek_perlengkapan.findUnique({
          where: {
            id: cek.id,
          },
          include: {
            shiftassignments: true,
            officers: true,
            cek_perlengkapan_detail: {
              include: {
                perlengkapan: true,
              },
              orderBy: {
                id: "asc",
              },
            },
          },
        });
      },
    );

    return reply.code(201).send({
      message:
        "Checklist perlengkapan berhasil disimpan",
      data: result,
    });
  } catch (error) {
    request.log.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Gagal menyimpan checklist perlengkapan";

    return reply.code(500).send({
      message,
    });
  }
}