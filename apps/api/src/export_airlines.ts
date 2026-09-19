import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import * as fs from 'fs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const airlines = await prisma.airline.findMany();

  fs.writeFileSync(
    'airlines_export.json',
    JSON.stringify(airlines, null, 2),
    'utf-8',
  );

  console.log(
    `Exported ${airlines.length} airlines to airlines_export.json`,
  );
}

main()
  .catch((error) => {
    console.error('Failed to export airlines:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });