import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function shiftRoutes(
  app: FastifyInstance,
) {
  app.get("/shifts", async (_request, reply) => {
    const shifts = await prisma.shift.findMany({
      where: {
        aktif: true,
      },
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        nama: true,
        jamMulai: true,
        jamSelesai: true,
      },
    });

    return reply.send({
      data: shifts,
    });
  });
}