const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', 'utf8');

file = file.replace(
  `  const flightStr = shipment.flightNo ? \`\${escapeHtml(shipment.flightNo)} - \${formatFlightDate(shipment.flightDate)}\` : formatFlightDate(shipment.flightDate);`,
  `  const combinedFlight = shipment.flightNo ? (shipment.airlineCode ? \`\${shipment.airlineCode}\${shipment.flightNo}\` : shipment.flightNo) : null;
  const flightStr = combinedFlight ? \`\${escapeHtml(combinedFlight)} - \${formatFlightDate(shipment.flightDate)}\` : formatFlightDate(shipment.flightDate);`
);

fs.writeFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', file);
