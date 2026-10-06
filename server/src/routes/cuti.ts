import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

const cutiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/me", async (request, reply) => {
    try {
      await request.jwtVerify();

      const user = request.user as {
        id?: number | string;
        userId?: number | string;
      };

      const userId = Number(user.userId ?? user.id);

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.code(401).send({
          message: "User tidak valid",
        });
      }

      const officer = await prisma.officer.findFirst({
        where: {
          userId: userId,
        },
        select: {
          id: true,
          nama: true,
        },
      });

      if (!officer) {
        return reply.code(404).send({
          message: "Akun belum terhubung ke data petugas",
        });
      }

      const data = await prisma.cutiRequest.findMany({
        where: {
          officerid: officer.id,
        },
        orderBy: {
          createdat: "desc",
        },
      });

      return reply.send({
        data: data.map((item) => ({
          id: item.id,
          jenis: item.jenis,
          status: item.status,
          tanggalMulai: item.tanggalmulai,
          tanggalSelesai: item.tanggalselesai,
          alasan: item.alasan,
          catatan: item.catatan,
          officerNama: officer.nama,
          suratSakitUrl: item.suratsakiturl,
        })),
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        message: "Gagal mengambil pengajuan cuti",
      });
    }
  });
};

export default cutiRoutes;