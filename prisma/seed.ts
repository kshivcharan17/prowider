// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Upsert services
  const serviceNames = ["Service 1", "Service 2", "Service 3"];
  for (const name of serviceNames) {
    await prisma.service.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Upsert 8 providers
  for (let i = 1; i <= 8; i++) {
    await prisma.provider.upsert({
      where: { name: `Provider ${i}` },
      update: {},
      create: { name: `Provider ${i}`, monthlyQuota: 10, leadsReceived: 0 },
    });
  }

  // Upsert allocation states (round-robin pointers)
  const pools = ["service1_pool", "service2_pool", "service3_pool"];
  for (const poolKey of pools) {
    await prisma.allocationState.upsert({
      where: { poolKey },
      update: {},
      create: { poolKey, nextIndex: 0 },
    });
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
