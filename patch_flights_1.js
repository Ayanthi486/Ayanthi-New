const fs = require('fs');

let file1 = fs.readFileSync('apps/api/src/masterdata/flights.service.ts', 'utf8');
file1 = file1.replace(
  `const FLIGHT_WITH_AIRLINE_INCLUDE = { airline: { select: { name: true } } } as const;`,
  `const FLIGHT_WITH_AIRLINE_INCLUDE = { airline: { select: { name: true, code: true } } } as const;`
);
fs.writeFileSync('apps/api/src/masterdata/flights.service.ts', file1);

let file2 = fs.readFileSync('apps/api/src/masterdata/masterdata.util.ts', 'utf8');
file2 = file2.replace(
  `    airline: { name: string };`,
  `    airline: { name: string; code: string };`
);
file2 = file2.replace(
  `    airlineName: row.airline.name,`,
  `    airlineName: row.airline.name,
    airlineCode: row.airline.code,`
);
fs.writeFileSync('apps/api/src/masterdata/masterdata.util.ts', file2);

let file3 = fs.readFileSync('packages/shared/src/masterdata.ts', 'utf8');
file3 = file3.replace(
  `  airlineName: z.string(),`,
  `  airlineName: z.string(),
  airlineCode: z.string(),`
);
fs.writeFileSync('packages/shared/src/masterdata.ts', file3);

let file4 = fs.readFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', 'utf8');
file4 = file4.replace(
  `  { header: 'Flight No', accessorKey: 'flightNo' },`,
  `  { 
    header: 'Flight No', 
    accessorKey: 'flightNo',
    cell: ({ row }) => \`\${row.original.airlineCode} \${row.original.flightNo}\`
  },`
);
fs.writeFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', file4);
