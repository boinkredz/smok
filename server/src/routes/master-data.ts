import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function masterDataRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/api/master-data/jabatan",
    async (_request, reply) => {
      try {
        const rows = await prisma.jabatan.findMany({
          where: {
            aktif: true,
          },
          select: {
            id: true,
            kode: true,
            nama: true,
          },
          orderBy: {
            nama: "asc",
          },
        });

        return reply.send(
          rows.map((item) => ({
            ...item,
            id: Number(item.id),
          })),
        );
      } catch (error) {
        app.log.error(error);

        return reply.code(500).send({
          message: "Gagal mengambil data jabatan",
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    },
  );

  app.get(
    "/api/master-data/lokasi-gedung",
    async (_request, reply) => {
      try {
        const rows =
          await prisma.lokasiGedung.findMany({
            where: {
              aktif: true,
            },
            select: {
              id: true,
              kode: true,
              nama: true,
            },
            orderBy: {
              nama: "asc",
            },
          });

        return reply.send(
          rows.map((item) => ({
            ...item,
            id: Number(item.id),
          })),
        );
      } catch (error) {
        app.log.error(error);

        return reply.code(500).send({
          message:
            "Gagal mengambil data lokasi gedung",
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    },
  );

  app.get(
    "/api/master-data/roles",
    async (_request, reply) => {
      try {
        const rows = await prisma.role.findMany({
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        });

        return reply.send(
          rows.map((item) => ({
            id: Number(item.id),
            name: item.name,
          })),
        );
      } catch (error) {
        app.log.error(error);

        return reply.code(500).send({
          message: "Gagal mengambil data role",
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    },
  );
}