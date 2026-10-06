import { prisma } from "./lib/prisma.js";

async function main() {
  await prisma.$connect();
  console.log("Prisma berhasil terhubung ke PostgreSQL");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });