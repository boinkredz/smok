import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/api/users", async (_request, reply) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      return reply.send({
        data: users,
      });
    } catch (error) {
      app.log.error(error);

      return reply.code(500).send({
        message: "Gagal mengambil data user.",
      });
    }
  });
}