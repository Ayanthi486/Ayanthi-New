const fs = require('fs');

let file = fs.readFileSync('apps/api/src/shipment/shipment.service.ts', 'utf8');

file = file.replace(
  `throw new ConflictError(\`CusDec Number "\${cusdecNo}" is already used by Shipment \${existing.shipmentNo}.\`);`,
  `throw new ValidationError(\`CusDec Number "\${cusdecNo}" is already used by Shipment \${existing.shipmentNo}.\`);`
);

fs.writeFileSync('apps/api/src/shipment/shipment.service.ts', file);
