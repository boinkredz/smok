import "@fastify/cookie";
import "@fastify/jwt";

import type { FastifyInstance } from "fastify";
import argon2 from "argon2";

import { prisma } from "../lib/prisma.js";

type LoginBody = {
  email?: string;
  password?: string;
};

export default async function authRoutes(
  app: FastifyInstance,
) {
  app.post("/login", async (request, reply) => {
    try {
      const body = request.body as LoginBody;

      const email = body.email
        ?.trim()
        .toLowerCase();

      const password = body.password;

      if (!email || !password) {
        return reply.code(400).send({
          status: "error",
          message: "Email dan password wajib diisi.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          roleRef: {
            include: {
              rolePermissions: {
                include: { permission: { select: { code: true } } },
              },
            },
          },
          officer: { select: { id: true, nama: true, regu_id: true } }, // tambahkan id: true
        },
      });

if (!user || !user.passwordHash) {
  return reply.code(401).send({ status: "error", message: "Email atau password salah." });
}

const passwordValid = await argon2.verify(user.passwordHash, password);
if (!passwordValid) {
  return reply.code(401).send({ status: "error", message: "Email atau password salah." });
}

const officerId = user.officer?.id ?? null;

const roleName = user.roleRef?.name ?? "";
const roleLevel = user.roleRef?.level ?? 0;
const permissions = user.roleRef?.rolePermissions.map((rp) => rp.permission.code) ?? [];
const userName = user.officer?.nama ?? user.email;
const reguId = user.officer?.regu_id ? user.officer.regu_id.toString() : null;

const token = app.jwt.sign({
  userId: user.id,
  email: user.email,
  roleId: user.roleId,
  role: roleName,
  level: roleLevel,
  reguId,
  officerId,
  permissions,
});

      reply.setCookie("amos_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return reply.code(200).send({
        status: "ok",
        message: "Login berhasil.",
        token,
        user: {
          id: user.id,
          name: userName,
          email: user.email,
          roleId: user.roleId,
          role: roleName,
          level: roleLevel,
          permissions,
        },
      });
    } catch (error) {
      app.log.error(error, "ERROR LOGIN");

      return reply.code(500).send({
        status: "error",
        message: "Terjadi kesalahan saat login.",
      });
    }
  });

  app.post("/logout", async (_request, reply) => {
    reply.clearCookie("amos_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return reply.code(200).send({
      status: "ok",
      message: "Logout berhasil.",
    });
  });
}