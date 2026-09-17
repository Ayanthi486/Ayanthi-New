import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const airlines = await prisma.airline.findMany();
  fs.writeFileSync('airlines_export.json', JSON.stringify(airlines, null, 2));
  console.log(`Exported ${airlines.length} airlines to airlines_export.json`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
