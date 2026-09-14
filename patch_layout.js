const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/shipments/pages/ShipmentViewPage.tsx', 'utf8');

// 1. Reorder the FIELDS
file = file.replace(
`  { label: 'Shipper', key: 'shipperName', group: 'Cargo & Parties' },
  { label: 'Shipper Address', key: 'shipperAddress', group: 'Cargo & Parties' },
  { label: 'Shipper Contact', key: 'shipperContact', group: 'Cargo & Parties' },
  { label: 'Consignee', key: 'consigneeName', group: 'Cargo & Parties' },
  { label: 'Consignee Address', key: 'consigneeAddress', group: 'Cargo & Parties' },
  { label: 'Consignee Contact', key: 'consigneeContact', group: 'Cargo & Parties' },`,
`  { label: 'Shipper', key: 'shipperName', group: 'Cargo & Parties' },
  { label: 'Consignee', key: 'consigneeName', group: 'Cargo & Parties' },
  { label: 'Shipper Address', key: 'shipperAddress', group: 'Cargo & Parties' },
  { label: 'Consignee Address', key: 'consigneeAddress', group: 'Cargo & Parties' },
  { label: 'Shipper Contact', key: 'shipperContact', group: 'Cargo & Parties' },
  { label: 'Consignee Contact', key: 'consigneeContact', group: 'Cargo & Parties' },`
);

// 2. Remove the col-span-2 for address
file = file.replace(
`                {FIELDS.filter((field) => field.group === group).map((field) => {
                  const isFullWidth = field.key === 'shipperAddress' || field.key === 'consigneeAddress';
                  return (
                    <div key={field.key} className={isFullWidth ? 'col-span-2' : ''}>`,
`                {FIELDS.filter((field) => field.group === group).map((field) => {
                  return (
                    <div key={field.key}>`
);

fs.writeFileSync('apps/web/src/features/shipments/pages/ShipmentViewPage.tsx', file);
