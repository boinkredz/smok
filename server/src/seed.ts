import argon2 from "argon2";
import { prisma } from "./lib/prisma.js";

const roles = [
  { name: "Admin", level: 100 },
  { name: "SOC Manager", level: 80 },
  { name: "CSO", level: 70 },
  { name: "Payroll/HR Admin", level: 60 },
  { name: "Danru", level: 50 },
  { name: "Wadanru", level: 40 },
  { name: "Analyst", level: 30 },
  { name: "Guard", level: 10 },
];

const permissions = [
  { code: "USER_VIEW", name: "Melihat pengguna" },
  { code: "USER_CREATE", name: "Membuat pengguna" },
  { code: "USER_UPDATE", name: "Mengubah pengguna" },
  { code: "USER_DELETE", name: "Menghapus pengguna" },
  { code: "ATTENDANCE_VIEW", name: "Melihat absensi" },
  { code: "SALARY_VIEW", name: "Melihat payroll" },
  { code: "REPORT_VIEW", name: "Melihat laporan" },
];

const dummyUsers = [
  {
    name: "Administrator SMOK",
    email: "admin@smok.local",
    role: "Admin",
  },
  {
    name: "SOC Manager",
    email: "soc.manager@smok.local",
    role: "SOC Manager",
  },
  {
    name: "Chief Security Officer",
    email: "cso@smok.local",
    role: "CSO",
  },
  {
    name: "Payroll Administrator",
    email: "payroll@smok.local",
    role: "Payroll/HR Admin",
  },
  {
    name: "Komandan Regu",
    email: "danru@smok.local",
    role: "Danru",
  },
  {
    name: "Wakil Komandan Regu",
    email: "wadanru@smok.local",
    role: "Wadanru",
  },
  {
    name: "Security Analyst",
    email: "analyst@smok.local",
    role: "Analyst",
  },
  {
    name: "Security Guard",
    email: "guard@smok.local",
    role: "Guard",
  },
];

async function main() {
  console.log("Menjalankan seed database...");

  const roleIds = new Map<string, number>();

  // Membuat role
  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: {
        name: roleData.name,
      },
      update: {
        level: roleData.level,
      },
      create: {
        name: roleData.name,
        level: roleData.level,
      },
    });

    roleIds.set(role.name, role.id);
  }

  // Membuat permission
  for (const permissionData of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permissionData.code,
      },
      update: {
        name: permissionData.name,
      },
      create: {
        code: permissionData.code,
        name: permissionData.name,
      },
    });
  }

  // Membuat hash password
  const passwordHash = await argon2.hash("Admin123!");

  // Membuat user
  for (const userData of dummyUsers) {
    const roleId = roleIds.get(userData.role);

    if (roleId === undefined) {
      throw new Error(`Role "${userData.role}" tidak ditemukan.`);
    }

    await prisma.user.upsert({
      where: {
        email: userData.email,
      },
      update: {
        name: userData.name,
        passwordHash,

        roleRef: {
          connect: {
            id: roleId,
          },
        },
      },
      create: {
        name: userData.name,
        email: userData.email,
        passwordHash,

        roleRef: {
          connect: {
            id: roleId,
          },
        },
      },
    });
  }

  console.log("Seed berhasil dijalankan.");
  console.log("Email admin: admin@smok.local");
  console.log("Password admin: Admin123!");
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });