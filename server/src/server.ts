import "dotenv/config";

// Wajib: BigInt tidak dapat diserialisasi JSON secara default.
// Diletakkan paling atas agar aktif sebelum modul lain (termasuk prisma) dimuat.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import geofenceRoutes from "./routes/geofence.routes.js";
import officersRoutes from "./routes/officers.js";
import authRoutes from "./routes/auth.js";
import absensiRoutes from "./routes/absensi.js";
import { prisma } from "./lib/prisma.js";
import siteRoutes from "./routes/sites.js";
import { userRoutes } from "./routes/users.js";
import { masterDataRoutes } from "./routes/master-data.js";
import assignmentRoutes from "./routes/assignments.js";
import reguRoutes from "./routes/regu.js";
import shiftRoutes from "./routes/shifts.js";
import cutiRoutes from "./routes/cuti.js";
import { laporanHarianRoutes } from "./routes/laporan-harian.js";
import { perlengkapanRoutes } from "./routes/perlengkapan.js";
import patroliRoutes from "./routes/patroli.js";
import delegasiWewenangRoutes from "./routes/delegasi-wewenang.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: true,
});

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET belum diatur di file .env");
}

// Menggunakan __dirname sebagai acuan tunggal,
// konsisten dengan konfigurasi fastifyStatic di bawah.
const uploadsPath = path.resolve(__dirname, "../uploads");

app.decorate("authenticate", async (request, reply) => {
  try {
    const token = request.cookies.amos_token;
    if (!token) {
      return reply.code(401).send({ message: "Token tidak ditemukan" });
    }
    const decoded = app.jwt.verify(token);
    request.user = decoded;
  } catch (error) {
    return reply.code(401).send({ message: "Token tidak valid atau kedaluwarsa" });
  }
});

// CORS harus didaftarkan sebelum route
await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Accept",
    "Content-Type",
    "Authorization",
  ],
});

await app.register(cookie);

await app.register(jwt, {
  secret: jwtSecret,
  cookie: {
    cookieName: "amos_token",
    signed: false,
  },
});

app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (req, body, done) => {
    if (!body || (body as string).trim() === "") {
      done(null, undefined);
      return;
    }
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err) {
      (err as any).statusCode = 400;
      done(err as Error, undefined);
    }
  }
);

await app.register(multipart, {
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
  },
});

await fs.mkdir(path.join(uploadsPath, "profile"), { recursive: true });

// Seluruh registrasi route dan app.listen() dibungkus dalam try...catch
// tunggal ini, sehingga galat pada modul route mana pun (misalnya
// route duplikat pada patroli.ts) akan tercetak jelas di sini,
// bukan menghentikan proses Node secara tidak informatif.
try {
  await app.register(patroliRoutes, { prefix: "/api/patroli" });
  await app.register(perlengkapanRoutes, { prefix: "/api" });
  await app.register(laporanHarianRoutes);
  await app.register(shiftRoutes, { prefix: "/api" });
  await app.register(assignmentRoutes, { prefix: "/api" });
  await app.register(cutiRoutes, { prefix: "/api" });
  await app.register(delegasiWewenangRoutes, { prefix: "/api" }); // baris baru
  await app.register(reguRoutes, { prefix: "/api" });
  await app.register(userRoutes);
  await app.register(masterDataRoutes);

  await app.register(fastifyStatic, {
    root: uploadsPath,
    prefix: "/uploads/",
  });

  await app.register(siteRoutes, { prefix: "/api" });
  await app.register(geofenceRoutes, { prefix: "/api" });
  await app.register(officersRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(absensiRoutes, { prefix: "/api/absensi" });

  app.get("/health", async () => {
    return { status: "ok", message: "API Amos berjalan" };
  });

  app.get("/api/db-test", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: "ok", database: "connected" });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({
        status: "error",
        message: "Database tidak dapat diakses.",
      });
    }
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });

  // Dipindahkan setelah app.listen agar seluruh pohon rute (route tree)
  // telah final dibangun oleh Fastify sebelum dicetak.
  console.log(app.printRoutes());
  console.log(app.printRoutes({ commonPrefix: false }));

  console.log(`API berjalan di http://localhost:${port}`);
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}

process.on("SIGINT", async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});