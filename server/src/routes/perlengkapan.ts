import type { FastifyInstance } from "fastify";
import {
  getMyTodayAssignment,
  listMasterPerlengkapan,
  getCekByAssignment,
  submitCek,
} from "../services/perlengkapan.service.js";

export async function perlengkapanRoutes(app: FastifyInstance) {
  app.get(
    "/perlengkapan/today-assignment",
    { preHandler: [app.authenticate] },
    getMyTodayAssignment,
  );

  app.get(
    "/perlengkapan/master",
    { preHandler: [app.authenticate] },
    listMasterPerlengkapan,
  );

  app.get(
    "/perlengkapan/cek",
    { preHandler: [app.authenticate] },
    getCekByAssignment,
  );

  app.post(
    "/perlengkapan/cek",
    { preHandler: [app.authenticate] },
    submitCek,
  );
}