import argon2 from "argon2";
import { prisma } from "../lib/prisma.js";

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    include: {
      roleRef: true,
    },
  });

  if (!user || !user.passwordHash) {
    throw new Error("Email atau password salah");
  }

  const valid = await argon2.verify(user.passwordHash, password);

  if (!valid) {
    throw new Error("Email atau password salah");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    role: user.roleRef.name,
    level: user.roleRef.level,
  };
}