const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.airline.findFirst({ where: { code: 'LX' } }).then(a => console.log(a)).finally(() => prisma.$disconnect());
