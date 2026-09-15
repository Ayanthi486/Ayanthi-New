const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/shipments/components/CargoValueCell.tsx', 'utf8');

file = file.replace(
  `  const canEdit = shipment.status === 'PENDING' && hasPermission('cargo.boxweight.enter');`,
  `  const canEdit = ['PENDING', 'CONFIRMED', 'CANCELLED'].includes(shipment.status) && hasPermission('cargo.boxweight.enter');`
);

fs.writeFileSync('apps/web/src/features/shipments/components/CargoValueCell.tsx', file);
