import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

type SiteBody = {
  nama: string;
  latitude: number | string;
  longitude: number | string;
  radius_meters?: number;
  is_active?: boolean;
};

type SiteParams = {
  id: string;
};

const siteRoutes: FastifyPluginAsync = async (app) => {
  // GET /sites — perbaikan kunci "sites" → "data"
app.get("/sites", async (_request, reply) => {
  try {
    const sites = await prisma.sites.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assignments: true } } },
    });

    return reply.send({
      data: sites.map((site) => ({
        id: site.id,
        name: site.name,
        latitude: Number(site.latitude),
        longitude: Number(site.longitude),
        radius_meters: site.radius_meters,
        is_active: site.is_active,
        created_at: site.created_at,
        updated_at: site.updated_at,
        jumlahPetugas: site._count.assignments,
      })),
    });
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({
      status: "error",
      message: "Gagal mengambil data site.",
    });
  }
});

// POST /sites — perbaikan "nama" → "name" pada data tulis
app.post<{ Body: SiteBody }>("/sites", async (request, reply) => {
  const { nama, latitude, longitude, radius_meters = 100, is_active = true } =
    request.body;

  if (!nama || latitude === undefined || longitude === undefined) {
    return reply.code(400).send({
      status: "error",
      message: "Nama, latitude, dan longitude wajib diisi.",
    });
  }

  const site = await prisma.sites.create({
    data: {
      name: nama.trim(),   // diperbaiki
      latitude: Number(latitude),
      longitude: Number(longitude),
      radius_meters: Number(radius_meters),
      is_active,
    },
  });

  return reply.code(201).send({
    message: "Site berhasil ditambahkan.",
    data: {
      id: site.id,
      name: site.name,
      latitude: Number(site.latitude),
      longitude: Number(site.longitude),
      radius_meters: site.radius_meters,
      is_active: site.is_active,
    },
  });
});

// PUT /sites/:id — perbaikan "nama" → "name" pada data tulis
app.put<{ Params: SiteParams; Body: SiteBody }>(
  "/sites/:id",
  async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ status: "error", message: "ID site tidak valid." });
    }

    const { nama, latitude, longitude, radius_meters, is_active } = request.body;

    const site = await prisma.sites.update({
      where: { id },
      data: {
        ...(nama !== undefined && { name: nama.trim() }),   // diperbaiki
        ...(latitude !== undefined && { latitude: Number(latitude) }),
        ...(longitude !== undefined && { longitude: Number(longitude) }),
        ...(radius_meters !== undefined && { radius_meters: Number(radius_meters) }),
        ...(is_active !== undefined && { is_active }),
        updated_at: new Date(),
      },
    });

    return reply.send({
      message: "Site berhasil diperbarui.",
      data: {
        id: site.id,
        name: site.name,
        latitude: Number(site.latitude),
        longitude: Number(site.longitude),
        radius_meters: site.radius_meters,
        is_active: site.is_active,
      },
    });
  },
);

 

  // Menghapus site beserta penugasannya
  app.delete<{ Params: SiteParams }>("/sites/:id", async (request, reply) => {
    const id = Number(request.params.id);

    if (!Number.isInteger(id)) {
      return reply.code(400).send({
        status: "error",
        message: "ID site tidak valid.",
      });
    }

    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.assignment.deleteMany({
          where: {
            siteId: id,
          },
        });

        await transaction.sites.delete({
          where: {
            id,
          },
        });
      });

      return reply.send({
        message: "Site berhasil dihapus.",
      });
    } catch (error) {
      app.log.error(error);

      return reply.code(404).send({
        status: "error",
        message: "Site tidak ditemukan atau gagal dihapus.",
      });
    }
  });
};

export default siteRoutes;