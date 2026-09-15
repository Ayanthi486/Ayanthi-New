const fs = require('fs');
let file = fs.readFileSync('apps/api/prisma/schema.prisma', 'utf8');

file = file.replace(
  `  code      String
  name      String
  isActive  Boolean  @default(true)`,
  `  code      String
  name      String
  awbPrefix String?
  isActive  Boolean  @default(true)`
);

fs.writeFileSync('apps/api/prisma/schema.prisma', file);
