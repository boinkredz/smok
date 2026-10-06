
import type { FastifyInstance } from "fastify";
import prisma from "../lib/prisma.js";

export async function laporanHarianRoutes(
  app: FastifyInstance,
) {
  app.get("/api/laporan-harian", async (request, reply) => {
    const query = request.query as {
      page?: string;
      limit?: string;
    };

    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.laporan_harian.findMany({
        skip,
        take: limit,
        orderBy: {
          tanggal: "desc",
        },
      }),
      app.prisma.laporan_harian.count(),
    ]);

    return reply.send({
      data,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + data.length < total,
      },
    });
  });

  app.delete(
    "/api/laporan-harian/:id",
    async (request, reply) => {
      const params = request.params as {
        id: string;
      };

      const id = Number(params.id);

      if (!Number.isInteger(id)) {
        return reply.code(400).send({
          message: "ID laporan tidak valid",
        });
      }

      await app.prisma.laporan_harian.delete({
        where: { id },
      });

      return reply.send({
        message: "Laporan berhasil dihapus",
      });
    },
  );
}