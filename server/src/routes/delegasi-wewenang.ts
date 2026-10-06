import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function delegasiWewenangRoutes(app: FastifyInstance) {
  app.post(
    "/delegasi-wewenang",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as {
        id: number;
        level: number;
        officerId: number;
      };
      const body = request.body as {
        wadanru_id: number;
        regu_id: string;
        mulai: string;
        selesai: string;
        alasan: string;
      };

      if (user.level < 20) {
        return reply.status(403).send({
          status: "error",
          message: "Hanya Danru atau Supervisor yang dapat mengaktifkan delegasi.",
        });
      }

      const delegasi = await prisma.delegasi_wewenang.create({
        data: {
          danru_id: user.officerId,
          wadanru_id: body.wadanru_id,
          regu_id: BigInt(body.regu_id),
          mulai: new Date(body.mulai),
          selesai: new Date(body.selesai),
          alasan: body.alasan,
          dibuat_oleh: user.id,
        },
      });

      return reply.status(201).send({
        status: "ok",
        message: "Delegasi wewenang berhasil diaktifkan.",
        data: delegasi,
      });
    },
  );
}