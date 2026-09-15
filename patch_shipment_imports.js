const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', 'utf8');

file = file.replace(
  `  useAirlines,
  useAirports,`,
  `  useAirlines,
  useAirports,
  useCreateAirline,`
);

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', file);
