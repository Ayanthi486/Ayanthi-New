const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.test.tsx', 'utf8');

file = file.replace(
  `    it('rejects adding a flight if the airline code is not found in master data', async () => {`,
  `    it('auto-creates the airline if the code is not found in master data when adding a flight', async () => {`
);

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.test.tsx', file);
