const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const airlines = await prisma.airline.findMany();
  console.log("Airlines and their awbPrefixes:");
  airlines.forEach(a => console.log(`${a.code}: ${a.awbPrefix}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
