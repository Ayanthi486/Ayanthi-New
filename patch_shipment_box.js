const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/shipments/pages/ShipmentViewPage.tsx', 'utf8');

// 1. Remove them from the bottom
file = file.replace(
`  { label: 'Commodity', key: 'commodityName', group: 'Cargo & Parties' },
  {
    label: 'Box count',
    key: 'boxCount',
    group: 'Cargo & Parties',
    render: (shipment) => <CargoValueCell shipment={shipment} value={shipment.boxCount ?? '—'} />,
  },
  {
    label: 'Weight (kg)',
    key: 'weightKg',
    group: 'Cargo & Parties',
    render: (shipment) => <CargoValueCell shipment={shipment} value={shipment.weightKg ?? '—'} />,
  },`,
  ``
);

// 2. Insert them after Service Type
file = file.replace(
`  {
    label: 'Service Type',
    key: 'serviceType',
    group: 'Shipment',
    format: (value) => SERVICE_TYPE_LABELS[value as Shipment['serviceType']],
  },`,
`  {
    label: 'Service Type',
    key: 'serviceType',
    group: 'Shipment',
    format: (value) => SERVICE_TYPE_LABELS[value as Shipment['serviceType']],
  },
  { label: 'Commodity', key: 'commodityName', group: 'Shipment' },
  {
    label: 'Box count',
    key: 'boxCount',
    group: 'Shipment',
    render: (shipment) => <CargoValueCell shipment={shipment} value={shipment.boxCount ?? '—'} />,
  },
  {
    label: 'Weight (kg)',
    key: 'weightKg',
    group: 'Shipment',
    render: (shipment) => <CargoValueCell shipment={shipment} value={shipment.weightKg ?? '—'} />,
  },`
);

fs.writeFileSync('apps/web/src/features/shipments/pages/ShipmentViewPage.tsx', file);
