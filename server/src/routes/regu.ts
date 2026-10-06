import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function reguRoutes(app: FastifyInstance) {
  // GET /regu — daftar seluruh Regu untuk keperluan dropdown filter
  app.get(
    "/regu",
    { preHandler: app.authenticate },
    async (_request, reply) => {
      const data = await prisma.regu.findMany({
        select: { id: true, nama: true },
        orderBy: { nama: "asc" },
      });

      return reply.send({ status: "ok", data });
    },
  );
}