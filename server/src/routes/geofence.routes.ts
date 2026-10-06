import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

type GeoFenceBody = {
  site_id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  description?: string | null;
  is_active?: boolean;
};

export default async function geofenceRoutes(
  app: FastifyInstance,
) {
  app.get("/geofences", async (_request, reply) => {
    try {
      const rows = await prisma.geoFence.findMany({
        include: {
          site: true,
        },
        orderBy: {
          id: "desc",
        },
      });

      return reply.send({
        data: rows.map((row) => ({
          id: row.id,
          site_id: row.siteId,
          name: row.name,
          latitude: row.latitude,
          longitude: row.longitude,
          radius_meters: row.radiusMeters,
          description: row.description,
          is_active: row.isActive,
          site: row.site
            ? {
                id: row.site.id,
                name: row.site.name,
                code: null,
              }
            : null,
        })),
      });
    } catch (error) {
      app.log.error(error);

      return reply.code(500).send({
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil data geofence",
      });
    }
  });

  app.post<{ Body: GeoFenceBody }>(
    "/geofences",
    async (request, reply) => {
      try {
        const body = request.body;

        const row = await prisma.geoFence.create({
          data: {
            siteId: Number(body.site_id),
            name: body.name,
            latitude: Number(body.latitude),
            longitude: Number(body.longitude),
            radiusMeters: Number(body.radius_meters),
            description: body.description ?? null,
            isActive: body.is_active ?? true,
          },
        });

        return reply.code(201).send({
          data: row,
          message: "Geofence berhasil ditambahkan",
        });
      } catch (error) {
        app.log.error(error);

        return reply.code(500).send({
          message:
            error instanceof Error
              ? error.message
              : "Gagal menambahkan geofence",
        });
      }
    },
  );

  app.put<{
  Params: {
    id: string;
  };
  Body: {
    site_id: number;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    description?: string | null;
    is_active?: boolean;
  };
}>("/geofences/:id", async (request, reply) => {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id)) {
      return reply.code(400).send({
        message: "ID geofence tidak valid",
      });
    }

    const body = request.body;

    const updated = await prisma.geoFence.update({
      where: {
        id,
      },
      data: {
        siteId: Number(body.site_id),
        name: body.name,
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        radiusMeters: Number(body.radius_meters),
        description: body.description ?? null,
        isActive: body.is_active ?? true,
      },
    });

    return reply.send({
      data: updated,
      message: "Geofence berhasil diperbarui",
    });
  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      message:
        error instanceof Error
          ? error.message
          : "Gagal memperbarui geofence",
    });
  }
});

  app.delete<{ Params: { id: string } }>(
    "/geofences/:id",
    async (request, reply) => {
      try {
        await prisma.geoFence.delete({
          where: {
            id: Number(request.params.id),
          },
        });

        return reply.send({
          message: "Geofence berhasil dihapus",
        });
      } catch (error) {
        app.log.error(error);

        return reply.code(500).send({
          message:
            error instanceof Error
              ? error.message
              : "Gagal menghapus geofence",
        });
      }
    },
  );
}